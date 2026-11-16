import fs from 'node:fs/promises'
import path from 'node:path'
import { setTimeout } from 'node:timers/promises'

/** The diagnostic add-on did not observe the required UI state in time. */
export class GuiStateTimeoutError extends Error {}

/** The host cannot reliably run GUI probes in this process. */
export class GuiInfrastructureError extends Error {}

type ExpectedGuiState = { cardId?: number; mainWindow?: boolean; side?: 'answer' | 'question' }
type GuiState = {
	busy?: boolean
	cardId?: number
	mainFocused?: boolean
	mediaServerAlive?: boolean
	recordedAt: number
	refreshPending?: boolean
	rendererFailures?: Record<string, { exitCode: number; status: number }>
	reviewing?: boolean
	side?: string
	webReady?: boolean
}

/** Keep the disposable main window focused only while its GUI probes run. */
export async function setMainWindowFocus(
	file: string | undefined,
	focusMain: boolean,
): Promise<void> {
	if (file === undefined) {
		return
	}

	const control = path.join(path.dirname(file), 'gui-control.json')
	await fs.writeFile(`${control}.tmp`, JSON.stringify({ focusMain }))
	await fs.rename(`${control}.tmp`, control)
}

function matchesReviewer(state: GuiState, expected: ExpectedGuiState): boolean {
	return (
		(expected.cardId === undefined && expected.side === undefined) ||
		(state.reviewing === true &&
			state.webReady === true &&
			state.refreshPending === false &&
			(expected.cardId === undefined || state.cardId === expected.cardId) &&
			(expected.side === undefined || state.side === expected.side))
	)
}

function checkGuiHost(state: GuiState): void {
	if (state.mediaServerAlive === false) {
		throw new GuiInfrastructureError('Anki media server stopped; reviewer pages cannot load')
	}

	const rendererFailures = Object.entries(state.rendererFailures ?? {})
	if (rendererFailures.length === 0) {
		return
	}

	const detail = rendererFailures.map(
		([name, failure]) =>
			`${name} (Qt status ${String(failure.status)}, exit ${String(failure.exitCode)})`,
	)
	throw new GuiInfrastructureError(
		`Anki web renderer terminated unexpectedly: ${detail.join('; ')}`,
	)
}

/** Wait for fresh, idle UI observations without retrying the action under test. */
export async function waitForGuiState(
	file: string | undefined,
	expected: ExpectedGuiState = {},
	timeout = 15_000,
): Promise<void> {
	if (file === undefined) {
		return
	}

	const started = Date.now()
	let previousReady: number | undefined
	let lastState: string | undefined
	let observation: GuiState | undefined
	while (Date.now() - started < timeout) {
		try {
			lastState = await fs.readFile(file, 'utf8')
			const state = JSON.parse(lastState) as GuiState
			observation = state
			if (state.recordedAt > started) {
				checkGuiHost(state)
			}

			const ready =
				state.recordedAt > started &&
				state.busy === false &&
				(expected.mainWindow !== true || state.mainFocused === true) &&
				matchesReviewer(state, expected)
			if (ready) {
				// Two different timer ticks avoid accepting a stale snapshot during a transition.
				if (previousReady !== undefined && state.recordedAt > previousReady) {
					return
				}

				previousReady ??= state.recordedAt
			} else {
				previousReady = undefined
			}
		} catch (error) {
			if (error instanceof GuiInfrastructureError) {
				throw error
			}

			previousReady = undefined
			lastState = error instanceof Error ? error.message : String(error)
		}

		await setTimeout(100)
	}

	throw readinessTimeout(observation, expected, timeout, lastState)
}

function readinessTimeout(
	observation: GuiState | undefined,
	expected: ExpectedGuiState,
	timeout: number,
	lastState = 'none',
): Error {
	if (
		observation === undefined ||
		!Number.isFinite(observation.recordedAt) ||
		Date.now() - observation.recordedAt > 2000
	) {
		return new GuiInfrastructureError(
			`Diagnostic add-on stopped publishing fresh GUI state: ${lastState}`,
		)
	}

	if (expected.mainWindow === true && observation.mainFocused !== true) {
		return new GuiInfrastructureError('Anki main window could not receive focus')
	}

	return new GuiStateTimeoutError(
		`GUI did not become ready within ${String(timeout)}ms (expected ${JSON.stringify(expected)}). Last observation: ${lastState}`,
	)
}
