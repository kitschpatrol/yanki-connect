import { execa } from 'execa'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import type { CompatibilityReport } from './report.ts'
import type { AnkiRunResult } from './shared.ts'
import { getYankiConnectMethodTree } from '../list-actions.ts'

it('writes the probe artifact before exiting unsuccessfully when installation fails', async () => {
	const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'yanki-probe-cli-'))
	const output = path.join(directory, 'results', 'anki.json')
	try {
		const result = await execa(
			process.execPath,
			[
				'scripts/compatibility/run.ts',
				'--anki-release',
				JSON.stringify({
					source: 'github',
					url: 'data:text/plain,invalid-archive',
					version: '2.1.15',
				}),
				'--anki-connect-versions',
				JSON.stringify(['22.2.19.0']),
				'--install-directory',
				path.join(directory, 'install'),
				'--output',
				output,
			],
			{ reject: false },
		)
		expect(result.exitCode).toBe(1)
		const saved = JSON.parse(await fs.readFile(output, 'utf8')) as AnkiRunResult
		expect(saved.status).toBe('install-failed')
		expect(saved.ankiConnectVersions).toEqual(['22.2.19.0'])
		expect(result.stderr).toContain('Anki 2.1.15: install-failed')
	} finally {
		await fs.rm(directory, { force: true, recursive: true })
	}
})

it('writes reports before failing regressions, and allows discovery mismatches', async () => {
	const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'yanki-report-cli-'))
	const results = path.join(directory, 'results')
	const output = path.join(directory, 'report')
	const accepted = path.join(directory, 'accepted.json')
	try {
		const actions = Object.fromEntries(
			Object.values(getYankiConnectMethodTree()).flatMap((group) =>
				group.map(({ name }) => [name, { status: name === 'version' ? 'failed' : 'untestable' }]),
			),
		)
		await fs.mkdir(results)
		await fs.writeFile(
			path.join(results, 'anki.json'),
			JSON.stringify({
				combinations: [{ actions, ankiConnectVersion: '22.2.19.0', status: 'tested' }],
				release: { source: 'pypi', spec: 'unused', version: '2.1.15' },
				status: 'ok',
			}),
		)
		const args = ['scripts/compatibility/report.ts', '--results', results, '--output', output]
		const discovery = await execa(process.execPath, args, { reject: false })
		expect(discovery.exitCode).toBe(0)
		expect(discovery.stdout).toContain('regression checking is not configured')
		const readReport = async () =>
			JSON.parse(
				await fs.readFile(path.join(output, 'compatibility.json'), 'utf8'),
			) as CompatibilityReport
		const discoveryReport = await readReport()
		expect(discoveryReport.actions['miscellaneous.version']?.verdict).toBe('mismatch')
		await fs.writeFile(
			accepted,
			JSON.stringify({
				actions: { 'miscellaneous.version': { results: { '2.1.15': { '22.2.19.0': 'ok' } } } },
				generatedAt: '2026-11-16T00:00:00.000Z',
			}),
		)
		const regression = await execa(process.execPath, [...args, '--baseline', accepted], {
			reject: false,
		})
		expect(regression.exitCode).toBe(1)
		const regressionReport = await readReport()
		expect(regressionReport.comparison.regressions).toHaveLength(1)
		expect(await fs.readFile(path.join(output, 'summary.md'), 'utf8')).toContain('ok → failed')
		expect(await fs.readFile(path.join(output, 'compatibility-prompt.md'), 'utf8')).toContain(
			'Baseline comparison',
		)
		const currentRun = JSON.parse(
			await fs.readFile(path.join(results, 'anki.json'), 'utf8'),
		) as AnkiRunResult
		currentRun.probeRevisions = { version: 2 }
		await fs.writeFile(path.join(results, 'anki.json'), JSON.stringify(currentRun))
		const revised = await execa(process.execPath, [...args, '--baseline', accepted], {
			reject: false,
		})
		expect(revised.exitCode).toBe(0)
		expect(revised.stdout).toContain('Changed probe: `miscellaneous.version`, revision 1 → 2')
		const revisedReport = await readReport()
		expect(revisedReport.actions['miscellaneous.version']?.results['2.1.15']?.['22.2.19.0']).toBe(
			'failed',
		)
		const missingBaseline = await execa(
			process.execPath,
			[...args, '--baseline', path.join(directory, 'missing.json')],
			{ reject: false },
		)
		expect(missingBaseline.exitCode).toBe(1)
		expect(missingBaseline.stdout).not.toContain('regression checking is not configured')
	} finally {
		await fs.rm(directory, { force: true, recursive: true })
	}
}, 30_000)

it('writes an incomplete report when no selected release produced an artifact', async () => {
	const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'yanki-empty-report-'))
	const output = path.join(directory, 'report')
	try {
		const result = await execa(
			process.execPath,
			[
				'scripts/compatibility/report.ts',
				'--results',
				directory,
				'--output',
				output,
				'--anki-releases',
				JSON.stringify([{ source: 'pypi', spec: 'unused', version: '2.1.15' }]),
				'--anki-connect-versions',
				JSON.stringify(['22.2.19.0']),
			],
			{ reject: false },
		)
		expect(result.exitCode).toBe(1)
		const report = JSON.parse(
			await fs.readFile(path.join(output, 'compatibility.json'), 'utf8'),
		) as CompatibilityReport
		expect(report.collectionFailures[0]).toContain('No result artifact')
		expect(report.actions['miscellaneous.version']?.verdict).toBe('inconclusive')
	} finally {
		await fs.rm(directory, { force: true, recursive: true })
	}
}, 30_000)

it('retains runtime workarounds in the JSON, summary, and reconciliation prompt', async () => {
	const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'yanki-runtime-report-'))
	const results = path.join(directory, 'results')
	const output = path.join(directory, 'report')
	const note = 'QTWEBENGINE_DISABLE_SANDBOX=1 for legacy QtWebEngine.'
	try {
		const actions = Object.fromEntries(
			Object.values(getYankiConnectMethodTree()).flatMap((group) =>
				group.map(({ name }) => [name, { status: 'untestable' }]),
			),
		)
		await fs.mkdir(results)
		for (const version of ['2.1.45', '2.1.49', '2.1.50']) {
			await fs.writeFile(
				path.join(results, `${version}.json`),
				JSON.stringify({
					combinations: [{ actions, ankiConnectVersion: '23.10.29.0', status: 'tested' }],
					release: { source: 'github', url: 'https://example.test/anki.tar.bz2', version },
					runtimeNotes: version === '2.1.50' ? undefined : [note],
					status: 'ok',
				}),
			)
		}

		const result = await execa(
			process.execPath,
			['scripts/compatibility/report.ts', '--results', results, '--output', output],
			{ reject: false },
		)
		expect(result.exitCode).toBe(0)
		const report = JSON.parse(
			await fs.readFile(path.join(output, 'compatibility.json'), 'utf8'),
		) as CompatibilityReport
		expect(report.anki['2.1.45']?.runtimeNotes).toEqual([note])
		expect(report.anki['2.1.49']?.runtimeNotes).toEqual([note])
		expect(report.anki['2.1.50']?.runtimeNotes).toBeUndefined()
		for (const file of ['summary.md', 'compatibility-prompt.md']) {
			const text = await fs.readFile(path.join(output, file), 'utf8')
			expect(text).toContain(`- Anki 2.1.45, 2.1.49: ${note}`)
			expect(text.split(note)).toHaveLength(2)
		}
	} finally {
		await fs.rm(directory, { force: true, recursive: true })
	}
}, 30_000)
