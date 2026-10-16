import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { YankiFetchAdapter } from '../src'

// Auto-launch is only enabled on macOS in Node
vi.mock('../src/utilities/platform', () => ({ ENVIRONMENT: 'node', PLATFORM: 'mac' }))
// Never open the real app
vi.mock('../src/utilities/launcher', () => ({ launchAnkiApp: vi.fn() }))

// Test files share a module cache (`isolate: false`), so another file may have
// already loaded the client with the real launcher
vi.resetModules()
const { AnkiConnectUnreachableError, YankiConnect } = await import('../src')
const { launchAnkiApp } = await import('../src/utilities/launcher')

const refusedError = new TypeError('fetch failed')

function jsonResponse(body: Record<string, unknown>, status = 200) {
	return { headers: {}, json: vi.fn().mockResolvedValue(body), status }
}

// eslint-disable-next-line unicorn/no-null -- The real API response uses JSON null.
const versionResponse = jsonResponse({ error: null, result: 6 })
const collectionUnavailableResponse = jsonResponse({
	error: 'collection is not available',
	// eslint-disable-next-line unicorn/no-null -- The real API response uses JSON null.
	result: null,
})

describe('auto-launch', () => {
	beforeEach(() => {
		vi.mocked(launchAnkiApp).mockReset()
	})

	it('retries after launching Anki', async () => {
		vi.mocked(launchAnkiApp).mockResolvedValue(true)
		const fetchAdapter = vi
			.fn<YankiFetchAdapter>()
			.mockRejectedValueOnce(refusedError)
			.mockResolvedValueOnce(versionResponse)
		const client = new YankiConnect({ autoLaunch: true, fetchAdapter })

		await expect(client.miscellaneous.version()).resolves.toBe(6)
		expect(launchAnkiApp).toHaveBeenCalledTimes(1)
		expect(fetchAdapter).toHaveBeenCalledTimes(2)
	})

	it('throws AnkiConnectUnreachableError once the launcher gives up', async () => {
		vi.mocked(launchAnkiApp).mockResolvedValueOnce(true).mockResolvedValueOnce(false)
		const fetchAdapter = vi.fn<YankiFetchAdapter>().mockRejectedValue(refusedError)
		const client = new YankiConnect({ autoLaunch: true, fetchAdapter })

		await expect(client.miscellaneous.version()).rejects.toBeInstanceOf(AnkiConnectUnreachableError)
		expect(fetchAdapter).toHaveBeenCalledTimes(2)
	})

	it('retries while the collection is unavailable', async () => {
		vi.mocked(launchAnkiApp).mockResolvedValue(true)
		const fetchAdapter = vi
			.fn<YankiFetchAdapter>()
			.mockResolvedValueOnce(collectionUnavailableResponse)
			.mockResolvedValueOnce(versionResponse)
		const client = new YankiConnect({ autoLaunch: true, fetchAdapter })

		await expect(client.miscellaneous.version()).resolves.toBe(6)
		expect(fetchAdapter).toHaveBeenCalledTimes(2)
	})

	it('returns the unavailable collection error once the launcher gives up', async () => {
		vi.mocked(launchAnkiApp).mockResolvedValue(false)
		const fetchAdapter = vi.fn<YankiFetchAdapter>().mockResolvedValue(collectionUnavailableResponse)
		const client = new YankiConnect({ autoLaunch: true, fetchAdapter })

		await expect(client.miscellaneous.version()).rejects.toThrow('collection is not available')
		expect(fetchAdapter).toHaveBeenCalledTimes(1)
	})

	it('does not launch Anki for HTTP error responses', async () => {
		const fetchAdapter = vi.fn<YankiFetchAdapter>().mockResolvedValue(jsonResponse({}, 403))
		const client = new YankiConnect({ autoLaunch: true, fetchAdapter })

		await expect(client.miscellaneous.version()).rejects.toThrow(
			'AnkiConnect response status is 403',
		)
		expect(launchAnkiApp).not.toHaveBeenCalled()
	})
})
