import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import type { Baseline, BaselineComparison } from './baseline.ts'
import type { ActionStatus, AnkiRelease, AnkiRunResult, CombinationResult } from './shared.ts'
import { getYankiConnectMethodTree } from '../list-actions.ts'
import { compareBaseline, readBaseline } from './baseline.ts'
import { collectionFailures, compareVersions } from './shared.ts'

type Minimums = { minimumAnki: string; minimumAnkiConnect: string }
type Documented = Minimums & { maximumAnkiConnect?: string }
type Status = 'incompatible' | 'untested' | ActionStatus
type Combination = [anki: string, ankiConnect: string]
type Verdict = 'confirmed' | 'inconclusive' | 'mismatch' | 'untestable'

type ActionReport = {
	/**
	 * Supported combinations with an AnkiConnect release beyond the documented
	 * maximum.
	 */
	beyondMaximum: Combination[]
	details: Record<string, Record<string, string>>
	documented: Documented
	/**
	 * The lowest minimums above which every tested combination (up to any
	 * documented maximum) is supported. Absent when no such minimums exist.
	 */
	empirical?: Minimums
	/** Tested combinations above the documented minimums that are not supported. */
	exceptions: Combination[]
	probeRevision: number
	results: Record<string, Record<string, Status>>
	verdict: Verdict
}

type CombinationSummary = {
	attempts?: CombinationResult['attempts']
	detail?: string
	ok?: number
	status: string
}

export type CompatibilityReport = {
	actions: Record<string, ActionReport>
	anki: Record<
		string,
		{
			detail?: string
			reportedVersion?: string
			runtimeNotes?: string[]
			source: string
			status: string
		}
	>
	ankiConnect: string[]
	collectionFailures: string[]
	combinations: Record<string, Record<string, CombinationSummary>>
	comparison: BaselineComparison
	generatedAt: string
	oldestTested: Minimums
}

const FAILURE_PREFIX = /^ {2}- Anki [^,]+, AnkiConnect [^:]+: /v
const FINDING_EXAMPLES = 6

function documentedMinimums(): Map<string, Documented & { group: string }> {
	const documented = new Map<string, Documented & { group: string }>()
	for (const [group, actions] of Object.entries(getYankiConnectMethodTree())) {
		for (const action of actions) {
			documented.set(action.name, {
				group,
				...(action.maximumAnkiConnect !== undefined && {
					maximumAnkiConnect: action.maximumAnkiConnect,
				}),
				minimumAnki: action.minimumAnki,
				minimumAnkiConnect: action.minimumAnkiConnect,
			})
		}
	}

	return documented
}

function summarizeCombination(run: AnkiRunResult, ankiConnect: string): CombinationSummary {
	const combination = run.combinations.find(
		(candidate) => candidate.ankiConnectVersion === ankiConnect,
	)
	if (combination === undefined) {
		return { status: run.status === 'ok' ? 'untested' : run.status }
	}

	if (combination.status !== 'tested') {
		return {
			...(combination.attempts !== undefined && { attempts: combination.attempts }),
			detail: combination.detail ?? '',
			status: combination.status,
		}
	}

	const ok = Object.values(combination.actions).filter((outcome) => outcome.status === 'ok')
	return {
		...(combination.attempts !== undefined && { attempts: combination.attempts }),
		ok: ok.length,
		status: 'tested',
	}
}

/**
 * One action's outcomes on the Anki × AnkiConnect grid. `ok` and `tested` are
 * indexed by Anki version then AnkiConnect version; skipped outcomes count as
 * untested because the action never ran.
 */
type ActionGrid = {
	details: Record<string, Record<string, string>>
	ok: boolean[][]
	results: Record<string, Record<string, Status>>
	tested: boolean[][]
	untestable: boolean
}

