import { describe, expect, it, vi } from 'vitest'
import type { YankiFetchAdapter } from '../src'
import { AnkiConnectUnreachableError, YankiConnect } from '../src'

const refusedCause = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:8765'), {
	code: 'ECONNREFUSED',
})

const refusingClient = new YankiConnect({
	fetchAdapter: vi
		.fn<YankiFetchAdapter>()
		.mockRejectedValue(new TypeError('fetch failed', { cause: refusedCause })),
})

describe('unreachable AnkiConnect', () => {
	it('throws AnkiConnectUnreachableError from convenience methods', async () => {
		const request = refusingClient.miscellaneous.version()

		await expect(request).rejects.toBeInstanceOf(AnkiConnectUnreachableError)
		await expect(request).rejects.toBeInstanceOf(TypeError)
		await expect(request).rejects.toMatchObject({
			cause: { code: 'ECONNREFUSED' },
			message: 'fetch failed',
			name: 'AnkiConnectUnreachableError',
		})
	})

	it('throws AnkiConnectUnreachableError from invoke', async () => {
		await expect(refusingClient.invoke('version')).rejects.toBeInstanceOf(
			AnkiConnectUnreachableError,
		)
	})

	it('converts non-Error rejections', async () => {
		const client = new YankiConnect({
			fetchAdapter: vi.fn<YankiFetchAdapter>().mockRejectedValue('net::ERR_CONNECTION_REFUSED'),
		})

		await expect(client.miscellaneous.version()).rejects.toMatchObject({
			cause: 'net::ERR_CONNECTION_REFUSED',
			message: 'net::ERR_CONNECTION_REFUSED',
		})
	})

	it('does not treat HTTP error responses as unreachable', async () => {
		const client = new YankiConnect({
			fetchAdapter: vi
				.fn<YankiFetchAdapter>()
				.mockResolvedValue({ headers: {}, json: vi.fn().mockResolvedValue({}), status: 403 }),
		})
		const request = client.miscellaneous.version()

		await expect(request).rejects.toThrow('AnkiConnect response status is 403')
		await expect(request).rejects.not.toBeInstanceOf(AnkiConnectUnreachableError)
	})
})
