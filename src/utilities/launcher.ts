import { ENVIRONMENT, PLATFORM } from './platform'

let lastLaunchAttemptTime = 0
const launchAttemptInterval = 5000
let launchAttemptCount = 0
const matchLaunchAttemptsPerSession = 100

/**
 * Launches the Anki desktop app if it is not already running.
 *
 * Mac only for now, and works on a best-effort basis. Launches at most once per
 * interval, and gives up after a fixed number of launches per session.
 *
 * @returns `false` once launching has been given up on, or if the platform is
 *   unsupported, so callers know to stop retrying.
 */
export async function launchAnkiApp(): Promise<boolean> {
	if (PLATFORM === 'mac' && ENVIRONMENT === 'node') {
		const { openApp } = await import('open')

		if (lastLaunchAttemptTime === 0 || Date.now() - lastLaunchAttemptTime > launchAttemptInterval) {
			// Only give up once the last launch has had its full interval
			if (launchAttemptCount >= matchLaunchAttemptsPerSession) {
				console.warn('Too many Anki App launch attempts this session, ignoring')
				return false
			}

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

		return true
	}

	console.warn('Automatic Anki App launch is only supported on macOS in Node.js environment')
	return false
}
