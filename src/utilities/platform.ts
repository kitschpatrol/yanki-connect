export function detectEnvironment() {
	if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
		return 'browser'
	}

	if (typeof process !== 'undefined' && process.platform !== undefined) {
		return 'node'
	}

	return 'unknown'
}

// Function to detect the platform
export function detectPlatform() {
	const environment = detectEnvironment()

	switch (environment) {
		case 'browser': {
			const { userAgent } = navigator

			if (/windows/i.test(userAgent)) {
				return 'windows'
			}

			if (/mac/i.test(userAgent)) {
				return 'mac'
			}

			break
		}

		case 'node': {
			const { platform } = process

			if (platform === 'win32') {
				return 'windows'
			}

			if (platform === 'darwin') {
				return 'mac'
			}

			break
		}

		case 'unknown': {
			return 'unknown'
		}
	}

	return 'unknown'
}
