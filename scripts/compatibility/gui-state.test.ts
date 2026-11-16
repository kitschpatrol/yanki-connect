import fs from 'node:fs/promises'
import { afterEach, expect, it, vi } from 'vitest'
import { GuiInfrastructureError, waitForGuiState } from './gui-state.ts'

afterEach(() => {
	vi.restoreAllMocks()
})

it('waits for two fresh, idle observations of the expected card and side', async () => {
	let time = 1000
	vi.spyOn(Date, 'now').mockImplementation(() => time++)
	const read = vi.spyOn(fs, 'readFile')
	const snapshot = (recordedAt: number, changes: Record<string, unknown> = {}) =>
		JSON.stringify({
			busy: false,
			cardId: 123,
			recordedAt,
			refreshPending: false,
			reviewing: true,
			side: 'answer',
			webReady: true,
			...changes,
		})
	read
		.mockResolvedValueOnce(snapshot(999))
		.mockResolvedValueOnce(snapshot(1001, { busy: true }))
		.mockResolvedValueOnce(snapshot(1002, { side: 'question' }))
		.mockResolvedValueOnce(snapshot(1003, { cardId: 456 }))
		.mockResolvedValueOnce(snapshot(1004, { webReady: false }))
		.mockResolvedValueOnce(snapshot(1005, { refreshPending: true }))
		.mockResolvedValueOnce(snapshot(1006))
		.mockResolvedValueOnce(snapshot(1006))
		.mockResolvedValueOnce(snapshot(1007))
	await expect(
		waitForGuiState('state.json', { cardId: 123, side: 'answer' }),
	).resolves.toBeUndefined()
	expect(read).toHaveBeenCalledTimes(9)
})

it('keeps a live but incorrect reviewer state as a behavior timeout', async () => {
	let time = 1000
	vi.spyOn(Date, 'now').mockImplementation(() => {
		time += 1000
		return time
	})
	const observation = JSON.stringify({
		busy: false,
		mediaServerAlive: true,
		recordedAt: 5000,
		reviewing: false,
	})
	vi.spyOn(fs, 'readFile').mockResolvedValue(observation)
	await expect(waitForGuiState('state.json', { cardId: 123 }, 2500)).rejects.toThrow(
		`Last observation: ${observation}`,
	)
})

it('detects a dead media server before waiting for impossible GUI readiness', async () => {
	vi.spyOn(Date, 'now').mockReturnValue(1000)
	vi.spyOn(fs, 'readFile').mockResolvedValue(
		JSON.stringify({ mediaServerAlive: false, recordedAt: 1001 }),
	)
	await expect(waitForGuiState('state.json')).rejects.toThrow(GuiInfrastructureError)
})

it('detects a renderer crash even when the helper, media server, and main window remain healthy', async () => {
	vi.spyOn(Date, 'now').mockReturnValue(1000)
	const read = vi.spyOn(fs, 'readFile').mockResolvedValue(
		JSON.stringify({
			busy: false,
			mainFocused: true,
			mediaServerAlive: true,
			recordedAt: 1001,
			rendererFailures: { card: { exitCode: 31, status: 2 } },
		}),
	)
	await expect(waitForGuiState('state.json')).rejects.toThrow(
		new GuiInfrastructureError(
			'Anki web renderer terminated unexpectedly: card (Qt status 2, exit 31)',
		),
	)
	expect(read).toHaveBeenCalledTimes(1)
})

it('ignores renderer evidence from before the current readiness wait', async () => {
	let time = 1000
	vi.spyOn(Date, 'now').mockImplementation(() => time++)
	const read = vi.spyOn(fs, 'readFile')
	read
		.mockResolvedValueOnce(
			JSON.stringify({ recordedAt: 999, rendererFailures: { card: { exitCode: 31, status: 2 } } }),
		)
		.mockResolvedValueOnce(JSON.stringify({ busy: false, recordedAt: 1001, rendererFailures: {} }))
		.mockResolvedValueOnce(JSON.stringify({ busy: false, recordedAt: 1002, rendererFailures: {} }))
	await expect(waitForGuiState('state.json')).resolves.toBeUndefined()
	expect(read).toHaveBeenCalledTimes(3)
})

it('classifies a stale diagnostic heartbeat as infrastructure instead of a behavior failure', async () => {
	let time = 1000
	vi.spyOn(Date, 'now').mockImplementation(() => {
		time += 1000
		return time
	})
	vi.spyOn(fs, 'readFile').mockResolvedValue(JSON.stringify({ busy: false, recordedAt: 1000 }))
	await expect(waitForGuiState('state.json', { cardId: 123 }, 2500)).rejects.toThrow(
		GuiInfrastructureError,
	)
})

it('requires main-window focus before declaring the GUI ready', async () => {
	let time = 1000
	vi.spyOn(Date, 'now').mockImplementation(() => time++)
	const read = vi.spyOn(fs, 'readFile')
	read
		.mockResolvedValueOnce(JSON.stringify({ busy: false, mainFocused: false, recordedAt: 1001 }))
		.mockResolvedValueOnce(JSON.stringify({ busy: false, mainFocused: true, recordedAt: 1002 }))
		.mockResolvedValueOnce(JSON.stringify({ busy: false, mainFocused: true, recordedAt: 1003 }))
	await expect(waitForGuiState('state.json', { mainWindow: true })).resolves.toBeUndefined()
	expect(read).toHaveBeenCalledTimes(3)
})

it('allows standalone probes without the diagnostic add-on', async () => {
	await expect(waitForGuiState(undefined)).resolves.toBeUndefined()
})