function collectActionGrid(
	name: string,
	runs: AnkiRunResult[],
	ankiConnectVersions: string[],
): ActionGrid {
	const grid: ActionGrid = { details: {}, ok: [], results: {}, tested: [], untestable: false }
	for (const run of runs) {
		const anki = run.release.version
		grid.results[anki] = {}
		grid.details[anki] = {}
		const okRow: boolean[] = []
		const testedRow: boolean[] = []
		for (const ankiConnect of ankiConnectVersions) {
			const combination = run.combinations.find(
				(candidate) => candidate.ankiConnectVersion === ankiConnect,
			)
			const outcome = combination?.status === 'tested' ? combination.actions[name] : undefined
			grid.results[anki][ankiConnect] =
				combination?.status === 'addon-failed' ? 'incompatible' : (outcome?.status ?? 'untested')
			if (outcome?.detail !== undefined) {
				grid.details[anki][ankiConnect] = outcome.detail
			}

			grid.untestable ||= outcome?.status === 'untestable'
			const tested =
				outcome !== undefined &&
				!['infrastructure', 'skipped', 'untestable'].includes(outcome.status)
			testedRow.push(tested)
			okRow.push(tested && outcome.status === 'ok')
		}

		grid.ok.push(okRow)
		grid.tested.push(testedRow)
	}

	return grid
}

/**
 * Counts of `true` cells at or after each (row, column), with an extra zero row
 * and column.
 */
function suffixCounts(cells: boolean[][], columns: number): Uint32Array[] {
	const counts = Array.from({ length: cells.length + 1 }, () => new Uint32Array(columns + 1))
	for (let row = cells.length - 1; row >= 0; row--) {
		for (let column = columns - 1; column >= 0; column--) {
			counts[row]![column] =
				(cells[row]![column] === true ? 1 : 0) +
				counts[row + 1]![column]! +
				counts[row]![column + 1]! -
				counts[row + 1]![column + 1]!
		}
	}

	return counts
}

/**
 * The lowest minimums (by Anki version, then AnkiConnect version) above which
 * every tested combination up to the maximum is supported, and which are
 * themselves reached by supported combinations.
 */
function minimalCleanCorner(
	grid: ActionGrid,
	ankiVersions: string[],
	ankiConnectVersions: string[],
	maximumAnkiConnect: string | undefined,
): Minimums | undefined {
	const within = ankiConnectVersions.map(
		(ankiConnect) =>
			maximumAnkiConnect === undefined || compareVersions(ankiConnect, maximumAnkiConnect) <= 0,
	)
	const columns = ankiConnectVersions.length
	const bad = grid.tested.map((row, anki) =>
		row.map(
			(tested, ankiConnect) =>
				tested && grid.ok[anki]![ankiConnect] !== true && within[ankiConnect] === true,
		),
	)
	const good = grid.ok.map((row) =>
		row.map((ok, ankiConnect) => ok && within[ankiConnect] === true),
	)
	const badCounts = suffixCounts(bad, columns)
	const goodCounts = suffixCounts(good, columns)
	for (const [anki, version] of ankiVersions.entries()) {
		for (const [ankiConnect, ankiConnectVersion] of ankiConnectVersions.entries()) {
			const goodAbove = goodCounts[anki]![ankiConnect]!
			const goodInRow = goodAbove - goodCounts[anki + 1]![ankiConnect]!
			const goodInColumn = goodAbove - goodCounts[anki]![ankiConnect + 1]!
			if (badCounts[anki]![ankiConnect] === 0 && goodInRow > 0 && goodInColumn > 0) {
				return { minimumAnki: version, minimumAnkiConnect: ankiConnectVersion }
			}
		}
	}

	return undefined
}

function combinationsWhere(
	ankiVersions: string[],
	ankiConnectVersions: string[],
	predicate: (anki: number, ankiConnect: number) => boolean,
): Combination[] {
	const combinations: Combination[] = []
	for (const [anki, version] of ankiVersions.entries()) {
		for (const [ankiConnect, ankiConnectVersion] of ankiConnectVersions.entries()) {
			if (predicate(anki, ankiConnect)) {
				combinations.push([version, ankiConnectVersion])
			}
		}
	}

	return combinations
}

function sameMinimums(a: Minimums, b: Minimums): boolean {
	return (
		compareVersions(a.minimumAnki, b.minimumAnki) === 0 &&
		compareVersions(a.minimumAnkiConnect, b.minimumAnkiConnect) === 0
	)
}

