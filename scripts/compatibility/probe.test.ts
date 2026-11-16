import fs from 'node:fs/promises'
import { afterEach, expect, it, vi } from 'vitest'
import { probe } from './probe.ts'

afterEach(() => {
	vi.restoreAllMocks()
})

it('serves audio and copies video as real media while retaining text fixture contents', async () => {
	const fetchMedia = fetch
	const observed: Array<{
		audio: Uint8Array
		contentType: string | undefined
		text: string
		video: Uint8Array
	}> = []
	vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
		const request = (await new Request(input, init).json()) as {
			action: string
			params?: { note?: { audio?: Array<{ url: string }>; video: Array<{ path: string }> } }
		}
		const note = request.params?.note
		if (request.action === 'addNote' && note?.audio !== undefined) {
			const audio = await fetchMedia(note.audio[0]!.url)
			const text = await fetchMedia(new URL('url.txt', note.audio[0]!.url))
			observed.push({
				audio: new Uint8Array(await audio.arrayBuffer()),
				contentType: audio.headers.get('Content-Type') ?? undefined,
				text: await text.text(),
				video: await fs.readFile(note.video[0]!.path),
			})
		}

		// All Anki API calls are mocked; only the disposable media server is contacted.
		// eslint-disable-next-line unicorn/no-null -- The AnkiConnect protocol uses JSON null on error.
		return Response.json({ error: 'Action unavailable in this fixture', result: null })
	})
	const report = await probe()
	expect(report.records).toEqual([])
	expect(report.actions.version).toEqual({
		detail: 'Action unavailable in this fixture',
		status: 'error',
	})
	expect(observed).toHaveLength(1)
	const media = observed[0]!
	expect(media.contentType).toBe('audio/mpeg')
	expect(new TextDecoder().decode(media.audio.subarray(0, 3))).toBe('ID3')
	expect(new TextDecoder().decode(media.video.subarray(4, 8))).toBe('ftyp')
	expect(media.text).toBe('test')
})

it.each([
	{ createdId: '123', label: 'legacy fixture ID', listedId: 123, status: 'ok' },
	{ createdId: 123, label: 'numeric fixture ID', listedId: 123, status: 'ok' },
	{ createdId: '123', label: 'wrong model identity', listedId: 456, status: 'failed' },
	{ createdId: '123', label: 'wrong response type', listedId: '123', status: 'signature' },
])('reports modelNamesAndIds as $status with a $label', async ({ createdId, listedId, status }) => {
	const models: Record<string, number | string> = {}
	vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
		const request = (await new Request(input, init).json()) as {
			action: string
			params: { isCloze?: boolean; modelName: string }
		}
		if (request.action === 'createModel') {
			models[request.params.modelName] = listedId
			return Response.json({
				// eslint-disable-next-line unicorn/no-null -- The AnkiConnect protocol uses JSON null on success.
				error: null,
				result: {
					id: createdId,
					name: request.params.modelName,
					type: request.params.isCloze === true ? 1 : 0,
				},
			})
		}

		// No request reaches a real Anki instance, including unrelated probe cases.
		return Response.json(
			request.action === 'modelNamesAndIds'
				? // eslint-disable-next-line unicorn/no-null -- The AnkiConnect protocol uses JSON null on success.
					{ error: null, result: models }
				: // eslint-disable-next-line unicorn/no-null -- The AnkiConnect protocol uses JSON null on error.
					{ error: 'Action unavailable in this fixture', result: null },
		)
	})
	const report = await probe()
	expect(report.actions.modelNamesAndIds.status).toBe(status)
	expect(report.records.find(({ action }) => action === 'createModel')?.result).toMatchObject({
		id: createdId,
	})
	expect(report.actions.createModel.status).toBe('signature')
})
