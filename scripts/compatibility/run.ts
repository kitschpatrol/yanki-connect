// cspell:ignore prefs
import { execa } from 'execa'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import type { AnkiProcess } from './anki-process.ts'
import type {
	AnkiRelease,
	AnkiRunResult,
	CombinationResult,
	GuiDiagnosticOptions,
} from './shared.ts'
import { launchAnki } from './anki-process.ts'
import { saveStartupLogs } from './diagnostics.ts'
import { installAnki } from './install-anki.ts'
import { captureNativeCrashes } from './native-crash.ts'
import { PROBE_REVISIONS } from './probe-revisions.ts'
import { probe } from './probe.ts'
import { retryInfrastructure } from './retry.ts'
import { prepareAnkiRuntime } from './runtime.ts'
import { collectionFailures, truncate } from './shared.ts'

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
async function createBase(
	pluginDirectory?: string,
	diagnosticFocus?: GuiDiagnosticOptions['focus'],
): Promise<string> {
	const base = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'yanki-compat-anki-'))
	await execa('python3', [CREATE_PREFS, base])
	await fs.promises.copyFile('scripts/compatibility/fixtures/mpv.conf', path.join(base, 'mpv.conf'))
	const dialogs = path.join(base, ADDON_DIRECTORY, DIALOGS_ADDON_ID)
	await fs.promises.mkdir(dialogs, { recursive: true })
	await fs.promises.copyFile(DIALOGS_ADDON, path.join(dialogs, '__init__.py'))
	if (diagnosticFocus !== undefined) {
		await fs.promises.writeFile(
			path.join(dialogs, 'diagnostic.json'),
			JSON.stringify({ focus: diagnosticFocus }),
		)
	}

	if (pluginDirectory !== undefined) {
		await fs.promises.cp(pluginDirectory, path.join(base, ADDON_DIRECTORY, ANKI_CONNECT_ID), {
			recursive: true,
		})
	}

	return base
}