function minimumVerdict(
	documented: Documented,
	empirical: Minimums | undefined,
	evidence: { beyondMaximum: number; exceptions: number; unknown: number; untestable: boolean },
): Verdict {
	if (evidence.untestable) {
		return 'untestable'
	}

	if (
		evidence.exceptions > 0 ||
		evidence.beyondMaximum > 0 ||
		(empirical !== undefined &&
			(compareVersions(empirical.minimumAnki, documented.minimumAnki) < 0 ||
				compareVersions(empirical.minimumAnkiConnect, documented.minimumAnkiConnect) < 0))
	) {
		return 'mismatch'
	}

	if (empirical !== undefined && evidence.unknown === 0 && sameMinimums(documented, empirical)) {
		return 'confirmed'
	}

	return 'inconclusive'
}

function missingActionResults(run: AnkiRunResult, names: string[]): string[] {
	return run.combinations
		.filter((combination) => combination.status === 'tested')
		.flatMap((combination) =>
			names
				.filter((name) => combination.actions[name] === undefined)
				.map(
					(name) =>
						`Anki ${run.release.version}, AnkiConnect ${combination.ankiConnectVersion}: missing action result ${name}`,
				),
		)
}

/**
 * Merge per-release results into one compatibility table and verify each
 * action's documented minimums: every tested combination above them must be
 * supported, and no lower minimums may have that property.
 */
export function buildReport(
	runs: AnkiRunResult[],
	options: {
		ankiConnectVersions?: string[]
		ankiReleases?: AnkiRelease[]
		baseline?: Baseline
	} = {},
): CompatibilityReport {
	if (
		runs.some((run) => run.diagnosticFocus !== undefined || run.diagnosticSandbox !== undefined)
	) {
		throw new Error(
			'GUI diagnostic experiments cannot be used in compatibility reports or baselines',
		)
	}

	const selectedRuns =
		options.ankiReleases?.map(
			(release): AnkiRunResult =>
				runs.find((run) => compareVersions(run.release.version, release.version) === 0) ?? {
					combinations: [],
					detail: 'No result artifact was produced for this release',
					release,
					status: 'probe-failed',
				},
		) ?? runs
	const sortedRuns = selectedRuns.toSorted((a, b) =>
		compareVersions(a.release.version, b.release.version),
	)
	const ankiVersions = sortedRuns.map((run) => run.release.version)
	const ankiConnectVersions = (
		options.ankiConnectVersions ?? [
			...new Set(
				sortedRuns.flatMap(
					(run) =>
						run.ankiConnectVersions ??
						run.combinations.map((combination) => combination.ankiConnectVersion),
				),
			),
		]
	).toSorted(compareVersions)
	if (ankiVersions.length === 0 || ankiConnectVersions.length === 0) {
		throw new Error('Cannot report an empty compatibility matrix')
	}

	const documentedActions = documentedMinimums()

	const report: CompatibilityReport = {
		actions: {},
		anki: {},
		ankiConnect: ankiConnectVersions,
		collectionFailures: sortedRuns.flatMap((run) =>
			collectionFailures({ ...run, ankiConnectVersions }),
		),
		combinations: {},
		comparison: { changedProbes: [], compared: 0, notSelected: 0, regressions: [], unverified: [] },
		generatedAt: new Date().toISOString(),
		oldestTested: {
			minimumAnki: ankiVersions[0] ?? '',
			minimumAnkiConnect: ankiConnectVersions[0] ?? '',
		},
	}

	for (const run of sortedRuns) {
		const { version } = run.release
		report.anki[version] = {
			...(run.detail !== undefined && { detail: run.detail }),
			...(run.reportedVersion !== undefined && { reportedVersion: run.reportedVersion }),
			...(run.runtimeNotes !== undefined && { runtimeNotes: run.runtimeNotes }),
			source: run.release.source,
			status: run.status,
		}
		report.combinations[version] = Object.fromEntries(
			ankiConnectVersions.map((ankiConnect) => [
				ankiConnect,
				summarizeCombination(run, ankiConnect),
			]),
		)
		report.collectionFailures.push(...missingActionResults(run, documentedActions.keys().toArray()))
	}

	for (const [name, { group, ...documented }] of documentedActions) {
		const revisions = [
			...new Set(
				sortedRuns
					.filter((run) => run.status === 'ok')
					.map((run) => run.probeRevisions?.[name] ?? 1),
			),
		]
		if (revisions.length > 1) {
			report.collectionFailures.push(
				`Mixed probe revisions for ${name}: ${revisions.join(', ')}; collect all results with the same probe suite`,
			)
		}

		const grid = collectActionGrid(name, sortedRuns, ankiConnectVersions)
		const { maximumAnkiConnect } = documented
		const empirical = minimalCleanCorner(
			grid,
			ankiVersions,
			ankiConnectVersions,
			maximumAnkiConnect,
		)
		const exceptions = combinationsWhere(
			ankiVersions,
			ankiConnectVersions,
			(anki, ankiConnect) =>
				grid.tested[anki]![ankiConnect] === true &&
				grid.ok[anki]![ankiConnect] !== true &&
				compareVersions(ankiVersions[anki]!, documented.minimumAnki) >= 0 &&
				compareVersions(ankiConnectVersions[ankiConnect]!, documented.minimumAnkiConnect) >= 0 &&
				(maximumAnkiConnect === undefined ||
					compareVersions(ankiConnectVersions[ankiConnect]!, maximumAnkiConnect) <= 0),
		)
		const beyondMaximum =
			maximumAnkiConnect === undefined
				? []
				: combinationsWhere(
						ankiVersions,
						ankiConnectVersions,
						(anki, ankiConnect) =>
							grid.ok[anki]![ankiConnect] === true &&
							compareVersions(ankiConnectVersions[ankiConnect]!, maximumAnkiConnect) > 0,
					)
		const unknown = combinationsWhere(ankiVersions, ankiConnectVersions, (anki, ankiConnect) => {
			const status = grid.results[ankiVersions[anki]!]![ankiConnectVersions[ankiConnect]!]
			return (
				(status === 'untested' || status === 'skipped' || status === 'infrastructure') &&
				compareVersions(ankiVersions[anki]!, documented.minimumAnki) >= 0 &&
				compareVersions(ankiConnectVersions[ankiConnect]!, documented.minimumAnkiConnect) >= 0 &&
				(maximumAnkiConnect === undefined ||
					compareVersions(ankiConnectVersions[ankiConnect]!, maximumAnkiConnect) <= 0)
			)
		})
		const verdict = minimumVerdict(documented, empirical, {
			beyondMaximum: beyondMaximum.length,
			exceptions: exceptions.length,
			unknown: unknown.length,
			untestable: grid.untestable,
		})

		report.actions[`${group}.${name}`] = {
			beyondMaximum,
			details: grid.details,
			documented,
			probeRevision: Math.max(1, ...revisions),
			...(empirical !== undefined && { empirical }),
			exceptions,
			results: grid.results,
			verdict,
		}
	}

	report.comparison = compareBaseline(report, options.baseline)
	return report
}

