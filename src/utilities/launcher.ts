import { ENVIRONMENT, PLATFORM } from './platform'

let lastLaunchAttemptTime = 0
const launchAttemptInterval = 5000
let launchAttemptCount = 0
const matchLaunchAttemptsPerSession = 100

/**
 * Launches the Anki desktop app if it is not already running.
 *
 * Mac only for now, and works on a best-effort basis.
 * Retries as necessary, but times out eventually.
 */
export async function launchAnkiApp(): Promise<void> {
	if (PLATFORM === 'mac' && ENVIRONMENT === 'node') {
		const { openApp } = await import('open')

		if (launchAttemptCount >= matchLaunchAttemptsPerSession) {
			console.warn('Too many Anki App launch attempts this session, ignoring')
			return
		}

		if (lastLaunchAttemptTime === 0 || Date.now() - lastLaunchAttemptTime > launchAttemptInterval) {
			console.warn('Attempting to launch Anki app')

			lastLaunchAttemptTime = Date.now()
			launchAttemptCount++
			// TODO more platforms

			await openApp('/Applications/Anki.app', {
				background: true,
				newInstance: false,
				wait: false,
			})
		}
	} else {
		console.warn('Automatic Anki App launch is only supported on macOS in Node.js environment')
	}
}
