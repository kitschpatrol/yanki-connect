// cspell:ignore prefs PYTHONHOME
import { execa } from 'execa'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import type { AnkiRelease, AnkiRunResult, CombinationResult } from './shared.ts'
import { installAnki } from './install-anki.ts'
import { probe } from './probe.ts'
import { truncate } from './shared.ts'

const ANKI_CONNECT_PORT = 8765
const ANKI_CONNECT_ID = '2055492159'
const ADDON_DIRECTORY = 'addons21'
/**
 * Sorts before AnkiConnect so it loads first and can dismiss add-on load
 * errors.
 */
const DIALOGS_ADDON_ID = '0_yanki_e2e_dialogs'
const DIALOGS_ADDON = 'test/utilities/anki-dialogs.py'
const CREATE_PREFS = 'scripts/compatibility/create-prefs.py'

/** Time allowed for Anki to load its add-ons on a fresh profile. */
const START_TIMEOUT = 150_000
/** Time allowed for AnkiConnect to answer once Anki has loaded its add-ons. */
const ADDON_TIMEOUT = 60_000
const STOP_TIMEOUT = 30_000
const PYTHON_VARIABLES = new Set(['LD_LIBRARY_PATH', 'PYTHONHOME', 'PYTHONPATH'])

type AnkiProcess = {
	base: string
	dialogsLog: string
	exited: Promise<void>
	kill: () => Promise<void>
	log: () => string
	running: () => boolean
	versionFile: string
}

async function sleep(milliseconds: number): Promise<void> {
	await new Promise((resolve) => {
		setTimeout(resolve, milliseconds)
	})
}

async function portOpen(): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = net.connect({ host: '127.0.0.1', port: ANKI_CONNECT_PORT })
		socket.once('connect', () => {
			socket.destroy()
			resolve(true)
		})
		socket.once('error', () => {
			resolve(false)
		})
	})
}

async function ankiConnectResponds(): Promise<boolean> {
	try {
		// eslint-disable-next-line node/no-unsupported-features/node-builtins -- Scripts run on the development Node version.
		const response = await fetch(`http://127.0.0.1:${String(ANKI_CONNECT_PORT)}`, {
			body: JSON.stringify({ action: 'version', version: 6 }),
			// AnkiConnect closes every connection, so do not try to reuse sockets.
			headers: { connection: 'close' },
			method: 'POST',
			signal: AbortSignal.timeout(5000),
		})
		return response.status === 200
	} catch {
		return false
	}
}

/**
 * Create a disposable Anki base folder with the dialog-dismissing add-on and,
 * optionally, an AnkiConnect release.
 */
async function createBase(pluginDirectory?: string): Promise<string> {
	const base = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'yanki-compat-anki-'))
	await execa('python3', [CREATE_PREFS, base])
	const dialogs = path.join(base, ADDON_DIRECTORY, DIALOGS_ADDON_ID)
	await fs.promises.mkdir(dialogs, { recursive: true })
	await fs.promises.copyFile(DIALOGS_ADDON, path.join(dialogs, '__init__.py'))
	if (pluginDirectory !== undefined) {
		// eslint-disable-next-line node/no-unsupported-features/node-builtins -- Scripts run on the development Node version.
		await fs.promises.cp(pluginDirectory, path.join(base, ADDON_DIRECTORY, ANKI_CONNECT_ID), {
			recursive: true,
		})
	}

	return base
}

function readTail(file: string, lines = 20): string {
	const content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
	return truncate(content.trim().split('\n').slice(-lines).join('\n'), 2000)
}

function launchAnki(executable: string, base: string, environment: NodeJS.ProcessEnv): AnkiProcess {
	const logPath = path.join(base, 'anki.log')
	const child = execa(executable, ['-b', base], {
		cleanup: false,
		detached: true,
		env: { ...environment, LANG: 'en_US.UTF-8' },
		extendEnv: false,
		reject: false,
		stderr: { append: true, file: logPath },
		stdin: 'ignore',
		stdout: { append: true, file: logPath },
	})
	let running = true
	const exited = (async () => {
		await child
		running = false
	})()
	child.nodeChildProcess.unref()

	const addonDirectory = path.join(base, ADDON_DIRECTORY, DIALOGS_ADDON_ID)
	return {
		base,
		dialogsLog: path.join(addonDirectory, 'dialogs.log'),
		exited,
		async kill() {
			if (running && child.pid !== undefined) {
				try {
					process.kill(-child.pid, 'SIGKILL')
				} catch {
					// Process group already gone
				}
			}

			await Promise.race([exited, sleep(STOP_TIMEOUT)])
			const start = Date.now()
			while ((await portOpen()) && Date.now() - start < STOP_TIMEOUT) {
				await sleep(250)
			}
		},
		log() {
			const dialogs = readTail(path.join(addonDirectory, 'dialogs.log'), 10)
			return `${readTail(logPath)}${dialogs === '' ? '' : `\nDismissed dialogs:\n${dialogs}`}`
		},
		running: () => running,
		versionFile: path.join(addonDirectory, 'anki-version.txt'),
	}
}

/**
 * Wait for the dialog add-on to report Anki's version, which proves add-ons
 * loaded.
 */
