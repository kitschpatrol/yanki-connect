/* eslint-disable @typescript-eslint/naming-convention */

import { YankiConnect } from '../src'
import { describe, expect, it } from 'vitest'

// These tests only run locally...
// TODO load test fixture data in Anki

const client = new YankiConnect({ autoLaunchAnki: true })

describe('deck actions', () => {
	it('deckNames', async () => {
		expect(await client.deck.deckNames()).toMatchInlineSnapshot(`
			[
			  "Default",
			]
		`)
	})

	it('deckNamesAndIds', async () => {
		expect(await client.deck.deckNamesAndIds()).toMatchInlineSnapshot(`
			{
			  "Default": 1,
			}
		`)
	})
})

describe('note actions', () => {
	it('addNote', async () => {
		const result = await client.note.addNote({
			note: {
				deckName: 'Default',
				fields: {
					Back: "<p>I'm the back of the card</p>\n",
					Front: "<p>I'm the front of the card</p>\n",
				},
				modelName: 'Basic',
				tags: ['yanki'],
			},
		})

		expect(result).toMatchInlineSnapshot(`1716968687679`)
	})
})

describe('direct invocation', () => {
	it('deckNames via invoke', async () => {
		expect(await client.invoke('deckNames')).toMatchInlineSnapshot(`
			{
			  "error": null,
			  "result": [
			    "Default",
			  ],
			}
		`)
	})
})

// TODO more tests
