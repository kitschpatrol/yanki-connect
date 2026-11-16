import type { Actions } from '../../src/types/shared'
import type { ActionOutcome } from './shared.ts'
import { GuiInfrastructureError, GuiStateTimeoutError } from './gui-state.ts'
import { truncate } from './shared.ts'

/** An earlier action did not produce the state required by this probe. */
export class SkipError extends Error {}

/** A successful response did not produce the documented behavior. */
export class BehaviorError extends Error {}

const PREREQUISITES: Partial<Record<Actions, Actions>> = {
	guiAnswerCard: 'guiShowAnswer',
	guiShowAnswer: 'guiShowQuestion',
	guiShowQuestion: 'guiDeckReview',
}

/** Run one case, distinguishing unavailable prerequisites from tested failures. */
export async function runProbeCase(
	action: Actions,
	task: () => Promise<void>,
	calls: Actions[],
	outcomes: Partial<Record<Actions, ActionOutcome>>,
): Promise<ActionOutcome> {
	// The runner cleans up the process separately; shutdown is still an API probe.
	if (action.startsWith('gui')) {
		const hostFailure = Object.values(outcomes).find(
			(outcome) => outcome.status === 'infrastructure',
		)
		if (hostFailure !== undefined) {
			return hostFailure
		}
	}

	const prerequisite = PREREQUISITES[action]
	if (prerequisite !== undefined && outcomes[prerequisite]?.status !== 'ok') {
		const outcome = outcomes[prerequisite]
		return {
			detail: truncate(
				`Requires ${prerequisite}: ${outcome?.detail ?? outcome?.status ?? 'not tested'}`,
			),
			status: 'skipped',
		}
	}

	const before = calls.length
	try {
		await task()
		return calls.slice(before).includes(action)
			? { status: 'ok' }
			: { detail: `Probe did not call ${action}`, status: 'failed' }
	} catch (error) {
		const detail = truncate(error instanceof Error ? error.message : String(error))
		if (error instanceof GuiInfrastructureError) {
			return { detail, status: 'infrastructure' }
		}

		if (
			error instanceof SkipError ||
			(error instanceof GuiStateTimeoutError && !calls.slice(before).includes(action))
		) {
			return { detail, status: 'skipped' }
		}

		const status =
			error instanceof BehaviorError || error instanceof GuiStateTimeoutError ? 'failed' : 'error'
		return { detail, status }
	}
}
