/* eslint-disable @typescript-eslint/naming-convention */

import { YankiConnect } from '../src'
import { describe, expect, it } from 'vitest'

// These tests only run locally...
// TODO load test fixture data in Anki

const client = new YankiConnect({ autoLaunch: true })

describe('deck actions', () => {
	it('deckNames', async () => {
		expect(await client.deck.deckNames()).toMatchInlineSnapshot(`
			[
			  "Anki",
			  "Anki::Fancy Cards",
			  "Anki::Note Type Tests",
			  "Anki::Regex",
			  "Anki::TypeScript",
			  "Default",
			  "minimal-notes",
			]
		`)
	})

	it('deckNamesAndIds', async () => {
		expect(await client.deck.deckNamesAndIds()).toMatchInlineSnapshot(`
			{
			  "Anki": 1717543995750,
			  "Anki::Fancy Cards": 1717543996570,
			  "Anki::Note Type Tests": 1717543995949,
			  "Anki::Regex": 1717543995826,
			  "Anki::TypeScript": 1717543995751,
			  "Default": 1,
			  "minimal-notes": 1717264591375,
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
			    "Anki",
			    "Anki::Fancy Cards",
			    "Anki::Note Type Tests",
			    "Anki::Regex",
			    "Anki::TypeScript",
			    "Default",
			    "minimal-notes",
			  ],
			}
		`)
	})
})

// TODO more tests
