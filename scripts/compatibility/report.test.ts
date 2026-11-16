import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, afterEach, expect, it, vi } from 'vitest'
import type { Baseline } from './baseline.ts'
import type { ActionStatus, AnkiRunResult, CombinationResult } from './shared.ts'
import { readBaseline } from './baseline.ts'
import { buildReport } from './report.ts'
import { collectionFailures } from './shared.ts'

vi.mock('../list-actions.ts', () => ({
	getYankiConnectMethodTree: () => ({
		miscellaneous: [{ minimumAnki: '2.1.15', minimumAnkiConnect: '22.2.19.0', name: 'version' }],
	}),
}))

const CONNECT = '22.2.19.0'
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'yanki-report-tests-'))

afterAll(() => {
	fs.rmSync(directory, { force: true, recursive: true })
})

afterEach(() => {
	for (const file of fs.readdirSync(directory)) {
		fs.rmSync(path.join(directory, file))
	}
})

function run(
	version: string,
	status: ActionStatus = 'ok',
	combinationStatus: CombinationResult['status'] = 'tested',
): AnkiRunResult {
	return {
		ankiConnectVersions: [CONNECT],
		combinations: [
			{
				actions: combinationStatus === 'tested' ? { version: { status } } : {},
				ankiConnectVersion: CONNECT,
				status: combinationStatus,
			},
		],
		release: { source: 'pypi', spec: `aqt==${version}`, version },
		status: 'ok',
	}
}

function baseline(version = '2.1.15', ankiConnect = CONNECT): Baseline {
	return {
		actions: { 'miscellaneous.version': { results: { [version]: { [ankiConnect]: 'ok' } } } },
		generatedAt: '2026-11-16T00:00:00.000Z',
	}
}

it.each(['enabled', 'disabled'] as const)(
	'rejects diagnostic focus %s results as compatibility evidence',
	(focus) => {
		expect(() => buildReport([{ ...run('2.1.49'), diagnosticFocus: focus }])).toThrow(
			'GUI diagnostic experiments cannot be used in compatibility reports or baselines',
		)
	},
)

it.each(['enabled', 'disabled'] as const)(
	'rejects diagnostic sandbox %s results as compatibility evidence',
	(sandbox) => {
		expect(() => buildReport([{ ...run('2.1.49'), diagnosticSandbox: sandbox }])).toThrow(
			'GUI diagnostic experiments cannot be used in compatibility reports or baselines',
		)
	},
)

it('does not raise documented minimums when the oldest Anki could not launch', () => {
	const failed: AnkiRunResult = { ...run('2.1.15'), combinations: [], status: 'launch-failed' }
	const report = buildReport([failed, run('2.1.20')])
	expect(report.actions['miscellaneous.version']).toMatchObject({
		documented: { minimumAnki: '2.1.15' },
		empirical: { minimumAnki: '2.1.20' },
		exceptions: [],
		verdict: 'inconclusive',
	})
	expect(report.collectionFailures).toHaveLength(1)
	expect(report.comparison.regressions).toEqual([])
})

it('reports incompatible pairings separately from missing coverage', () => {
	const report = buildReport([run('2.1.15'), run('26.09', 'ok', 'addon-failed')])
	expect(report.actions['miscellaneous.version']?.results['26.09']?.[CONNECT]).toBe('incompatible')
	expect(report.collectionFailures).toEqual([])
	expect(report.comparison.regressions).toEqual([])
	expect(report.comparison.baselineGeneratedAt).toBeUndefined()
})

it.each(['error', 'failed', 'signature'] as const)(
	'detects a previously supported action becoming %s',
	(status) => {
		const report = buildReport([run('2.1.15', status)], { baseline: baseline() })
		expect(report.comparison.regressions).toEqual([
			{
				action: 'miscellaneous.version',
				anki: '2.1.15',
				ankiConnect: CONNECT,
				status,
			},
		])
		expect(report.comparison.unverified).toEqual([])
	},
)

it('detects an add-on load failure on a previously working pairing as a regression', () => {
	const report = buildReport([run('2.1.15', 'ok', 'addon-failed')], { baseline: baseline() })
	expect(report.comparison.regressions[0]?.status).toBe('incompatible')
	expect(report.collectionFailures).toEqual([])
})

it.each(['skipped', 'untestable'] as const)(
	'reports a previously supported action becoming %s as missing coverage',
	(status) => {
		const report = buildReport([run('2.1.15', status)], { baseline: baseline() })
		expect(report.comparison.regressions).toEqual([])
		expect(report.comparison.unverified).toHaveLength(1)
	},
)

it('reports host failures as missing coverage and collection failures, not incompatibility', () => {
	const report = buildReport([run('2.1.15', 'infrastructure')], { baseline: baseline() })
	expect(report.comparison.regressions).toEqual([])
	expect(report.comparison.unverified[0]?.status).toBe('infrastructure')
	expect(report.collectionFailures).toHaveLength(1)
	expect(report.actions['miscellaneous.version']?.exceptions).toEqual([])
	expect(report.actions['miscellaneous.version']?.verdict).toBe('inconclusive')
})

it('separates changed probe assertions from regressions against legacy baselines', () => {
	const current = { ...run('2.1.15', 'failed'), probeRevisions: { version: 2 } }
	const report = buildReport([current], { baseline: baseline() })
	expect(report.actions['miscellaneous.version']?.results['2.1.15']?.[CONNECT]).toBe('failed')
	expect(report.comparison.regressions).toEqual([])
	expect(report.comparison.compared).toBe(0)
	expect(report.comparison.changedProbes).toEqual([
		{ action: 'miscellaneous.version', baselineRevision: 1, currentRevision: 2, observations: 1 },
	])
	const accepted = baseline()
	accepted.actions['miscellaneous.version']!.probeRevision = 2
	expect(buildReport([current], { baseline: accepted }).comparison.regressions).toHaveLength(1)
})

