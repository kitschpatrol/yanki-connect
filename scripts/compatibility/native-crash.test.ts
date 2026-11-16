import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { captureNativeCrashes } from './native-crash.ts'

let directory: string
let cores: string
let output: string

beforeEach(async () => {
	directory = await fs.mkdtemp(path.join(os.tmpdir(), 'yanki-native-crash-'))
	cores = path.join(directory, 'cores')
	output = path.join(directory, 'output')
	await fs.mkdir(cores)
	await fs.mkdir(output)
	await fs.writeFile(path.join(output, 'process.json'), JSON.stringify({ signal: 'SIGTRAP' }))
	await fs.writeFile(
		path.join(directory, 'gdb'),
		`#!/bin/sh
printf '%s\\n' "$@"
printf 'Program terminated with signal SIGTRAP.\\n#0 trap_probe()\\n'
exit "$YANKI_TEST_GDB_EXIT"
`,
		{ mode: 0o755 },
	)
	vi.stubEnv('PATH', `${directory}${path.delimiter}${process.env.PATH ?? ''}`)
	vi.stubEnv('YANKI_TEST_GDB_EXIT', '0')
})

afterEach(async () => {
	vi.unstubAllEnvs()
	await fs.rm(directory, { force: true, recursive: true })
})

it('captures separate traces for the Anki process and a crashed child using their own executables', async () => {
	await fs.writeFile(path.join(cores, 'core.123.!bundle!Anki'), 'Core fixture')
	await fs.writeFile(path.join(cores, 'core.456.!bundle!QtWebEngineProcess'), 'Child core fixture')
	await fs.writeFile(path.join(cores, 'unrelated.txt'), 'Retain unrelated files')
	const report = await captureNativeCrashes(cores, output)
	expect(report.status).toBe('captured')
	expect(
		report.crashes.map(({ executable, pid, status }) => ({ executable, pid, status })),
	).toEqual([
		{ executable: '/bundle/Anki', pid: 123, status: 'captured' },
		{ executable: '/bundle/QtWebEngineProcess', pid: 456, status: 'captured' },
	])
	for (const crash of report.crashes) {
		const trace = await fs.readFile(path.join(output, crash.trace), 'utf8')
		expect(trace).toContain(`--se\n${crash.executable}`)
		expect(trace).toContain('thread apply all bt full 80')
		expect(trace).toContain('SIGTRAP')
	}

	expect(await fs.readdir(cores)).toEqual(['unrelated.txt'])
	expect(
		JSON.parse(await fs.readFile(path.join(output, 'native-crash.json'), 'utf8')) as unknown,
	).toEqual(report)
})

it.each([
	['SIGTRAP', 'missing'],
	['SIGKILL', 'not-crashed'],
])('reports %s without a core as %s', async (signal, status) => {
	await fs.writeFile(path.join(output, 'process.json'), JSON.stringify({ signal }))
	const report = await captureNativeCrashes(cores, output)
	expect(report.status).toBe(status)
	expect(report.crashes).toEqual([])
})

it('retains debugger failures and frees core space before the next attempt', async () => {
	vi.stubEnv('YANKI_TEST_GDB_EXIT', '1')
	await fs.writeFile(path.join(cores, 'core.123.!bundle!Anki'), 'Core fixture')
	const report = await captureNativeCrashes(cores, output)
	expect(report.status).toBe('failed')
	expect(report.crashes[0]?.detail).toContain('exit code 1')
	expect(await fs.readFile(path.join(output, 'native-backtrace-123.log'), 'utf8')).toContain(
		'SIGTRAP',
	)
	expect(await fs.readdir(cores)).toEqual([])
})
