import { expect, it, vi } from 'vitest'
import type { Actions } from '../../src/types/shared'
import type { CombinationResult } from './shared.ts'
import { runProbeCase } from './probe-case.ts'
import { retryInfrastructure } from './retry.ts'
import { collectionFailures } from './shared.ts'

function result(status: 'failed' | 'infrastructure' | 'ok'): CombinationResult {
	return {
		actions: {
			guiDeckReview: {
				detail: status === 'infrastructure' ? 'Anki media server stopped' : 'Reviewer observation',
				status,
			},
		},
		ankiConnectVersion: '23.2.5.0',
		status: 'tested',
	}
}

it('retries a dead host once and retains the failed attempt after recovery', async () => {
	const attempt = vi
		.fn<(number: number) => Promise<CombinationResult>>()
		.mockResolvedValueOnce(result('infrastructure'))
		.mockResolvedValueOnce(result('ok'))
	const recovered = await retryInfrastructure(attempt)
	expect(attempt.mock.calls).toEqual([[1], [2]])
	expect(recovered.actions.guiDeckReview?.status).toBe('ok')
	expect(recovered.attempts?.map((value) => value.failures)).toEqual([
		['Anki media server stopped'],
		[],
	])
})

it('keeps persistent infrastructure failures as collection failures after the retry', async () => {
	const attempt = vi
		.fn<(number: number) => Promise<CombinationResult>>()
		.mockResolvedValue(result('infrastructure'))
	const failed = await retryInfrastructure(attempt)
	expect(attempt).toHaveBeenCalledTimes(2)
	expect(failed.actions.guiDeckReview?.status).toBe('infrastructure')
	expect(
		collectionFailures({
			combinations: [failed],
			release: { source: 'pypi', spec: 'unused', version: '2.1.52' },
			status: 'ok',
		}),
	).toHaveLength(1)
})

it('never retries or hides behavior failures', async () => {
	const attempt = vi
		.fn<(number: number) => Promise<CombinationResult>>()
		.mockResolvedValue(result('failed'))
	const failed = await retryInfrastructure(attempt)
	expect(attempt).toHaveBeenCalledOnce()
	expect(failed.actions.guiDeckReview?.status).toBe('failed')
	expect(failed.attempts).toBeUndefined()
})

it('does not erase an unrelated API failure when retrying a host failure', async () => {
	const first = result('infrastructure')
	first.actions.version = { detail: 'Unexpected API version', status: 'failed' }
	const second = result('ok')
	second.actions.version = { status: 'ok' }
	const attempt = vi
		.fn<(attempt: number) => Promise<CombinationResult>>()
		.mockResolvedValueOnce(first)
		.mockResolvedValueOnce(second)
	const recovered = await retryInfrastructure(attempt)
	expect(recovered.actions.guiDeckReview?.status).toBe('ok')
	expect(recovered.actions.version).toEqual({
		detail: 'Earlier attempt: Unexpected API version',
		status: 'failed',
	})
})

it('does not preserve a shutdown regression from an already failed host', async () => {
	const shutdown = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
	const recovered = await retryInfrastructure(async (attempt) => {
		const current = result(attempt === 1 ? 'infrastructure' : 'ok')
		const calls: Actions[] = []
		current.actions.guiExitAnki = await runProbeCase(
			'guiExitAnki',
			async () => {
				calls.push('guiExitAnki')
				await shutdown()
			},
			calls,
			current.actions,
		)
		return current
	})
	expect(shutdown).toHaveBeenCalledOnce()
	expect(recovered.actions.guiExitAnki).toEqual({ status: 'ok' })
	expect(recovered.attempts?.map((attempt) => attempt.failures)).toEqual([
		['Anki media server stopped'],
		[],
	])
})
