import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import type { ActionStatus, AnkiRunResult } from './shared.ts'
import { getYankiConnectMethodTree } from '../list-actions.ts'
import { compareVersions } from './shared.ts'

type Minimums = { minimumAnki: string; minimumAnkiConnect: string }
type Status = 'untested' | ActionStatus
type Combination = [anki: string, ankiConnect: string]
type Verdict = 'confirmed' | 'mismatch' | 'untestable'

/**
 * Lower-left corner of the supported region, plus unsupported combinations
 * above it.
 */
type Empirical = Minimums & { exceptions: Combination[] }

type ActionReport = {
	details: Record<string, Record<string, string>>
	documented: Minimums
	/** Absent when no tested combination fully supports the action. */
	empirical?: Empirical
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

function documentedMinimums(): Map<string, Minimums & { group: string }> {
	const documented = new Map<string, Minimums & { group: string }>()
	for (const [group, actions] of Object.entries(getYankiConnectMethodTree())) {
		for (const action of actions) {
			documented.set(action.name, {
				group,
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

type ActionResults = {
	details: Record<string, Record<string, string>>
	results: Record<string, Record<string, Status>>
	supported: Combination[]
	tested: Combination[]
	untestable: boolean
}

function collectActionResults(
	name: string,
	runs: AnkiRunResult[],
	ankiConnectVersions: string[],
): ActionResults {
	const collected: ActionResults = {
		details: {},
		results: {},
		supported: [],
		tested: [],
		untestable: false,
	}
	for (const run of runs) {
		const anki = run.release.version
		collected.results[anki] = {}
		collected.details[anki] = {}
		for (const ankiConnect of ankiConnectVersions) {
			const combination = run.combinations.find(
				(candidate) => candidate.ankiConnectVersion === ankiConnect,
			)
			const outcome = combination?.status === 'tested' ? combination.actions[name] : undefined
			collected.results[anki][ankiConnect] = outcome?.status ?? 'untested'
			if (outcome?.detail !== undefined) {
				collected.details[anki][ankiConnect] = outcome.detail
			}

			if (outcome === undefined || outcome.status === 'untestable') {
				collected.untestable ||= outcome !== undefined
				continue
			}

			collected.tested.push([anki, ankiConnect])
			if (outcome.status === 'ok') {
				collected.supported.push([anki, ankiConnect])
			}
		}
	}

	return collected
}

function empiricalMinimums(supported: Combination[], tested: Combination[]): Empirical | undefined {
	if (supported.length === 0) {
		return undefined
	}

	const corner: Minimums = {
		minimumAnki: supported.map(([anki]) => anki).sort(compareVersions)[0]!,
		minimumAnkiConnect: supported.map(([, ankiConnect]) => ankiConnect).sort(compareVersions)[0]!,
	}
	const exceptions = tested.filter(
		([anki, ankiConnect]) =>
			compareVersions(anki, corner.minimumAnki) >= 0 &&
			compareVersions(ankiConnect, corner.minimumAnkiConnect) >= 0 &&
			supported.every(([a, c]) => a !== anki || c !== ankiConnect),
	)
	return { ...corner, exceptions }
}

function verdict(documented: Minimums, empirical: Empirical | undefined): Verdict {
	return empirical?.exceptions.length === 0 &&
		compareVersions(empirical.minimumAnki, documented.minimumAnki) === 0 &&
		compareVersions(empirical.minimumAnkiConnect, documented.minimumAnkiConnect) === 0
		? 'confirmed'
		: 'mismatch'
}

/**
 * Merge per-release results into one compatibility table and compare each
 * action's empirical minimums with the minimums documented in the client.
 */
export function buildReport(runs: AnkiRunResult[]): CompatibilityReport {
	const sortedRuns = runs.toSorted((a, b) => compareVersions(a.release.version, b.release.version))
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
			minimumAnki: sortedRuns[0]?.release.version ?? '',
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
		const { details, results, supported, tested, untestable } = collectActionResults(
			name,
			sortedRuns,
			ankiConnectVersions,
		)
		const empirical = empiricalMinimums(supported, tested)
		report.actions[`${group}.${name}`] = {
			details,
			documented,
			...(empirical !== undefined && { empirical }),
			results,
			verdict: untestable ? 'untestable' : verdict(documented, empirical),
		}
	}

	return report
}

function describeMismatch(name: string, action: ActionReport): string {
	const { documented, empirical } = action
	if (empirical === undefined) {
		return `- \`${name}\`: documented Anki ${documented.minimumAnki} and AnkiConnect ${documented.minimumAnkiConnect}, but never fully supported in any tested combination.`
	}

	const differences: string[] = []
	if (compareVersions(documented.minimumAnki, empirical.minimumAnki) !== 0) {
		differences.push(
			`Anki ${documented.minimumAnki} documented, ${empirical.minimumAnki} empirical`,
		)
	}

	if (compareVersions(documented.minimumAnkiConnect, empirical.minimumAnkiConnect) !== 0) {
		differences.push(
			`AnkiConnect ${documented.minimumAnkiConnect} documented, ${empirical.minimumAnkiConnect} empirical`,
		)
	}

	if (empirical.exceptions.length > 0) {
		differences.push(
			`${String(empirical.exceptions.length)} unsupported combination(s) above the empirical minimums`,
		)
	}

	return `- \`${name}\`: ${differences.join('; ')}.`
}

/**
 * One line per distinct failure message, so each cause appears once with an
 * example combination.
 */
function describeFailures(action: ActionReport): string[] {
	const distinct = new Map<string, string>()
	for (const [anki, byConnect] of Object.entries(action.details)) {
		for (const [ankiConnect, detail] of Object.entries(byConnect)) {
			const status = action.results[anki]?.[ankiConnect] ?? 'untested'
			const line = `  - Anki ${anki}, AnkiConnect ${ankiConnect}: ${status}: ${detail}`
			const message = line.replace(FAILURE_PREFIX, '')
			if (!distinct.has(message)) {
				distinct.set(message, line)
			}
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
		'| Action | Documented Anki | Empirical Anki | Documented AnkiConnect | Empirical AnkiConnect | Verdict |',
		'| --- | --- | --- | --- | --- | --- |',
	]
	for (const [name, action] of Object.entries(report.actions)) {
		const { documented, empirical } = action
		const exceptions =
			empirical !== undefined && empirical.exceptions.length > 0
				? ` (${String(empirical.exceptions.length)} exception(s))`
				: ''
		lines.push(
			`| \`${name}\` | ${documented.minimumAnki} | ${empirical?.minimumAnki ?? '—'} | ${documented.minimumAnkiConnect} | ${empirical?.minimumAnkiConnect ?? '—'}${exceptions} | ${action.verdict} |`,
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
		`Oldest tested: Anki ${report.oldestTested.minimumAnki} and AnkiConnect ${report.oldestTested.minimumAnkiConnect}. An empirical minimum equal to one of these means the true minimum may be lower.`,
		'',
		'Each action in `src/client.ts` documents its requirements with `@minimumAnki` and `@minimumAnkiConnect` JSDoc tags, plus `@see` links to the upstream source at the minimum AnkiConnect release. The `actionList` rule in `mdat.config.ts` regenerates the readme table from those tags; run `pnpm fix` afterwards.',
		'',
		'For each finding below, decide whether the documented minimums are wrong (update the tags and `@see` links) or whether the declared parameter or result types promise more than AnkiConnect provides (adjust the types in `src/types/*.ts`, keeping them accurate for the latest release). An unsupported combination above the empirical minimums means the action stopped working in a later release, or depends on the Anki version in a way two minimums cannot express; document that in the action description. Verify each change against the upstream source linked from the action.',
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