async function waitForStart(anki: AnkiProcess): Promise<string | undefined> {
	const start = Date.now()
	while (Date.now() - start < START_TIMEOUT && anki.running()) {
		if (fs.existsSync(anki.versionFile)) {
			return fs.readFileSync(anki.versionFile, 'utf8').trim()
		}

		await sleep(500)
	}

	return undefined
}

/**
 * Wait for AnkiConnect to answer. An add-on load error dialog mentioning the
 * add-on means it never will, so give up as soon as one is dismissed.
 */
async function waitForAnkiConnect(anki: AnkiProcess): Promise<boolean> {
	const start = Date.now()
	while (Date.now() - start < ADDON_TIMEOUT && anki.running()) {
		if (await ankiConnectResponds()) {
			return true
		}

		if (fs.existsSync(anki.dialogsLog)) {
			// Only a traceback naming the add-on means it failed to load; the
			// add-on update prompt also mentions it.
			const dialogs = fs.readFileSync(anki.dialogsLog, 'utf8')
			if (dialogs.includes(ANKI_CONNECT_ID) && dialogs.includes('Traceback')) {
				return false
			}
		}

		await sleep(500)
	}

	return false
}

/**
 * Launch the given Anki executable with one AnkiConnect release installed in a
 * disposable profile, probe every action, and shut Anki down again.
 */
export async function testCombination(
	executable: string,
	pluginDirectory: string,
	ankiConnectVersion: string,
	environment: NodeJS.ProcessEnv = process.env,
): Promise<CombinationResult> {
	const base = await createBase(pluginDirectory)
	const anki = launchAnki(executable, base, environment)
	try {
		if ((await waitForStart(anki)) === undefined) {
			return {
				actions: {},
				ankiConnectVersion,
				detail: `Anki did not load its add-ons:\n${anki.log()}`,
				status: 'launch-failed',
			}
		}

		if (!(await waitForAnkiConnect(anki))) {
			return {
				actions: {},
				ankiConnectVersion,
				detail: `AnkiConnect did not respond:\n${anki.log()}`,
				status: 'addon-failed',
			}
		}

		const report = await probe()
		return { actions: report.actions, ankiConnectVersion, status: 'tested' }
	} finally {
		await anki.kill()
		await fs.promises.rm(base, { force: true, recursive: true })
	}
}

/**
 * Install one Anki release, confirm it starts, then probe every AnkiConnect
 * release against it in turn.
 */
export async function runAnkiRelease(
	release: AnkiRelease,
	installDirectory: string,
	pluginsDirectory: string,
	ankiConnectVersions: string[],
): Promise<AnkiRunResult> {
	let executable: string
	try {
		executable = await installAnki(release, installDirectory)
	} catch (error) {
		return {
			combinations: [],
			detail: truncate(error instanceof Error ? error.message : String(error), 2000),
			release,
			status: 'install-failed',
		}
	}

	if (await portOpen()) {
		throw new Error(`Port ${String(ANKI_CONNECT_PORT)} is already in use`)
	}

	// Bundles ship their own Python; the Python set up for pip installs must not leak into them.
	const environment =
		release.source === 'github'
			? Object.fromEntries(
					Object.entries(process.env).filter(([name]) => !PYTHON_VARIABLES.has(name)),
				)
			: process.env

	const preflightBase = await createBase()
	const preflight = launchAnki(executable, preflightBase, environment)
	let reportedVersion: string | undefined
	let preflightLog: string
	try {
		reportedVersion = await waitForStart(preflight)
		preflightLog = preflight.log()
	} finally {
		await preflight.kill()
		await fs.promises.rm(preflightBase, { force: true, recursive: true })
	}

	if (reportedVersion === undefined) {
		return {
			combinations: [],
			detail: `Anki did not start:\n${preflightLog}`,
			release,
			status: 'launch-failed',
		}
	}

	console.log(`Anki ${release.version} reports version ${reportedVersion}`)
	const combinations: CombinationResult[] = []
	for (const ankiConnectVersion of ankiConnectVersions) {
		const result = await testCombination(
			executable,
			path.join(pluginsDirectory, ankiConnectVersion),
			ankiConnectVersion,
			environment,
		)
		const ok = Object.values(result.actions).filter((outcome) => outcome.status === 'ok').length
		console.log(
			`AnkiConnect ${ankiConnectVersion}: ${result.status}${result.status === 'tested' ? ` (${String(ok)} actions ok)` : ''}`,
		)
		combinations.push(result)
	}

	return { combinations, release, reportedVersion, status: 'ok' }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const { values } = parseArgs({
		options: {
			'anki-connect-versions': { type: 'string' },
			'anki-release': { type: 'string' },
			'install-directory': { type: 'string' },
			output: { type: 'string' },
			plugins: { type: 'string' },
		},
	})
	const release = JSON.parse(values['anki-release'] ?? '') as AnkiRelease
	const ankiConnectVersions = JSON.parse(values['anki-connect-versions'] ?? '') as string[]
	const result = await runAnkiRelease(
		release,
		values['install-directory'] ?? path.join(os.tmpdir(), 'yanki-compat-install'),
		values.plugins ?? 'plugins',
		ankiConnectVersions,
	)
	const output = values.output ?? `results/anki-${release.version}.json`
	await fs.promises.mkdir(path.dirname(output), { recursive: true })
	await fs.promises.writeFile(output, JSON.stringify(result, undefined, '\t'))
	console.log(`${result.status}: wrote ${output}`)
}
