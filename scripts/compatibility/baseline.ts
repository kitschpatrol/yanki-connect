import fs from 'node:fs'
import type { CompatibilityReport } from './report.ts'
import { parseVersion } from './shared.ts'

type ActionResults = Record<string, Record<string, string>>

/** Only observations are reused from an explicitly accepted report. */
export type Baseline = {
	actions: Record<string, { probeRevision?: number; results: ActionResults }>
	generatedAt: string
}

type Change = {
	action: string
	anki: string
	ankiConnect: string
	status: string
}

export type BaselineComparison = {
	baselineGeneratedAt?: string
	changedProbes: Array<{
		action: string
		baselineRevision: number
		currentRevision: number
		observations: number
	}>
	compared: number
	notSelected: number
	regressions: Change[]
	unverified: Change[]
}

const STATUSES = new Set([
	'error',
	'failed',
	'incompatible',
	'infrastructure',
	'ok',
	'signature',
	'skipped',
	'untestable',
	'untested',
])
const VERSION = /^\d+(?:\.\d+)+$/v

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isRevision(value: unknown): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1
}

/**
 * Read current or legacy report artifacts, rejecting invalid or empty
 * baselines.
 */
export function readBaseline(file: string): Baseline {
	const value: unknown = JSON.parse(fs.readFileSync(file, 'utf8'))
	if (!isRecord(value) || typeof value.generatedAt !== 'string' || !isRecord(value.actions)) {
		throw new Error(`Invalid compatibility baseline: ${file}`)
	}

	if (Array.isArray(value.collectionFailures) && value.collectionFailures.length > 0) {
		throw new Error(`Baseline has unresolved collection failures: ${file}`)
	}

	let successes = 0
	for (const action of Object.values(value.actions)) {
		if (!isRecord(action) || !isRecord(action.results)) {
			throw new Error(`Invalid action results in baseline: ${file}`)
		}

		if (action.probeRevision !== undefined && !isRevision(action.probeRevision)) {
			throw new Error(`Invalid probe revision in baseline: ${file}`)
		}

		for (const [anki, row] of Object.entries(action.results)) {
			if (!VERSION.test(anki) || !isRecord(row)) {
				throw new Error(`Invalid Anki version or results in baseline: ${file}`)
			}

			for (const [ankiConnect, status] of Object.entries(row)) {
				if (typeof status !== 'string' || !VERSION.test(ankiConnect) || !STATUSES.has(status)) {
					throw new Error(`Invalid AnkiConnect version or status in baseline: ${file}`)
				}

				if (status === 'ok') {
					successes++
				}
			}
		}
	}

	if (successes === 0) {
		throw new Error(`Baseline contains no supported observations: ${file}`)
	}

	return value as Baseline
}

function versionKey(version: string): string {
	const parts = parseVersion(version)
	while (parts.length > 1 && parts.at(-1) === 0) {
		parts.pop()
	}

	return parts.join('.')
}

function normalizeResults(results: ActionResults): ActionResults {
	return Object.fromEntries(
		Object.entries(results).map(([anki, row]) => [
			versionKey(anki),
			Object.fromEntries(
				Object.entries(row).map(([ankiConnect, status]) => [versionKey(ankiConnect), status]),
			),
		]),
	)
}

/** Compare only previously supported observations within the selected matrix. */
export function compareBaseline(
	report: CompatibilityReport,
	baseline?: Baseline,
): BaselineComparison {
	const comparison: BaselineComparison = {
		changedProbes: [],
		compared: 0,
		notSelected: 0,
		regressions: [],
		unverified: [],
	}
	if (baseline === undefined) {
		return comparison
	}

	comparison.baselineGeneratedAt = baseline.generatedAt
	const ankiVersions = new Set(Object.keys(report.anki).map((version) => versionKey(version)))
	const ankiConnectVersions = new Set(report.ankiConnect.map((version) => versionKey(version)))
	for (const [action, previous] of Object.entries(baseline.actions)) {
		const current = normalizeResults(report.actions[action]?.results ?? {})
		const baselineRevision = previous.probeRevision ?? 1
		const currentRevision = report.actions[action]?.probeRevision ?? baselineRevision
		let changedObservations = 0
		for (const [anki, row] of Object.entries(previous.results)) {
			for (const [ankiConnect, previousStatus] of Object.entries(row)) {
				if (previousStatus !== 'ok') {
					continue
				}

				if (
					!ankiVersions.has(versionKey(anki)) ||
					!ankiConnectVersions.has(versionKey(ankiConnect))
				) {
					comparison.notSelected++
					continue
				}

				if (currentRevision !== baselineRevision) {
					changedObservations++
					continue
				}

				comparison.compared++
				const status = current[versionKey(anki)]?.[versionKey(ankiConnect)] ?? 'untested'
				const change = { action, anki, ankiConnect, status }
				if (['error', 'failed', 'incompatible', 'signature'].includes(status)) {
					comparison.regressions.push(change)
				} else if (status !== 'ok') {
					comparison.unverified.push(change)
				}
			}
		}

		if (changedObservations > 0) {
			comparison.changedProbes.push({
				action,
				baselineRevision,
				currentRevision,
				observations: changedObservations,
			})
		}
	}

	return comparison
}
