import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import type { AnkiProcess } from './anki-process.ts'
import type { GuiDiagnosticOptions } from './shared.ts'
import { launchAnki } from './anki-process.ts'
import { saveStartupLogs } from './diagnostics.ts'

let directory: string
let managedProcess: AnkiProcess | undefined

beforeEach(async () => {
	directory = await fs.mkdtemp(path.join(os.tmpdir(), 'yanki-process-'))
})

afterEach(async () => {
	if (managedProcess?.running() === true) {
		await managedProcess.kill()
	}

	managedProcess = undefined
	await fs.rm(directory, { force: true, recursive: true })
})

async function launch(
	script: string,
	environment: NodeJS.ProcessEnv = {},
	diagnosticSandbox?: GuiDiagnosticOptions['sandbox'],
): Promise<AnkiProcess> {
	const executable = path.join(directory, 'fake-anki')
	await fs.writeFile(executable, `#!/bin/sh\n${script}\n`, { mode: 0o755 })
	managedProcess = launchAnki(executable, directory, environment, diagnosticSandbox)
	return managedProcess
}

async function diagnostics(): Promise<unknown> {
	return JSON.parse(await fs.readFile(path.join(directory, 'process.json'), 'utf8')) as unknown
}

it.each([
	{ expected: 'unset', inherited: '1', recorded: 'unset', sandbox: 'enabled' },
	{ expected: '1', inherited: undefined, recorded: '1', sandbox: 'disabled' },
	{ expected: '1', inherited: '1', recorded: '1', sandbox: undefined },
	{ expected: 'unset', inherited: undefined, recorded: 'unset', sandbox: undefined },
] as const)(
	'launches with sandbox $sandbox and inherited override $inherited without changing the parent environment',
	async ({ expected, inherited, recorded, sandbox }) => {
		const environment = Object.freeze({ QTWEBENGINE_DISABLE_SANDBOX: inherited })
		const anki = await launch(
			// eslint-disable-next-line no-template-curly-in-string -- The child shell expands this variable.
			'printf \'%s\' "${QTWEBENGINE_DISABLE_SANDBOX-unset}" > "$2/sandbox.txt"',
			environment,
			sandbox,
		)
		await anki.exited
		expect(await fs.readFile(path.join(directory, 'sandbox.txt'), 'utf8')).toBe(expected)
		expect(environment.QTWEBENGINE_DISABLE_SANDBOX).toBe(inherited)
		const evidence = (await diagnostics()) as { qtWebEngineDisableSandbox?: string }
		expect(evidence.qtWebEngineDisableSandbox).toBe(recorded)
	},
)

it.each([0, 17])(
	'records an exit code of %s before cleanup and retains it in the artifact',
	async (code) => {
		const anki = await launch(`exit ${String(code)}`)
		await anki.exited
		expect(anki.running()).toBe(false)
		await anki.kill()
		expect(await diagnostics()).toMatchObject({
			cleanup: { wasRunning: false },
			exitCode: code,
			exitedAt: expect.any(String) as string,
			pid: expect.any(Number) as number,
			startedAt: expect.any(String) as string,
		})
		expect(await diagnostics()).not.toHaveProperty('signal')
		expect(await diagnostics()).not.toHaveProperty('cleanup.signal')
		const destination = path.join(directory, 'artifact')
		await saveStartupLogs(directory, destination)
		expect(await fs.readFile(path.join(destination, 'process.json'), 'utf8')).toBe(
			await fs.readFile(path.join(directory, 'process.json'), 'utf8'),
		)
		expect(anki.log()).toContain(`"exitCode": ${String(code)}`)
	},
)

it('distinguishes an unexpected signal from runner cleanup', async () => {
	const anki = await launch('kill -TERM $$')
	await anki.exited
	await anki.kill()
	expect(await diagnostics()).toMatchObject({ cleanup: { wasRunning: false }, signal: 'SIGTERM' })
	expect(await diagnostics()).not.toHaveProperty('exitCode')
	expect(await diagnostics()).not.toHaveProperty('cleanup.signal')
})

it('records when the runner kills a process that is still alive', async () => {
	const anki = await launch('exec /bin/sleep 60')
	await anki.kill()
	expect(anki.running()).toBe(false)
	expect(await diagnostics()).toMatchObject({
		cleanup: { requestedAt: expect.any(String) as string, signal: 'SIGKILL', wasRunning: true },
		signal: 'SIGKILL',
	})
})

it('retains a launch failure even when no child process could start', async () => {
	managedProcess = launchAnki(path.join(directory, 'missing-executable'), directory, {})
	await managedProcess.exited
	await managedProcess.kill()
	expect(await diagnostics()).toMatchObject({
		cleanup: { wasRunning: false },
		error: expect.stringContaining('ENOENT') as string,
	})
})
