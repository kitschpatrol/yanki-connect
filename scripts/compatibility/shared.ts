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
 * - `infrastructure`: the host UI or diagnostic helper failed, so this is not
 *   evidence of action incompatibility.
 * - `untestable`: the action cannot be exercised in an isolated profile.
 */
export type ActionStatus =
	'error' | 'failed' | 'infrastructure' | 'ok' | 'signature' | 'skipped' | 'untestable'

export type ActionOutcome = {
	detail?: string
	status: ActionStatus
}

/** An installable Anki release for Linux. */
export type AnkiRelease =
	| { source: 'github'; url: string; version: string }
	| { source: 'pypi'; spec: string; version: string }

/** Controlled GUI crash experiment; these results cannot be used as a baseline. */
export type GuiDiagnosticOptions = {
	coreDirectory: string
	focus: 'disabled' | 'enabled'
	sandbox?: 'disabled' | 'enabled'
}

/** Results for one AnkiConnect version against one installed Anki version. */
export type CombinationResult = {
	actions: Record<string, ActionOutcome>
	ankiConnectVersion: string
	/** Every attempt is retained when infrastructure requires a fresh profile. */
	attempts?: Array<{ failures: string[]; status: CombinationResult['status'] }>
	detail?: string
	status: 'addon-failed' | 'launch-failed' | 'probe-failed' | 'tested'
}

/** Results for every AnkiConnect version against one Anki release. */
export type AnkiRunResult = {
	/** Requested versions, including combinations that could not be attempted. */
	ankiConnectVersions?: string[]
	combinations: CombinationResult[]
	detail?: string
	diagnosticFocus?: GuiDiagnosticOptions['focus']
	diagnosticSandbox?: GuiDiagnosticOptions['sandbox']
	/** Assertion revisions, keyed by action name; omitted actions use revision 1. */
	probeRevisions?: Record<string, number>
	release: AnkiRelease
	reportedVersion?: string
	/** Runtime adjustments used to collect these observations. */
	runtimeNotes?: string[]
	status: 'install-failed' | 'launch-failed' | 'ok' | 'probe-failed'
}

/** Explicit host failures, deduplicated across dependent actions. */
export function infrastructureFailures(result: CombinationResult): string[] {
	return [
		...new Set(
			Object.values(result.actions)
				.filter((outcome) => outcome.status === 'infrastructure')
				.map((outcome) => outcome.detail ?? 'GUI infrastructure unavailable'),
		),
	]
}

/** Failures to collect results; an add-on rejecting a pairing is a result. */
export function collectionFailures(run: AnkiRunResult): string[] {
	if (run.status !== 'ok') {
		return [`Anki ${run.release.version}: ${run.status}: ${run.detail ?? ''}`]
	}

	const failures = run.combinations
		.filter(
			(combination) =>
				combination.status === 'launch-failed' || combination.status === 'probe-failed',
		)
		.map(
			(combination) =>
				`Anki ${run.release.version}, AnkiConnect ${combination.ankiConnectVersion}: ${combination.status}: ${combination.detail ?? ''}`,
		)
	for (const combination of run.combinations) {
		for (const failure of infrastructureFailures(combination)) {
			failures.push(
				`Anki ${run.release.version}, AnkiConnect ${combination.ankiConnectVersion}: infrastructure: ${failure}`,
			)
		}
	}

	const requested = run.ankiConnectVersions ?? []
	for (const version of requested) {
		if (run.combinations.every((combination) => combination.ankiConnectVersion !== version)) {
			failures.push(`Anki ${run.release.version}, AnkiConnect ${version}: missing result`)
		}
	}

	return failures
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