async function stopAnki(
	anki: AnkiProcess,
	diagnosticsDirectory?: string,
	coreDirectory?: string,
): Promise<void> {
	try {
		await anki.kill()
		const start = Date.now()
		while ((await portOpen()) && Date.now() - start < STOP_TIMEOUT) {
			await sleep(250)
		}

		if (coreDirectory !== undefined) {
			await captureNativeCrashes(coreDirectory, anki.base)
		}
	} finally {
		try {
			await saveStartupLogs(anki.base, diagnosticsDirectory)
		} finally {
			await fs.promises.rm(anki.base, { force: true, recursive: true })
		}
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
async function waitForAnkiConnect(
	anki: AnkiProcess,
): Promise<'addon-failed' | 'probe-failed' | 'ready'> {
	const start = Date.now()
	while (Date.now() - start < ADDON_TIMEOUT && anki.running()) {
		if (await ankiConnectResponds()) {
			return 'ready'
		}

		// Newer Anki versions write load errors to stderr rather than a dialog.
		const log = anki.log()
		if (log.includes(ANKI_CONNECT_ID) && log.includes('Traceback')) {
			return 'addon-failed'
		}

		await sleep(500)
	}

	// A process may exit immediately after reporting its load error.
	const log = anki.log()
	return log.includes(ANKI_CONNECT_ID) && log.includes('Traceback')
		? 'addon-failed'
		: 'probe-failed'
}

/**
 * Launch the given Anki executable with one AnkiConnect release installed in a
 * disposable profile, probe every action, and shut Anki down again.
 */
async function testCombinationAttempt(
	executable: string,
	pluginDirectory: string,
	ankiConnectVersion: string,
	environment: NodeJS.ProcessEnv = process.env,
	diagnosticsDirectory?: string,
	diagnostic?: GuiDiagnosticOptions,
): Promise<CombinationResult> {
	const base = await createBase(pluginDirectory, diagnostic?.focus)
	const anki = launchAnki(executable, base, environment, diagnostic?.sandbox)
	try {
		if ((await waitForStart(anki)) === undefined) {
			return {
				actions: {},
				ankiConnectVersion,
				detail: `Anki did not load its add-ons:\n${truncate(anki.log(), 4000)}`,
				status: 'launch-failed',
			}
		}

		const startup = await waitForAnkiConnect(anki)
		if (startup !== 'ready') {
			return {
				actions: {},
				ankiConnectVersion,
				detail: `AnkiConnect did not respond:\n${truncate(anki.log(), 4000)}`,
				status: startup,
			}
		}

		const report = await probe({ guiStateFile: anki.guiStateFile })
		return { actions: report.actions, ankiConnectVersion, status: 'tested' }
	} finally {
		await stopAnki(anki, diagnosticsDirectory, diagnostic?.coreDirectory)
	}
}

/** Preserve each attempt; only a diagnosed host failure permits a fresh profile. */
export async function testCombination(
	executable: string,
	pluginDirectory: string,
	ankiConnectVersion: string,
	environment: NodeJS.ProcessEnv = process.env,
	diagnosticsDirectory?: string,
	diagnostic?: GuiDiagnosticOptions,
): Promise<CombinationResult> {
	return retryInfrastructure(async (attempt) => {
		const directory =
			diagnosticsDirectory === undefined
				? undefined
				: path.join(diagnosticsDirectory, `attempt-${String(attempt)}`)
		const result = await testCombinationAttempt(
			executable,
			pluginDirectory,
			ankiConnectVersion,
			environment,
			directory,
			diagnostic,
		)
		if (directory !== undefined) {
			await fs.promises.writeFile(
				path.join(directory, 'result.json'),
				JSON.stringify(result, undefined, '\t'),
			)
		}

		return result
	})
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
	diagnosticsDirectory?: string,
	diagnostic?: GuiDiagnosticOptions,
): Promise<AnkiRunResult> {
	const { environment, notes } = prepareAnkiRuntime(release, process.env, diagnostic)
	const metadata = {
		...(diagnostic !== undefined && {
			diagnosticFocus: diagnostic.focus,
			diagnosticSandbox: diagnostic.sandbox,
		}),
		...(notes.length > 0 && { runtimeNotes: notes }),
	}
	let executable: string
	try {
		executable = await installAnki(release, installDirectory)
	} catch (error) {
		return {
			...metadata,
			combinations: [],
			detail: truncate(error instanceof Error ? error.message : String(error), 2000),
			release,
			status: 'install-failed',
		}
	}

	if (await portOpen()) {
		throw new Error(`Port ${String(ANKI_CONNECT_PORT)} is already in use`)
	}

	const preflightBase = await createBase()
	const preflight = launchAnki(executable, preflightBase, environment, diagnostic?.sandbox)
	let reportedVersion: string | undefined
	let preflightLog: string
	try {
		reportedVersion = await waitForStart(preflight)
		preflightLog = truncate(preflight.log(), 4000)
	} finally {
		await stopAnki(
			preflight,
			diagnosticsDirectory === undefined ? undefined : path.join(diagnosticsDirectory, 'preflight'),
			diagnostic?.coreDirectory,
		)
	}

	if (reportedVersion === undefined) {
		return {
			...metadata,
			combinations: [],
			detail: `Anki did not start:\n${preflightLog}`,
			release,
			status: 'launch-failed',
		}
	}

	console.log(`Anki ${release.version} reports version ${reportedVersion}`)
	const combinations: CombinationResult[] = []
	for (const ankiConnectVersion of ankiConnectVersions) {
		let result: CombinationResult
		try {
			result = await testCombination(
				executable,
				path.join(pluginsDirectory, ankiConnectVersion),
				ankiConnectVersion,
				environment,
				diagnosticsDirectory === undefined
					? undefined
					: path.join(diagnosticsDirectory, ankiConnectVersion),
				diagnostic,
			)
		} catch (error) {
			result = {
				actions: {},
				ankiConnectVersion,
				detail: truncate(error instanceof Error ? error.message : String(error), 2000),
				status: 'probe-failed',
			}
		}

		const ok = Object.values(result.actions).filter((outcome) => outcome.status === 'ok').length
		console.log(
			`AnkiConnect ${ankiConnectVersion}: ${result.status}${result.status === 'tested' ? ` (${String(ok)} actions ok)` : ''}`,
		)
		combinations.push(result)
	}

	return { ...metadata, combinations, release, reportedVersion, status: 'ok' }
}

async function main(): Promise<void> {
	const { values } = parseArgs({
		options: {
			'anki-connect-versions': { type: 'string' },
			'anki-release': { type: 'string' },
			'core-directory': { type: 'string' },
			'diagnostic-focus': { type: 'string' },
			'diagnostic-sandbox': { type: 'string' },
			'install-directory': { type: 'string' },
			output: { type: 'string' },
			plugins: { type: 'string' },
		},
	})
	const release = JSON.parse(values['anki-release'] ?? '') as AnkiRelease
	const ankiConnectVersions = JSON.parse(values['anki-connect-versions'] ?? '') as string[]
	const output = values.output ?? `results/anki-${release.version}.json`
	const focus = values['diagnostic-focus']
	const sandbox = values['diagnostic-sandbox']
	let diagnostic: GuiDiagnosticOptions | undefined
	if (focus !== undefined || sandbox !== undefined || values['core-directory'] !== undefined) {
		if ((focus !== 'enabled' && focus !== 'disabled') || values['core-directory'] === undefined) {
			throw new Error(
				'GUI diagnostics require --diagnostic-focus enabled|disabled and --core-directory',
			)
		}

		if (sandbox !== undefined && sandbox !== 'enabled' && sandbox !== 'disabled') {
			throw new Error('GUI diagnostics require --diagnostic-sandbox enabled|disabled')
		}

		diagnostic = { coreDirectory: values['core-directory'], focus, sandbox }
	}

	let result: AnkiRunResult
	try {
		result = await runAnkiRelease(
			release,
			values['install-directory'] ?? path.join(os.tmpdir(), 'yanki-compat-install'),
			values.plugins ?? 'plugins',
			ankiConnectVersions,
			path.join(path.dirname(output), 'logs', release.version),
			diagnostic,
		)
	} catch (error) {
		result = {
			combinations: [],
			detail: truncate(error instanceof Error ? error.message : String(error), 2000),
			release,
			status: 'probe-failed',
		}
	}

	result.ankiConnectVersions = ankiConnectVersions
	if (diagnostic !== undefined) {
		result.diagnosticFocus = diagnostic.focus
		result.diagnosticSandbox = diagnostic.sandbox
	}

	result.probeRevisions = PROBE_REVISIONS
	await fs.promises.mkdir(path.dirname(output), { recursive: true })
	await fs.promises.writeFile(output, JSON.stringify(result, undefined, '\t'))
	console.log(`${result.status}: wrote ${output}`)
	const failures = collectionFailures(result)
	if (failures.length === 0) {
		return
	}

	console.error(failures.join('\n'))
	process.exitCode = 1
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	await main()
}
