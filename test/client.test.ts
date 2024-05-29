import { YankiConnect } from '../src'
import { describe, expect, it } from 'vitest'

// These tests only run locally...
// TODO load test fixture data in Anki

describe('deck actions', () => {
	const client = new YankiConnect({ autoLaunchAnki: true })

	it('deckNames', async () => {
		expect(await client.deck.deckNames()).toMatchInlineSnapshot(`
			{
			  "error": null,
			  "result": [
			    "Default",
			  ],
			}
		`)
	})

	it('deckNamesAndIds', async () => {
		expect(await client.deck.deckNamesAndIds()).toMatchInlineSnapshot(`
			{
			  "error": null,
			  "result": {
			    "Default": 1,
			  },
			}
		`)
	})
})

// TODO more tests
