/* eslint-disable unicorn/no-null */
import { makeFetcher, makeRequestHandler } from '@sarim.garden/clover'
import { z } from 'zod'

export const { clientConfig, handler } = makeRequestHandler({
	description: 'Executes an arbitrary action',
	input: z.object({
		action: z.enum(['deckNames', 'deckNamesAndIds']),
		version: z.number().default(6),
	}),
	method: 'POST',
	output: z.object({
		error: z.string().nullable(),
		result: z.any().nullable(),
	}),
	path: '/',
	async run({ sendOutput }) {
		return sendOutput({
			error: null,
			result: ['deck1', 'deck2'],
		})
	},
})

type ClientTypes = typeof clientConfig

const fetcher = makeFetcher({
	baseUrl: 'http://127.0.0.1:8765',
})

const { response } = await fetcher<ClientTypes>({
	input: {
		action: 'deckNames',
		version: 6,
	},
})

console.log(response)