it('does not silently mix artifacts made by different probe revisions', () => {
	const report = buildReport([run('2.1.15'), { ...run('2.1.20'), probeRevisions: { version: 2 } }])
	expect(report.collectionFailures).toEqual([
		'Mixed probe revisions for version: 1, 2; collect all results with the same probe suite',
	])
})

it('keeps filtered-out observations out of changed-probe counts', () => {
	const report = buildReport([{ ...run('2.1.20'), probeRevisions: { version: 2 } }], {
		baseline: baseline(),
	})
	expect(report.comparison.notSelected).toBe(1)
	expect(report.comparison.changedProbes).toEqual([])
})

it('treats an Anki launch failure as lost coverage rather than a compatibility regression', () => {
	const report = buildReport([{ ...run('2.1.15'), combinations: [], status: 'launch-failed' }], {
		baseline: baseline(),
	})
	expect(report.comparison.regressions).toEqual([])
	expect(report.comparison.unverified[0]?.status).toBe('untested')
	expect(report.collectionFailures).toHaveLength(1)
})

it('detects a missing release artifact using the selected matrix', () => {
	const report = buildReport([run('2.1.20')], {
		ankiConnectVersions: [CONNECT],
		ankiReleases: [run('2.1.15').release, run('2.1.20').release],
		baseline: baseline(),
	})
	expect(report.collectionFailures[0]).toContain('No result artifact')
	expect(report.comparison.unverified).toHaveLength(1)
	expect(report.actions['miscellaneous.version']?.verdict).toBe('inconclusive')
})

it('detects missing combinations and action outcomes', () => {
	const missingCombination = buildReport([{ ...run('2.1.15'), combinations: [] }])
	expect(missingCombination.collectionFailures[0]).toContain('missing result')
	const missingAction = run('2.1.15')
	missingAction.combinations[0]!.actions = {}
	const report = buildReport([missingAction], { baseline: baseline() })
	expect(report.collectionFailures[0]).toContain('missing action result version')
	expect(report.comparison.unverified).toHaveLength(1)
})

it('allows newly explored incompatibilities and reports excluded baseline observations', () => {
	const report = buildReport([run('2.1.20', 'ok', 'addon-failed')], { baseline: baseline() })
	expect(report.comparison).toMatchObject({
		compared: 0,
		notSelected: 1,
		regressions: [],
		unverified: [],
	})
	expect(report.collectionFailures).toEqual([])
})

it('does not gate new action failures against baseline failures', () => {
	const accepted = baseline()
	accepted.actions['miscellaneous.version']!.results['2.1.15']![CONNECT] = 'error'
	const report = buildReport([run('2.1.15', 'failed')], { baseline: accepted })
	expect(report.actions['miscellaneous.version']?.verdict).toBe('mismatch')
	expect(report.comparison.regressions).toEqual([])
})

it('compares equivalent calendar versions without treating them as new observations', () => {
	const report = buildReport([run('26.08', 'failed')], { baseline: baseline('26.8.0', '22.02.19') })
	expect(report.comparison.compared).toBe(1)
	expect(report.comparison.regressions).toHaveLength(1)
})

it('reports a missing baseline action as lost coverage', () => {
	const accepted = baseline()
	accepted.actions['miscellaneous.removed'] = accepted.actions['miscellaneous.version']!
	const report = buildReport([run('2.1.15')], { baseline: accepted })
	expect(report.comparison.unverified[0]?.action).toBe('miscellaneous.removed')
})

it('fails collection only for infrastructure problems, preserving discovery findings', () => {
	expect(collectionFailures(run('2.1.15', 'failed'))).toEqual([])
	expect(collectionFailures(run('2.1.15', 'ok', 'addon-failed'))).toEqual([])
	expect(collectionFailures(run('2.1.15', 'ok', 'probe-failed'))).toHaveLength(1)
	expect(collectionFailures(run('2.1.15', 'ok', 'launch-failed'))).toHaveLength(1)
})

it('reads legacy accepted reports and rejects malformed or empty baselines', () => {
	const file = path.join(directory, 'baseline.json')
	fs.writeFileSync(file, JSON.stringify(baseline()))
	expect(readBaseline(file)).toEqual(baseline())
	fs.writeFileSync(file, '{}')
	expect(() => readBaseline(file)).toThrow('Invalid compatibility baseline')
	fs.writeFileSync(file, JSON.stringify({ actions: {}, generatedAt: '2026-11-16' }))
	expect(() => readBaseline(file)).toThrow('no supported observations')
	const invalid = baseline()
	invalid.actions['miscellaneous.version']!.results['2.1.15']![CONNECT] = 'unknown'
	fs.writeFileSync(file, JSON.stringify(invalid))
	expect(() => readBaseline(file)).toThrow('Invalid AnkiConnect version or status')
	const invalidRevision = baseline()
	invalidRevision.actions['miscellaneous.version']!.probeRevision = -1
	fs.writeFileSync(file, JSON.stringify(invalidRevision))
	expect(() => readBaseline(file)).toThrow('Invalid probe revision')
	fs.writeFileSync(
		file,
		JSON.stringify({ ...baseline(), collectionFailures: ['Media server stopped'] }),
	)
	expect(() => readBaseline(file)).toThrow('unresolved collection failures')
})