function describeMismatch(name: string, action: ActionReport): string {
	const { beyondMaximum, documented, empirical, exceptions } = action
	const problems: string[] = []
	if (exceptions.length > 0) {
		problems.push(
			`${String(exceptions.length)} tested combination(s) above the documented minimums are not supported`,
		)
	}

	if (beyondMaximum.length > 0) {
		problems.push(
			`${String(beyondMaximum.length)} supported combination(s) are beyond the documented maximum AnkiConnect ${documented.maximumAnkiConnect ?? ''}`,
		)
	}

	if (empirical === undefined) {
		problems.push('no minimums cover every tested combination above them')
	} else if (!sameMinimums(documented, empirical)) {
		problems.push(
			`the lowest fully supported minimums are Anki ${empirical.minimumAnki} and AnkiConnect ${empirical.minimumAnkiConnect}`,
		)
	}

	return `- \`${name}\` (documented Anki ${documented.minimumAnki}, AnkiConnect ${documented.minimumAnkiConnect}${documented.maximumAnkiConnect === undefined ? '' : ` to ${documented.maximumAnkiConnect}`}): ${problems.join('; ')}.`
}

/**
 * One line per distinct failure message among the exceptions, so each cause
 * appears once with an example combination.
 */
function describeFailures(action: ActionReport): string[] {
	const distinct = new Map<string, string>()
	for (const [anki, ankiConnect] of action.exceptions) {
		const status = action.results[anki]?.[ankiConnect] ?? 'untested'
		const detail = action.details[anki]?.[ankiConnect] ?? ''
		const line = `  - Anki ${anki}, AnkiConnect ${ankiConnect}: ${status}: ${detail}`
		const message = line.replace(FAILURE_PREFIX, '')
		if (!distinct.has(message)) {
			distinct.set(message, line)
		}
	}

	return distinct.values().take(FINDING_EXAMPLES).toArray()
}

