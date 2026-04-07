import { describe, expect, it } from 'vitest'
import { YankiConnect } from '../src'

const client = new YankiConnect({ autoLaunch: false })

describe('deck actions', () => {
	it('deckNames', async () => {
		const decks = await client.deck.deckNames()
		expect(decks.length).toBeGreaterThan(0)
	})

	it('deckNamesAndIds', async () => {
		const deckNamesAndIds = await client.deck.deckNamesAndIds()
		expect(Object.values(deckNamesAndIds).length).toBeGreaterThan(0)
		for (const id of Object.values(deckNamesAndIds)) {
			expect(typeof id).toBe('number')
		}
	})
})

const NOTE_ID_REGEX = /^\d{13}$/

describe('note actions', () => {
	it('addNote', async () => {
		const newNoteId = await client.note.addNote({
			note: {
				deckName: 'Default',
				fields: {
					Back: `<p>I'm the back of the card ${Date.now()}</p>\n`,
					Front: `<p>I'm the front of the card ${Date.now()}</p>\n`,
				},
				modelName: 'Basic',
				tags: ['yanki-connect-test'],
			},
		})

		expect(newNoteId).not.toBeNull()

		expect(String(newNoteId)).toMatch(NOTE_ID_REGEX)

		// Clean up for stable testing
		await client.note.deleteNotes({ notes: [newNoteId!] })

		// Check that it was deleted
		const note = await client.note.notesInfo({ notes: [newNoteId!] })
		expect(note[0].fields).toBeUndefined()
	})
})

describe('direct invocation', () => {
	it('deckNames via invoke', async () => {
		const { result } = await client.invoke('deckNames')
		expect(result.length).toBeGreaterThan(0)
	})
})

// TODO more tests
