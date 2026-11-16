import { execa } from 'execa'
import fs from 'node:fs'
import path from 'node:path'
import { setTimeout } from 'node:timers/promises'
import type { GuiDiagnosticOptions } from './shared.ts'
import { readStartupLogs } from './diagnostics.ts'

const STOP_TIMEOUT = 30_000

export type AnkiProcess = {
	base: string
	exited: Promise<void>
	guiStateFile: string
	kill: () => Promise<void>
	log: () => string
	running: () => boolean
	versionFile: string
}

/** Launch only a disposable profile and retain its exit and cleanup evidence. */
export function launchAnki(
	executable: string,
	base: string,
	environment: NodeJS.ProcessEnv,
	diagnosticSandbox?: GuiDiagnosticOptions['sandbox'],
): AnkiProcess {
	type ProcessDiagnostics = {
		cleanup?: { error?: string; requestedAt: string; signal?: string; wasRunning: boolean }
		error?: string
		exitCode?: number
		exitedAt?: string
		pid?: number
		qtWebEngineDisableSandbox?: string
		signal?: string
		startedAt: string
	}

	const diagnostics: ProcessDiagnostics = { startedAt: new Date().toISOString() }
	let recording = true
	const save = () => {
		if (recording) {
			fs.writeFileSync(
				path.join(base, 'process.json'),
				JSON.stringify(diagnostics, undefined, '\t'),
			)
		}
	}

	const logPath = path.join(base, 'anki.log')
	const childEnvironment: NodeJS.ProcessEnv = {
		...environment,
		LANG: 'en_US.UTF-8',
		PYTHONFAULTHANDLER: '1',
		PYTHONUNBUFFERED: '1',
	}
	if (diagnosticSandbox !== undefined) {
		// Scope the experiment to this disposable Anki process and its renderers.
		// Unset the override for the control; do not assume that "0" enables it.
		delete childEnvironment.QTWEBENGINE_DISABLE_SANDBOX
		if (diagnosticSandbox === 'disabled') {
			childEnvironment.QTWEBENGINE_DISABLE_SANDBOX = '1'
		}
	}

	diagnostics.qtWebEngineDisableSandbox = childEnvironment.QTWEBENGINE_DISABLE_SANDBOX ?? 'unset'

	const child = execa(executable, ['-b', base], {
		cleanup: false,
		detached: true,
		env: childEnvironment,
		extendEnv: false,
		reject: false,
		stderr: { append: true, file: logPath },
		stdin: 'ignore',
		stdout: { append: true, file: logPath },
	})
	diagnostics.pid = child.pid
	save()
	let running = true
	// Observe the process exit before waiting for Execa to finish handling stdio.
	child.nodeChildProcess.once('exit', (code, signal) => {
		running = false
		diagnostics.exitedAt = new Date().toISOString()
		diagnostics.exitCode = code ?? undefined
		diagnostics.signal = signal ?? undefined
		save()
	})
	const exited = (async () => {
		const result = await child
		running = false
		diagnostics.exitedAt ??= new Date().toISOString()
		diagnostics.exitCode = result.exitCode
		diagnostics.signal = result.signal
		diagnostics.error = result.shortMessage
		save()
	})()
	child.nodeChildProcess.unref()

	const addonDirectory = path.join(base, 'addons21', '0_yanki_e2e_dialogs')
	return {
		base,
		exited,
		guiStateFile: path.join(addonDirectory, 'gui-state.json'),
		async kill() {
			diagnostics.cleanup = { requestedAt: new Date().toISOString(), wasRunning: running }
			if (running && child.pid !== undefined) {
				try {
					process.kill(-child.pid, 'SIGKILL')
					diagnostics.cleanup.signal = 'SIGKILL'
				} catch (error) {
					diagnostics.cleanup.error = error instanceof Error ? error.message : String(error)
				}
			}

			save()
			const deadline = new AbortController()
			try {
				await Promise.race([
					exited,
					setTimeout(STOP_TIMEOUT, undefined, { signal: deadline.signal }),
				])
			} finally {
				deadline.abort()
				// Cleanup may time out; late process events must not write to a deleted profile.
				recording = false
			}
		},
		log: () => readStartupLogs(base),
		running: () => running,
		versionFile: path.join(addonDirectory, 'anki-version.txt'),
	}
}
// cspell:ignore PYTHONFAULTHANDLER PYTHONUNBUFFERED