function findings(report: CompatibilityReport): string[] {
	return Object.entries(report.actions)
		.filter(([, action]) => action.verdict === 'mismatch')
		.flatMap(([name, action]) => [describeMismatch(name, action), ...describeFailures(action)])
}

function comparisonMarkdown(report: CompatibilityReport): string[] {
	const { comparison } = report
	if (comparison.baselineGeneratedAt === undefined) {
		return [
			'No accepted baseline selected. This run discovers compatibility; regression checking is not configured.',
		]
	}

	return [
		`Accepted baseline generated ${comparison.baselineGeneratedAt}. Compared ${String(comparison.compared)} previously supported action/Anki/AnkiConnect combinations; ${String(comparison.notSelected)} were outside this run's selected versions.`,
		'',
		`${String(comparison.regressions.length)} regression(s); ${String(comparison.unverified.length)} previously supported combination(s) could not be verified.`,
		'',
		...comparison.changedProbes.map(
			(change) =>
				`- Changed probe: \`${change.action}\`, revision ${String(change.baselineRevision)} → ${String(change.currentRevision)}. ${String(change.observations)} observations need a new baseline; these assertions are not comparable to the accepted run.`,
		),
		...comparison.regressions
			.slice(0, 20)
			.map(
				(change) =>
					`- Regression: \`${change.action}\`, Anki ${change.anki}, AnkiConnect ${change.ankiConnect}: ok → ${change.status}`,
			),
		...comparison.unverified
			.slice(0, 20)
			.map(
				(change) =>
					`- Missing coverage: \`${change.action}\`, Anki ${change.anki}, AnkiConnect ${change.ankiConnect}: ${change.status}`,
			),
		'',
		'Full regression and missing-coverage lists are in compatibility.json.',
	]
}

function loadingBoundaries(report: CompatibilityReport): string[] {
	const versions = Object.keys(report.anki).toSorted(compareVersions)
	const lines = [
		'## Add-on loading boundaries',
		'',
		'Ranges cover consecutive surveyed releases only. Loading successfully does not imply that every action is supported; action outcomes are recorded separately.',
		'',
		'| AnkiConnect | Loaded on Anki | Incompatible pairings | Untested pairings |',
		'| --- | --- | --- | --- |',
	]
	for (const ankiConnect of report.ankiConnect) {
		const ranges: string[] = []
		let first: string | undefined
		let last: string | undefined
		let incompatible = 0
		let untested = 0
		for (const version of [...versions, undefined]) {
			const status =
				version === undefined ? undefined : report.combinations[version]?.[ankiConnect]?.status
			if (status === 'tested') {
				first ??= version
				last = version
				continue
			}

			if (first !== undefined) {
				ranges.push(first === last ? first : `${first}–${last ?? first}`)
				first = undefined
			}

			if (status === 'addon-failed') {
				incompatible++
			} else if (version !== undefined) {
				untested++
			}
		}

		lines.push(
			`| ${ankiConnect} | ${ranges.length > 0 ? ranges.join(', ') : '—'} | ${String(incompatible)} | ${String(untested)} |`,
		)
	}

	return lines
}

function runtimeMarkdown(report: CompatibilityReport): string[] {
	const byNote = new Map<string, string[]>()
	for (const [version, run] of Object.entries(report.anki)) {
		const notes = run.runtimeNotes ?? []
		for (const note of notes) {
			const versions = byNote.get(note) ?? []
			versions.push(version)
			byNote.set(note, versions)
		}
	}

	return byNote.size === 0
		? []
		: [
				'## Runtime workarounds',
				'',
				'These observations use runtime adjustments in disposable Linux profiles. GUI focus and readiness assertions remain enabled.',
				'',
				...byNote.entries().map(([note, versions]) => `- Anki ${versions.join(', ')}: ${note}`),
			]
}

