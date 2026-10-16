import type { AddressInfo } from 'node:net'
import net from 'node:net'
import { expect, it } from 'vitest'
import { AnkiConnectUnreachableError, YankiConnect } from '../src'

/**
 * Get a port with nothing listening on it. Avoids fixed low ports, since Node's
 * fetch refuses some of them (e.g. port 1) before connecting.
 */
async function getClosedPort(): Promise<number> {
	const server = net.createServer()
	await new Promise<void>((resolve) => {
		server.listen(0, '127.0.0.1', resolve)
	})
	const { port } = server.address() as AddressInfo
	await new Promise((resolve) => {
		server.close(resolve)
	})
	return port
}

it('keeps the message and cause of Node fetch connection errors', async () => {
	const client = new YankiConnect({ port: await getClosedPort() })
	const request = client.miscellaneous.version()

	await expect(request).rejects.toBeInstanceOf(AnkiConnectUnreachableError)
	await expect(request).rejects.toMatchObject({
		cause: { code: 'ECONNREFUSED' },
		message: 'fetch failed',
	})
})
