import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import type { ActionStatus, AnkiRunResult } from './shared.ts'
import { getYankiConnectMethodTree } from '../list-actions.ts'
import { compareVersions } from './shared.ts'

type Minimums = { minimumAnki: string; minimumAnkiConnect: string }
type Documented = Minimums & { maximumAnkiConnect?: string }
type Status = 'untested' | ActionStatus
type Combination = [anki: string, ankiConnect: string]
type Verdict = 'confirmed' | 'mismatch' | 'untestable'

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
	results: Record<string, Record<string, Status>>
	verdict: Verdict
}

type CombinationSummary = { detail?: string; ok?: number; status: string }

export type CompatibilityReport = {
	actions: Record<string, ActionReport>
	anki: Record<
		string,
		{ detail?: string; reportedVersion?: string; source: string; status: string }
	>
	ankiConnect: string[]
	combinations: Record<string, Record<string, CombinationSummary>>
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
		return { detail: combination.detail ?? '', status: combination.status }
	}

	const ok = Object.values(combination.actions).filter((outcome) => outcome.status === 'ok')
	return { ok: ok.length, status: 'tested' }
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
			grid.results[anki][ankiConnect] = outcome?.status ?? 'untested'
			if (outcome?.detail !== undefined) {
				grid.details[anki][ankiConnect] = outcome.detail
			}

			grid.untestable ||= outcome?.status === 'untestable'
			const tested =
				outcome !== undefined && outcome.status !== 'untestable' && outcome.status !== 'skipped'
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

/**
 * Merge per-release results into one compatibility table and verify each
 * action's documented minimums: every tested combination above them must be
 * supported, and no lower minimums may have that property.
 */
export function buildReport(runs: AnkiRunResult[]): CompatibilityReport {
	const sortedRuns = runs.toSorted((a, b) => compareVersions(a.release.version, b.release.version))
	const ankiVersions = sortedRuns.map((run) => run.release.version)
	const ankiConnectVersions = [
		...new Set(
			sortedRuns.flatMap((run) =>
				run.combinations.map((combination) => combination.ankiConnectVersion),
			),
		),
	].sort(compareVersions)

	const report: CompatibilityReport = {
		actions: {},
		anki: {},
		ankiConnect: ankiConnectVersions,
		combinations: {},
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
			source: run.release.source,
			status: run.status,
		}
		report.combinations[version] = Object.fromEntries(
			ankiConnectVersions.map((ankiConnect) => [
				ankiConnect,
				summarizeCombination(run, ankiConnect),
			]),
		)
	}

	for (const [name, { group, ...documented }] of documentedMinimums()) {
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
		let verdict: Verdict = 'mismatch'
		if (grid.untestable) {
			verdict = 'untestable'
		} else if (
			empirical !== undefined &&
			exceptions.length === 0 &&
			beyondMaximum.length === 0 &&
			sameMinimums(documented, empirical)
		) {
			verdict = 'confirmed'
		}

		report.actions[`${group}.${name}`] = {
			beyondMaximum,
			details: grid.details,
			documented,
			...(empirical !== undefined && { empirical }),
			exceptions,
			results: grid.results,
			verdict,
		}
	}

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

function summaryMarkdown(report: CompatibilityReport): string {
	const mismatches = Object.values(report.actions).filter((action) => action.verdict === 'mismatch')
	const lines = [
		'# Compatibility',
		'',
		`Tested ${String(Object.keys(report.anki).length)} Anki releases against ${String(report.ankiConnect.length)} AnkiConnect releases. Oldest tested: Anki ${report.oldestTested.minimumAnki}, AnkiConnect ${report.oldestTested.minimumAnkiConnect}.`,
		'',
		mismatches.length === 0
			? 'Every documented minimum matches the empirical results.'
			: `${String(mismatches.length)} action(s) have documented minimums that do not match the empirical results.`,
		'',
		'| Action | Documented Anki | Documented AnkiConnect | Lowest fully supported Anki | Lowest fully supported AnkiConnect | Exceptions | Verdict |',
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

	const failedReleases = Object.entries(report.anki)
		.filter(([, release]) => release.status !== 'ok')
		.map(([version, release]) => `- Anki ${version}: ${release.status}: ${release.detail ?? ''}`)
	const untested = Object.entries(report.combinations).flatMap(([anki, byConnect]) =>
		Object.entries(byConnect)
			.filter(([, combination]) => combination.status !== 'tested')
			.map(
				([ankiConnect, combination]) =>
					`- Anki ${anki}, AnkiConnect ${ankiConnect}: ${combination.status}`,
			),
	)
	if (failedReleases.length > 0 || untested.length > 0) {
		lines.push('', '## Not tested', '', ...failedReleases, ...untested)
	}

	return lines.join('\n')
}

/** A self-contained prompt for an LLM to reconcile the source with the results. */
function promptMarkdown(report: CompatibilityReport): string {
	const lines = findings(report)
	return [
		'# Align documented AnkiConnect compatibility with empirical results',
		'',
		'The compatibility workflow for `yanki-connect` ran every client action end-to-end against every combination of Anki and AnkiConnect releases listed below. For an action to count as supported in a combination, the call had to succeed with every documented parameter, behave as documented, and return a value that type-checks against the declared `ResultForAction` type in `src/types/*.ts`. Partial support does not count.',
		'',
		`Tested Anki releases: ${Object.keys(report.anki).join(', ')}.`,
		'',
		`Tested AnkiConnect releases: ${report.ankiConnect.join(', ')}.`,
		'',
		`Oldest tested: Anki ${report.oldestTested.minimumAnki} and AnkiConnect ${report.oldestTested.minimumAnkiConnect}. A minimum equal to one of these means the true minimum may be lower.`,
		'',
		'Documented minimums are confirmed when every tested combination above them (up to any documented maximum) is supported and no lower minimums have that property. Each action in `src/client.ts` documents its requirements with `@minimumAnki` and `@minimumAnkiConnect` JSDoc tags (plus `@maximumAnkiConnect` when a later release removed the action) and `@see` links to the upstream source at the minimum AnkiConnect release. The `actionList` rule in `mdat.config.ts` regenerates the readme table from those tags; run `pnpm fix` afterwards.',
		'',
		'For each finding below, decide whether the documented minimums are wrong (update the tags and `@see` links) or whether the declared parameter or result types promise more than AnkiConnect provides (adjust the types in `src/types/*.ts`, keeping them accurate for the latest release). When no minimums cover every tested combination, a later release removed or broke the action; document that in the action description and, for removals, add `@maximumAnkiConnect`. Verify each change against the upstream source linked from the action.',
		'',
		'## Findings',
		'',
		...(lines.length === 0 ? ['None. Every documented minimum matches.'] : lines),
		'',
		'The full per-combination results are in `compatibility.json` next to this file.',
	].join('\n')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const { values } = parseArgs({
		options: {
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
	if (runs.length === 0) {
		throw new Error(`No result files found in ${values.results}`)
	}

	const report = buildReport(runs)
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
	const mismatches = Object.values(report.actions).filter((action) => action.verdict === 'mismatch')
	if (mismatches.length > 0) {
		console.error(
			`\n${String(mismatches.length)} action(s) have documented minimums that do not match the empirical results. See compatibility-prompt.md.`,
		)
		process.exitCode = 1
	}
}
