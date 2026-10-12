const ANKI_CONNECT_VERSIONS = ['25.11.9.0', '26.10.12.0']

/**
 * Selects the AnkiConnect fixtures to test, defaulting to all supported
 * versions.
 */
export function getAnkiConnectVersions(): string[] {
	const version = process.env.ANKI_CONNECT_VERSION
	if (version === undefined) {
		return ANKI_CONNECT_VERSIONS
	}

	if (!ANKI_CONNECT_VERSIONS.includes(version)) {
		throw new Error(
			`Unsupported ANKI_CONNECT_VERSION: ${version}. Expected ${ANKI_CONNECT_VERSIONS.join(', ')}.`,
		)
	}

	return [version]
}
