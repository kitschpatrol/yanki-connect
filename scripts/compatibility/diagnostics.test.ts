import { execa } from 'execa'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { readStartupLogs, saveStartupLogs } from './diagnostics.ts'

it('captures native and HTML load errors without changing dialog behavior', async () => {
	const result = await execa('python3', ['scripts/compatibility/anki-dialogs.test.py'])
	expect(result.exitCode).toBe(0)
})

it('retains complete diagnostics after deleting the disposable profile', async () => {
	const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'yanki-startup-logs-'))
	const base = path.join(directory, 'profile')
	const addon = path.join(base, 'addons21', '0_yanki_e2e_dialogs')
	const destination = path.join(directory, 'results')
	const error = 'Traceback: addons21/2055492159/__init__.py: unsupported Anki version'
	const log = `${error}\n${'Unrelated Qt message\n'.repeat(200)}`
	try {
		await fs.mkdir(addon, { recursive: true })
		await fs.writeFile(path.join(base, 'anki.log'), log)
		await fs.writeFile(path.join(base, 'process.json'), '{"signal":"SIGTERM"}')
		await fs.writeFile(path.join(base, 'native-crash.json'), '{"status":"captured"}')
		await fs.writeFile(path.join(base, 'mpv.conf'), 'ao=null\nvo=null\n')
		await fs.writeFile(path.join(base, 'native-backtrace-123.log'), '#0 native frame')
		await fs.writeFile(path.join(addon, 'addon-error.txt'), error)
		await fs.writeFile(path.join(addon, 'dialogs.log'), 'QtClassProxy: Anki')
		await fs.writeFile(path.join(addon, 'diagnostic.json'), '{"focus":"enabled"}')
		await fs.writeFile(path.join(addon, 'focus.log'), '{"event":"activateWindow"}\n')
		await fs.writeFile(path.join(addon, 'gui-state.json'), '{"busy":true}')
		await fs.writeFile(path.join(addon, 'gui-state.log'), '{"busy":true}\n{"busy":false}\n')
		expect(readStartupLogs(base)).toContain(log)
		expect(readStartupLogs(base).startsWith('addon-error.txt:')).toBe(true)
		await saveStartupLogs(base, destination)
		await fs.rm(base, { recursive: true })
		expect(await fs.readFile(path.join(destination, 'anki.log'), 'utf8')).toBe(log)
		expect(await fs.readFile(path.join(destination, 'addon-error.txt'), 'utf8')).toBe(error)
		expect(await fs.readFile(path.join(destination, 'process.json'), 'utf8')).toBe(
			'{"signal":"SIGTERM"}',
		)
		expect(await fs.readFile(path.join(destination, 'native-backtrace-123.log'), 'utf8')).toBe(
			'#0 native frame',
		)
		expect(await fs.readFile(path.join(destination, 'focus.log'), 'utf8')).toContain(
			'activateWindow',
		)
		expect(await fs.readFile(path.join(destination, 'gui-state.log'), 'utf8')).toContain(
			'{"busy":false}',
		)
		expect(await fs.readFile(path.join(destination, 'mpv.conf'), 'utf8')).toBe('ao=null\nvo=null\n')
		expect(await fs.readdir(destination)).toHaveLength(11)
	} finally {
		await fs.rm(directory, { force: true, recursive: true })
	}
})
