import { expect, it, vi } from 'vitest'
import type { Actions } from '../../src/types/shared'
import { GuiInfrastructureError, GuiStateTimeoutError } from './gui-state.ts'
import { BehaviorError, runProbeCase } from './probe-case.ts'
import { buildReport } from './report.ts'

vi.mock('../list-actions.ts', () => ({
	getYankiConnectMethodTree: () => ({
		graphical: ['guiShowQuestion', 'guiShowAnswer', 'guiAnswerCard'].map((name) => ({
			minimumAnki: '2.1.15',
			minimumAnkiConnect: '22.2.19.0',
			name,
		})),
	}),
}))

it('reports an unsuccessful answer transition once and skips the dependent API call', async () => {
	const calls: Actions[] = []
	const transition = vi
		.fn<() => Promise<void>>()
		.mockRejectedValue(new GuiStateTimeoutError('Reviewer stayed on the question side'))
	const showAnswer = vi.fn(async () => {
		calls.push('guiShowAnswer')
		await transition()
	})
	const answerCard = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
	const shown = await runProbeCase('guiShowAnswer', showAnswer, calls, {
		guiShowQuestion: { status: 'ok' },
	})
	const answered = await runProbeCase('guiAnswerCard', answerCard, calls, { guiShowAnswer: shown })
	expect(shown).toMatchObject({ status: 'failed' })
	expect(answered).toMatchObject({
		detail: 'Requires guiShowAnswer: Reviewer stayed on the question side',
		status: 'skipped',
	})
	expect(showAnswer).toHaveBeenCalledOnce()
	expect(answerCard).not.toHaveBeenCalled()
	expect(calls).toEqual(['guiShowAnswer'])

	const report = buildReport(
		[
			{
				combinations: [
					{
						actions: {
							guiAnswerCard: answered,
							guiShowAnswer: shown,
							guiShowQuestion: { status: 'ok' },
						},
						ankiConnectVersion: '25.11.2.0',
						status: 'tested',
					},
				],
				release: { source: 'pypi', spec: 'aqt==25.7.4', version: '25.07.4' },
				status: 'ok',
			},
		],
		{
			baseline: {
				actions: Object.fromEntries(
					['graphical.guiShowAnswer', 'graphical.guiAnswerCard'].map((action) => [
						action,
						{ results: { '25.07.4': { '25.11.2.0': 'ok' } } },
					]),
				),
				generatedAt: '2026-11-16T00:00:00.000Z',
			},
		},
	)
	expect(report.comparison.regressions).toEqual([
		{
			action: 'graphical.guiShowAnswer',
			anki: '25.07.4',
			ankiConnect: '25.11.2.0',
			status: 'failed',
		},
	])
	expect(report.comparison.unverified).toEqual([
		{
			action: 'graphical.guiAnswerCard',
			anki: '25.07.4',
			ankiConnect: '25.11.2.0',
			status: 'skipped',
		},
	])
})

it('reports a readiness failure before the target call as unavailable coverage', async () => {
	// An earlier invocation of the same API cannot count as this probe's call.
	const calls: Actions[] = ['guiShowQuestion']
	const result = await runProbeCase(
		'guiShowQuestion',
		vi
			.fn<() => Promise<void>>()
			.mockRejectedValue(new GuiStateTimeoutError('Reviewer page has not loaded')),
		calls,
		{ guiDeckReview: { status: 'ok' } },
	)
	expect(result).toMatchObject({ status: 'skipped' })
	expect(calls).toEqual(['guiShowQuestion'])
})

it('preserves an infrastructure failure across dependent GUI actions', async () => {
	const task = vi
		.fn<() => Promise<void>>()
		.mockRejectedValue(new GuiInfrastructureError('Anki media server stopped'))
	const calls: Actions[] = ['guiDeckReview']
	const review = await runProbeCase('guiDeckReview', task, calls, {})
	const question = await runProbeCase('guiShowQuestion', task, calls, { guiDeckReview: review })
	expect(review.status).toBe('infrastructure')
	expect(question).toEqual(review)
	expect(task).toHaveBeenCalledOnce()
})

it.each(['guiBrowse', 'guiExitAnki'] as const)(
	'does not run %s after a host failure',
	async (action) => {
		const host = {
			guiDeckBrowser: { detail: 'Media server stopped', status: 'infrastructure' as const },
		}
		const task = vi.fn<() => Promise<void>>()
		expect(await runProbeCase(action, task, [], host)).toEqual(host.guiDeckBrowser)
		expect(task).not.toHaveBeenCalled()
	},
)

it('still records shutdown API failures when the host has not failed', async () => {
	const calls: Actions[] = []
	const request = vi.fn<() => Promise<void>>().mockRejectedValue(new Error('fetch failed'))
	expect(
		await runProbeCase(
			'guiExitAnki',
			async () => {
				calls.push('guiExitAnki')
				await request()
			},
			calls,
			{},
		),
	).toEqual({ detail: 'fetch failed', status: 'error' })
	expect(calls).toEqual(['guiExitAnki'])
})

it('skips question display immediately when review entry failed', async () => {
	const task = vi.fn<() => Promise<void>>()
	const question = await runProbeCase('guiShowQuestion', task, [], {
		guiDeckReview: { detail: 'Overview still displayed', status: 'failed' },
	})
	expect(question).toEqual({
		detail: 'Requires guiDeckReview: Overview still displayed',
		status: 'skipped',
	})
	expect(task).not.toHaveBeenCalled()
})

it.each([
	new Error('API rejected the request'),
	new BehaviorError('Expected true, received false'),
])('preserves API and behavior failures without retrying', async (error) => {
	const calls: Actions[] = []
	const request = vi.fn<() => Promise<void>>().mockRejectedValue(error)
	const task = vi.fn(async () => {
		calls.push('guiAnswerCard')
		await request()
	})
	const result = await runProbeCase('guiAnswerCard', task, calls, {
		guiShowAnswer: { status: 'ok' },
	})
	expect(result.status).toBe(error instanceof BehaviorError ? 'failed' : 'error')
	expect(task).toHaveBeenCalledOnce()
})

it('allows the dependent action after a successful answer transition', async () => {
	const calls: Actions[] = []
	const request = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
	const result = await runProbeCase(
		'guiAnswerCard',
		async () => {
			calls.push('guiAnswerCard')
			await request()
		},
		calls,
		{ guiShowAnswer: { status: 'ok' } },
	)
	expect(result.status).toBe('ok')
	expect(calls).toEqual(['guiAnswerCard'])
})
