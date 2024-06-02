import { detectEnvironment, detectPlatform } from './platform'

let lastLaunchAttemptTime = 0
const launchAttemptInterval = 5000
let launchAttemptCount = 0
const matchLaunchAttemptsPerSession = 100

export async function launchAnkiApp(): Promise<void> {
	const platform = detectPlatform()
	const environment = detectEnvironment()

	if (platform !== 'mac' || environment !== 'node') {
		console.warn('Anki App launch is only supported on Mac OS in Node.js environment')
		return
	}

	const { openApp } = await import('open')

	if (launchAttemptCount >= matchLaunchAttemptsPerSession) {
		console.log('Too many Anki App launch attempts this session, ignoring')
		return
	}

	if (lastLaunchAttemptTime === 0 || Date.now() - lastLaunchAttemptTime > launchAttemptInterval) {
		console.log('Attempting to launch Anki app')

		lastLaunchAttemptTime = Date.now()
		launchAttemptCount++
		// TODO more platforms

		await openApp('/Applications/Anki.app', {
			background: true,
			newInstance: false,
			wait: false,
		})
	}
}
