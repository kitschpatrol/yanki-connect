import { execa } from 'execa'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { installAnki } from './install-anki.ts'

vi.mock('node:timers/promises', () => ({
	setTimeout: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
}))

const release = {
	source: 'github' as const,
	url: 'https://example.com/anki.tar',
	version: '24.06.1',
}
let fixture: string
let directory: string
let archive: Uint8Array

beforeAll(async () => {
	fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'yanki-download-fixture-'))
	await fs.mkdir(path.join(fixture, 'bin'))
	await fs.writeFile(path.join(fixture, 'bin', 'anki'), '#!/bin/sh\nexit 0\n', { mode: 0o755 })
	const file = path.join(fixture, 'anki.tar')
	await execa('tar', ['-cf', file, '-C', fixture, 'bin'])
	archive = await fs.readFile(file)
})

beforeEach(async () => {
	directory = await fs.mkdtemp(path.join(os.tmpdir(), 'yanki-download-'))
	vi.clearAllMocks()
	vi.spyOn(console, 'warn').mockImplementation(vi.fn<typeof console.warn>())
})

afterEach(async () => {
	vi.restoreAllMocks()
	await fs.rm(directory, { force: true, recursive: true })
})

afterAll(async () => {
	await fs.rm(fixture, { force: true, recursive: true })
})

it('recovers from transient HTTP errors and extracts only the completed archive', async () => {
	const fetch = vi.spyOn(globalThis, 'fetch')
	const timeout = vi.spyOn(AbortSignal, 'timeout')
	fetch
		.mockResolvedValueOnce(new Response('Gateway timeout', { status: 504 }))
		.mockResolvedValueOnce(new Response('Unavailable', { status: 503 }))
		.mockResolvedValueOnce(new Response(new Uint8Array(archive)))
	const executable = await installAnki(release, directory)
	expect(executable).toBe(path.join(directory, 'bin', 'anki'))
	expect(await fs.readFile(executable, 'utf8')).toBe('#!/bin/sh\nexit 0\n')
	expect(await fs.readdir(directory)).toEqual(['bin'])
	expect(fetch).toHaveBeenCalledTimes(3)
	expect(fetch).toHaveBeenCalledWith(release.url, {
		signal: expect.any(AbortSignal) as AbortSignal,
	})
	expect(timeout.mock.calls).toEqual([[180_000], [180_000], [180_000]])
	expect(vi.mocked(setTimeout).mock.calls).toEqual([[5000], [10_000]])
})

it.each([
	new TypeError('fetch failed'),
	new DOMException('Download deadline exceeded', 'TimeoutError'),
])('recovers from a transient network failure: %s', async (error) => {
	const fetch = vi.spyOn(globalThis, 'fetch')
	fetch.mockRejectedValueOnce(error).mockResolvedValueOnce(new Response(new Uint8Array(archive)))
	await expect(installAnki(release, directory)).resolves.toBe(path.join(directory, 'bin', 'anki'))
	expect(fetch).toHaveBeenCalledTimes(2)
})

it('discards a partial body before downloading the archive again', async () => {
	let chunks = 0
	// eslint-disable-next-line node/no-unsupported-features/node-builtins -- Compatibility tooling runs on Node 24; this fixture is not shipped in the client.
	const interrupted = new ReadableStream<Uint8Array>({
		pull(controller) {
			if (chunks++ === 0) {
				controller.enqueue(new TextEncoder().encode('Incomplete archive'))
			} else {
				controller.error(new TypeError('terminated'))
			}
		},
	})
	const fetch = vi.spyOn(globalThis, 'fetch')
	fetch.mockResolvedValueOnce(new Response(interrupted)).mockImplementationOnce(async () => {
		expect(await fs.readdir(directory)).toEqual([])
		return new Response(new Uint8Array(archive))
	})
	await expect(installAnki(release, directory)).resolves.toBe(path.join(directory, 'bin', 'anki'))
	expect(fetch).toHaveBeenCalledTimes(2)
	expect(await fs.readdir(directory)).toEqual(['bin'])
})

it('stops after three transient failures without leaving an archive', async () => {
	const fetch = vi.spyOn(globalThis, 'fetch')
	for (let attempt = 0; attempt < 3; attempt++) {
		fetch.mockResolvedValueOnce(new Response('Gateway timeout', { status: 504 }))
	}

	await expect(installAnki(release, directory)).rejects.toThrow('Download failed after 3 attempts')
	expect(fetch).toHaveBeenCalledTimes(3)
	expect(setTimeout).toHaveBeenCalledTimes(2)
	expect(await fs.readdir(directory)).toEqual([])
})

it('does not retry a missing release asset', async () => {
	const fetch = vi
		.spyOn(globalThis, 'fetch')
		.mockResolvedValue(new Response('Not found', { status: 404 }))
	await expect(installAnki(release, directory)).rejects.toThrow('failed with status 404')
	expect(fetch).toHaveBeenCalledOnce()
	expect(setTimeout).not.toHaveBeenCalled()
	expect(await fs.readdir(directory)).toEqual([])
})

it('does not retry filesystem failures as network failures', async () => {
	const fetch = vi
		.spyOn(globalThis, 'fetch')
		.mockResolvedValue(new Response(new Uint8Array(archive)))
	vi.spyOn(fs, 'writeFile').mockRejectedValueOnce(new Error('No space left on device'))
	await expect(installAnki(release, directory)).rejects.toThrow('No space left on device')
	expect(fetch).toHaveBeenCalledOnce()
	expect(setTimeout).not.toHaveBeenCalled()
})
