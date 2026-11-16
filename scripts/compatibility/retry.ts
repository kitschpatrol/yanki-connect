import type { CombinationResult } from './shared.ts'
import { infrastructureFailures } from './shared.ts'

/** Retry explicit host failures once in a fresh profile, never API failures. */
export async function retryInfrastructure(
	task: (attempt: number) => Promise<CombinationResult>,
): Promise<CombinationResult> {
	const attempts: NonNullable<CombinationResult['attempts']> = []
	let previous: CombinationResult | undefined
	for (let attempt = 1; ; attempt++) {
		const result = await task(attempt)
		const failures = infrastructureFailures(result)
		attempts.push({ failures, status: result.status })
		if (previous !== undefined && result.status === 'tested') {
			// A host retry must not erase a genuine failure already observed by
			// another probe. Both full attempts remain in the artifact.
			for (const [action, outcome] of Object.entries(previous.actions)) {
				if (
					['error', 'failed', 'signature'].includes(outcome.status) &&
					result.actions[action]?.status === 'ok'
				) {
					result.actions[action] = {
						...outcome,
						detail: `Earlier attempt: ${outcome.detail ?? outcome.status}`,
					}
				}
			}
		}

		if (attempt === 2 || failures.length === 0) {
			return attempts.length === 1 ? result : { ...result, attempts }
		}

		previous = result
	}
}
