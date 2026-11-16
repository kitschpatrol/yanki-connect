import fs from 'node:fs'
import path from 'node:path'

const DIALOGS_ADDON = 'addons21/0_yanki_e2e_dialogs'

/** Read complete startup evidence; truncation is only for the JSON summary. */
export function readStartupLogs(base: string): string {
	const files = [
		path.join(base, DIALOGS_ADDON, 'addon-error.txt'),
		path.join(base, 'anki.log'),
		path.join(base, DIALOGS_ADDON, 'dialogs.log'),
		path.join(base, 'process.json'),
	]
	return files
		.filter((file) => fs.existsSync(file))
		.map((file) => `${path.basename(file)}:\n${fs.readFileSync(file, 'utf8')}`)
		.join('\n')
}

/** Preserve logs separately from the disposable Anki profile. */
export async function saveStartupLogs(base: string, destination?: string): Promise<void> {
	if (destination === undefined) {
		return
	}

	await fs.promises.mkdir(destination, { recursive: true })
	const names = await fs.promises.readdir(base)
	const files = [
		path.join(base, 'anki.log'),
		path.join(base, 'process.json'),
		path.join(base, 'native-crash.json'),
		path.join(base, 'mpv.conf'),
		...names
			.filter((name) => name.startsWith('native-backtrace-') && name.endsWith('.log'))
			.map((name) => path.join(base, name)),
		...[
			'addon-error.txt',
			'dialogs.log',
			'diagnostic.json',
			'focus.log',
			'gui-state.json',
			'gui-state.log',
		].map((name) => path.join(base, DIALOGS_ADDON, name)),
	]
	for (const file of files) {
		if (fs.existsSync(file)) {
			await fs.promises.copyFile(file, path.join(destination, path.basename(file)))
		}
	}
}