function summaryMarkdown(report: CompatibilityReport): string {
	const mismatches = Object.values(report.actions).filter((action) => action.verdict === 'mismatch')
	const inconclusive = Object.values(report.actions).filter(
		(action) => action.verdict === 'inconclusive',
	)
	const lines = [
		'# Compatibility',
		'',
		`Surveyed ${String(Object.keys(report.anki).length)} Anki releases against ${String(report.ankiConnect.length)} AnkiConnect releases. Oldest selected: Anki ${report.oldestTested.minimumAnki}, AnkiConnect ${report.oldestTested.minimumAnkiConnect}.`,
		'',
		...comparisonMarkdown(report),
		'',
		`${String(report.collectionFailures.length)} collection failure(s). ${String(mismatches.length)} documentation mismatch(es); ${String(inconclusive.length)} inconclusive action(s). Documentation findings are informational. Missing coverage is not evidence for raising a documented minimum.`,
		'',
		...runtimeMarkdown(report),
		'',
		...attemptsMarkdown(report),
		'',
		...loadingBoundaries(report),
		'',
		'## Action minimums',
		'',
		'Observed minimums apply where the add-on loads and the action was tested. Incompatible pairings are outside this action-level calculation.',
		'',
		'| Action | Documented Anki | Documented AnkiConnect | Observed Anki | Observed AnkiConnect | Exceptions | Verdict |',
		'| --- | --- | --- | --- | --- | --- | --- |',
	]
	for (const [name, action] of Object.entries(report.actions)) {
		const { documented, empirical } = action
		const documentedAnkiConnect =
			documented.maximumAnkiConnect === undefined
				? documented.minimumAnkiConnect
				: `${documented.minimumAnkiConnect} to ${documented.maximumAnkiConnect}`
		lines.push(
			`| \`${name}\` | ${documented.minimumAnki} | ${documentedAnkiConnect} | ${empirical?.minimumAnki ?? '—'} | ${empirical?.minimumAnkiConnect ?? '—'} | ${String(action.exceptions.length + action.beyondMaximum.length)} | ${action.verdict} |`,
		)
	}

	const untested = Object.entries(report.combinations).flatMap(([anki, byConnect]) =>
		Object.entries(byConnect)
			.filter(
				([, combination]) =>
					combination.status !== 'tested' && combination.status !== 'addon-failed',
			)
			.map(
				([ankiConnect, combination]) =>
					`- Anki ${anki}, AnkiConnect ${ankiConnect}: ${combination.status}`,
			),
	)
	if (report.collectionFailures.length > 0 || untested.length > 0) {
		lines.push(
			'',
			'## Incomplete coverage',
			'',
			...report.collectionFailures.map((failure) => `- ${failure}`),
			...untested,
		)
	}

	return lines.join('\n')
}

function attemptsMarkdown(report: CompatibilityReport): string[] {
	const retried = Object.entries(report.combinations).flatMap(([anki, row]) =>
		Object.entries(row)
			.filter(([, result]) => (result.attempts?.length ?? 0) > 1)
			.map(([ankiConnect, result]) => ({ anki, ankiConnect, result })),
	)
	if (retried.length === 0) {
		return []
	}

	return [
		'## Infrastructure retries',
		'',
		'Only explicit host failures are retried, once in a fresh profile. API and behavior failures are never retried. All attempt logs and results are retained.',
		'',
		...retried.map(
			({ anki, ankiConnect, result }) =>
				`- Anki ${anki}, AnkiConnect ${ankiConnect}: ${result.attempts?.at(-1)?.failures.length === 0 && result.status === 'tested' ? 'recovered' : 'unresolved'}; ${result.attempts?.[0]?.failures.join('; ') ?? ''}`,
		),
	]
}

