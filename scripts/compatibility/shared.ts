/**
 * Outcome of probing one action against one Anki and AnkiConnect combination.
 *
 * - `ok`: the call succeeded, behaved as documented, and every response matched
 *   the declared result type.
 * - `error`: AnkiConnect returned an error or the request failed.
 * - `failed`: the call returned, but not with the documented behavior.
 * - `signature`: the call succeeded but a response did not match the declared
 *   result type.
 * - `skipped`: a prerequisite from an earlier action was unavailable.
 * - `untestable`: the action cannot be exercised in an isolated profile.
 */
export type ActionStatus = 'error' | 'failed' | 'ok' | 'signature' | 'skipped' | 'untestable'

export type ActionOutcome = {
	detail?: string
	status: ActionStatus
}

/** An installable Anki release for Linux. */
export type AnkiRelease =
	| { source: 'github'; url: string; version: string }
	| { source: 'pypi'; spec: string; version: string }

/** Results for one AnkiConnect version against one installed Anki version. */
export type CombinationResult = {
	actions: Record<string, ActionOutcome>
	ankiConnectVersion: string
	detail?: string
	status: 'addon-failed' | 'launch-failed' | 'tested'
}

/** Results for every AnkiConnect version against one Anki release. */
export type AnkiRunResult = {
	combinations: CombinationResult[]
	detail?: string
	release: AnkiRelease
	reportedVersion?: string
	status: 'install-failed' | 'launch-failed' | 'ok'
}

/**
 * Parse a dotted version into numeric components. Anki and AnkiConnect both use
 * purely numeric release versions, and leading zeros (`24.04`) are
 * insignificant.
 */
export function parseVersion(version: string): number[] {
	return version.split('.').map(Number)
}

/**
 * Compare two dotted versions numerically, treating missing components as zero
 * so that `23.10` and `23.10.0` are equal.
 */
export function compareVersions(a: string, b: string): number {
	const left = parseVersion(a)
	const right = parseVersion(b)
	const length = Math.max(left.length, right.length)
	for (let index = 0; index < length; index++) {
		const difference = (left[index] ?? 0) - (right[index] ?? 0)
		if (difference !== 0) {
			return difference
		}
	}

	return 0
}

/**
 * Convert a PyPI version such as `25.7.1` into Anki's own calendar format
 * `25.07.1`, which is also what `aqt.appVersion` reports.
 */
export function formatAnkiVersion(pypiVersion: string): string {
	const [year, month, ...rest] = pypiVersion.split('.')
	return year === undefined || month === undefined || Number(year) < 23
		? pypiVersion
		: [year, month.padStart(2, '0'), ...rest].join('.')
}

/** Shorten a diagnostic message for inclusion in the results JSON. */
export function truncate(message: string, length = 400): string {
	return message.length > length ? `${message.slice(0, length)}…` : message
}
