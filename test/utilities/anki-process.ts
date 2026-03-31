import { execa } from 'execa'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { YankiConnect } from '../../src'

const TEST_PROFILE_NAME = 'yanki-tests'

let ankiPid: number | undefined

const platform =
	process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'mac' : 'linux'

/**
 * Finds the Anki executable on Windows.
 */
function findAnkiWindows(): string {
	const candidates = [
		path.join(os.homedir(), 'scoop', 'apps', 'anki', 'current', 'programfiles', '.venv', 'Scripts', 'anki.exe'),
		path.join('C:', 'Program Files', 'Anki', 'anki.exe'),
	]

	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) {
			return candidate
		}
	}

	return 'anki'
}

/**
 * Finds the Anki executable on Linux.
 */
function findAnkiLinux(): string {
	const candidates = [
		'/usr/local/bin/anki',
		'/usr/bin/anki',
		path.join(os.homedir(), '.local', 'bin', 'anki'),
	]

	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) {
			return candidate
		}
	}

	return 'anki'
}

/**
 * Launches Anki with a custom base directory.
 */
export async function openAnki(basePath: string): Promise<void> {
	switch (platform) {
		case 'linux': {
			const ankiPath = findAnkiLinux()
			const child = execa(ankiPath, ['-b', basePath, '-p', TEST_PROFILE_NAME], {
				detached: true,
				stdio: 'ignore',
			})

			child.catch(() => {
				// Expected: process is killed during closeAnki
			})
			ankiPid = child.pid
			child.unref()
			break
		}

		case 'mac': {
			if (fs.existsSync('/Applications/Anki.app')) {
				await execa('open', [
					'/Applications/Anki.app',
					'--args',
					'-b',
					basePath,
					'-p',
					TEST_PROFILE_NAME,
				])
			} else {
				// Pip-installed Anki (no .app bundle), launch directly
				const child = execa('anki', ['-b', basePath, '-p', TEST_PROFILE_NAME], {
					detached: true,
					stdio: 'ignore',
				})

				child.catch(() => {
					// Expected: process is killed during closeAnki
				})
				ankiPid = child.pid
				child.unref()
			}

			break
		}

		case 'windows': {
			const ankiPath = findAnkiWindows()
			const child = execa(ankiPath, ['-b', basePath, '-p', TEST_PROFILE_NAME], {
				detached: true,
				stdio: 'ignore',
				windowsHide: true,
			})

			child.catch(() => {
				// Expected: process is killed via taskkill during closeAnki
			})
			ankiPid = child.pid
			child.unref()
			break
		}
	}

	// Poll until AnkiConnect is reachable
	const client = new YankiConnect({ autoLaunch: false })
	const maxWait = Number(process.env.ANKI_CONNECT_TIMEOUT) || 30_000
	const start = Date.now()
	while (Date.now() - start < maxWait) {
		try {
			await client.miscellaneous.version()
			return
		} catch {
			await new Promise((resolve) => {
				setTimeout(resolve, 500)
			})
		}
	}

	throw new Error(`Anki did not become reachable within ${String(maxWait / 1000)}s`)
}

/**
 * Closes Anki and waits until AnkiConnect is unreachable.
 */
export async function closeAnki(): Promise<void> {
	const client = new YankiConnect({ autoLaunch: false })

	let isReachable: boolean
	try {
		await client.miscellaneous.version()
		isReachable = true
	} catch {
		isReachable = false
	}

	if (isReachable) {
		switch (platform) {
			case 'linux': {
				if (ankiPid !== undefined) {
					try {
						process.kill(-ankiPid, 'SIGKILL')
					} catch {
						// Ignore if process group already exited
					}

					ankiPid = undefined
				}

				await execa('pkill', ['-x', 'anki']).catch(() => {})
				break
			}

			case 'mac': {
				if (ankiPid !== undefined) {
					try {
						process.kill(-ankiPid, 'SIGKILL')
					} catch {
						// Ignore if process group already exited
					}

					ankiPid = undefined
				} else {
					await execa('osascript', ['-e', 'tell application "Anki" to quit']).catch(
						async () => {
							await execa('sh', [
								'-c',
								"launchctl stop $(launchctl list | grep ankiweb | awk '{print $3}')",
							]).catch(() => {})
						},
					)
				}

				// Fallback for pip-installed Anki in worker processes where ankiPid is lost
				await execa('pkill', ['-9', '-f', 'bin/anki']).catch(() => {})
				break
			}

			case 'windows': {
				if (ankiPid !== undefined) {
					await execa('taskkill', ['/PID', String(ankiPid), '/T', '/F']).catch(() => {})
					ankiPid = undefined
				}

				await execa('taskkill', ['/IM', 'anki.exe', '/T', '/F']).catch(() => {})
				break
			}
		}
	}

	// Spin until unreachable
	while (isReachable) {
		await new Promise((resolve) => {
			setTimeout(resolve, 250)
		})

		try {
			await client.miscellaneous.version()
		} catch {
			isReachable = false
		}
	}
}
