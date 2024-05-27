import { Zodios, makeApi } from '@zodios/core'
import { z } from 'zod'

const api = makeApi([
	{
		alias: 'deckNames',
		method: 'post',
		parameters: [
			{
				name: 'body',
				schema: z.object({
					action: z.literal('deckNames'),
					version: z.literal(6),
				}),
				type: 'Body',
			},
		],
		path: '/',
		requestFormat: 'json',
		response: z.object({
			error: z.string().nullable(),
			result: z.array(z.string()).nullable(),
		}),
	},
])

const apiClient = new Zodios(api, {
	axiosConfig: {
		baseURL: 'http://127.0.0.1:8765',
	},
})

const deckNames = await apiClient.deckNames({ action: 'deckNames', version: 6 })

console.log(deckNames)