/** A self-contained prompt for an LLM to reconcile the source with the results. */
function promptMarkdown(report: CompatibilityReport): string {
	const lines = findings(report)
	return [
		'# Align documented AnkiConnect compatibility with empirical results',
		'',
		'The compatibility workflow for `yanki-connect` attempted the Anki and AnkiConnect combinations listed below. For an action to count as supported, the call had to succeed with every documented parameter, behave as documented, and return a value that type-checks against the declared `ResultForAction` type in `src/types/*.ts`. Partial support does not count. Add-on incompatibility and missing coverage are separate outcomes.',
		'',
		`Selected Anki releases: ${Object.keys(report.anki).join(', ')}.`,
		'',
		`Selected AnkiConnect releases: ${report.ankiConnect.join(', ')}.`,
		'',
		`Oldest selected: Anki ${report.oldestTested.minimumAnki} and AnkiConnect ${report.oldestTested.minimumAnkiConnect}. Observed minimums are bounded by the selected versions and available coverage.`,
		'',
		'Documented minimums are confirmed when every tested combination above them (up to any documented maximum) is supported and no lower minimums have that property. Each action in `src/client.ts` documents its requirements with `@minimumAnki` and `@minimumAnkiConnect` JSDoc tags (plus `@maximumAnkiConnect` when a later release removed the action) and `@see` links to the upstream source at the minimum AnkiConnect release. The `actionList` rule in `mdat.config.ts` regenerates the readme table from those tags; run `pnpm fix` afterwards.',
		'',
		'Never raise a documented minimum solely because an older Anki release could not launch, an artifact is missing, or an action was skipped. Those findings are inconclusive. Action minimums are conditional on the add-on loading; consult the loading boundaries separately. Documentation mismatches do not fail discovery runs. Only regressions against the explicitly accepted baseline and failures to collect or reverify results fail the report.',
		'',
		'For each finding below, decide whether the documented minimums are wrong (update the tags and `@see` links) or whether the declared parameter or result types promise more than AnkiConnect provides (adjust the types in `src/types/*.ts`, keeping them accurate for the latest release). When no minimums cover every tested combination, a later release removed or broke the action; document that in the action description and, for removals, add `@maximumAnkiConnect`. Verify each change against the upstream source linked from the action.',
		'',
		...runtimeMarkdown(report),
		'',
		'## Findings',
		'',
		...(lines.length === 0
			? [
					'No demonstrated documentation mismatches. Check summary.md for inconclusive results and coverage gaps.',
				]
			: lines),
		'',
		'## Baseline comparison',
		'',
		...comparisonMarkdown(report),
		'',
		'The full per-combination results are in `compatibility.json` next to this file.',
	].join('\n')
}

/** Write artifacts before failing for regressions or incomplete collection. */
function main(): void {
	const { values } = parseArgs({
		options: {
			'anki-connect-versions': { type: 'string' },
			'anki-releases': { type: 'string' },
			baseline: { type: 'string' },
			output: { default: 'compatibility', type: 'string' },
			results: { default: 'results', type: 'string' },
		},
	})
	const runs = fs
		.readdirSync(values.results)
		.filter((file) => file.endsWith('.json'))
		.map(
			(file) =>
				JSON.parse(fs.readFileSync(path.join(values.results, file), 'utf8')) as AnkiRunResult,
		)
	if (runs.length === 0 && values['anki-releases'] === undefined) {
		throw new Error(`No result files found in ${values.results}`)
	}

	const report = buildReport(runs, {
		...(values['anki-releases'] !== undefined && {
			ankiReleases: JSON.parse(values['anki-releases']) as AnkiRelease[],
		}),
		...(values['anki-connect-versions'] !== undefined && {
			ankiConnectVersions: JSON.parse(values['anki-connect-versions']) as string[],
		}),
		...(values.baseline !== undefined && { baseline: readBaseline(values.baseline) }),
	})
	fs.mkdirSync(values.output, { recursive: true })
	fs.writeFileSync(
		path.join(values.output, 'compatibility.json'),
		JSON.stringify(report, undefined, '\t'),
	)
	fs.writeFileSync(path.join(values.output, 'compatibility-prompt.md'), promptMarkdown(report))
	const summary = summaryMarkdown(report)
	fs.writeFileSync(path.join(values.output, 'summary.md'), summary)
	if (process.env.GITHUB_STEP_SUMMARY !== undefined) {
		fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`)
	}

	console.log(summary)
	const { comparison } = report
	if (
		report.collectionFailures.length === 0 &&
		comparison.regressions.length === 0 &&
		comparison.unverified.length === 0
	) {
		return
	}

	console.error(
		`\nCompatibility failed: ${String(report.collectionFailures.length)} collection failure(s), ${String(comparison.regressions.length)} regression(s), ${String(comparison.unverified.length)} unverified baseline observation(s). See summary.md.`,
	)
	process.exitCode = 1
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	main()
}
