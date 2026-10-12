import { describe, expect, it } from 'vitest'
import { YankiConnect } from '../src'

const client = new YankiConnect({ autoLaunch: false })

const NOTE_ID_REGEX = /^\d{13}$/v

/**
 * Adds a unique Basic note to the Default deck for a test to exercise. Callers
 * are responsible for deleting it.
 */
async function addTestNote(): Promise<number> {
	const timestamp = `${Date.now()}-${Math.random()}`
	return client.note.addNote({
		note: {
			deckName: 'Default',
			fields: {
				Back: `<p>I'm the back of the card ${timestamp}</p>\n`,
				Front: `<p>I'm the front of the card ${timestamp}</p>\n`,
			},
			modelName: 'Basic',
			tags: ['yanki-connect-test'],
		},
	})
}

describe('card actions', () => {
	it('cardsModTime', async () => {
		const noteId = await addTestNote()
		const [noteInfo] = await client.note.notesInfo({ notes: [noteId] })
		const { cards } = noteInfo!
		expect(cards.length).toBeGreaterThan(0)

		const modificationTimes = await client.card.cardsModTime({ cards })
		expect(modificationTimes).toHaveLength(cards.length)
		expect(modificationTimes[0]!.cardId).toBe(cards[0])
		expect(typeof modificationTimes[0]!.mod).toBe('number')

		await client.note.deleteNotes({ notes: [noteId] })
	})
})

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

	it('deckNameFromId', async () => {
		const deckNamesAndIds = await client.deck.deckNamesAndIds()
		for (const [name, id] of Object.entries(deckNamesAndIds)) {
			expect(await client.deck.deckNameFromId({ deckId: id })).toBe(name)
		}

		await expect(client.deck.deckNameFromId({ deckId: 123 })).rejects.toThrow()
	})
})

describe('graphical actions', () => {
	it('guiReviewActive', async () => {
		expect(await client.graphical.guiReviewActive()).toBe(false)
	})

	it('guiAddNoteSetData reports a closed dialog in the result', async () => {
		const result = await client.graphical.guiAddNoteSetData({
			note: { fields: { Front: 'Hello' } },
		})
		expect(result).toEqual({ code: 1, error: 'Add Note dialog is not open' })
	})
})

describe('miscellaneous actions', () => {
	it('getActiveProfile', async () => {
		expect(await client.miscellaneous.getActiveProfile()).toBe('yanki-tests')
	})

	it('apiReflect lists exactly the actions the client exposes', async () => {
		const result = await client.miscellaneous.apiReflect({ scopes: ['actions'] })
		if (!('actions' in result)) {
			throw new Error('apiReflect did not return actions')
		}

		const clientActions = [
			client.card,
			client.deck,
			client.graphical,
			client.media,
			client.miscellaneous,
			client.model,
			client.note,
			client.statistic,
		].flatMap((group) => Object.keys(group))

		expect(clientActions.toSorted()).toEqual(result.actions.toSorted())
	})
})

describe('model actions', () => {
	it('modelNameFromId', async () => {
		const modelNamesAndIds = await client.model.modelNamesAndIds()
		for (const [name, id] of Object.entries(modelNamesAndIds)) {
			expect(await client.model.modelNameFromId({ modelId: id })).toBe(name)
		}
	})

	it('modelFieldDescriptions', async () => {
		const fieldNames = await client.model.modelFieldNames({ modelName: 'Basic' })
		const descriptions = await client.model.modelFieldDescriptions({ modelName: 'Basic' })
		expect(descriptions).toHaveLength(fieldNames.length)
		for (const description of descriptions) {
			expect(typeof description).toBe('string')
		}
	})
})

describe('note actions', () => {
	it('addNote', async () => {
		const newNoteId = await addTestNote()
		expect(String(newNoteId)).toMatch(NOTE_ID_REGEX)

		// Clean up for stable testing
		await client.note.deleteNotes({ notes: [newNoteId] })

		// Check that it was deleted
		const note = await client.note.notesInfo({ notes: [newNoteId] })
		expect(note[0]!.fields).toBeUndefined()
	})

	it('canAddNote', async () => {
		const note = {
			deckName: 'Default',
			fields: { Back: 'back', Front: `front ${Date.now()}` },
			modelName: 'Basic',
		}
		expect(await client.note.canAddNote({ note })).toBe(true)
		expect(await client.note.canAddNote({ note: { ...note, modelName: 'Nope' } })).toBe(false)

		expect(await client.note.canAddNoteWithErrorDetail({ note })).toEqual({ canAdd: true })
		const detail = await client.note.canAddNoteWithErrorDetail({
			note: { ...note, modelName: 'Nope' },
		})
		expect(detail.canAdd).toBe(false)
		expect(detail.canAdd ? undefined : detail.error).toContain('Nope')
	})

	it('notesModTime', async () => {
		const noteId = await addTestNote()
		const modificationTimes = await client.note.notesModTime({ notes: [noteId] })
		expect(modificationTimes).toHaveLength(1)
		expect(modificationTimes[0]!.noteId).toBe(noteId)
		expect(typeof modificationTimes[0]!.mod).toBe('number')
		await client.note.deleteNotes({ notes: [noteId] })
	})
})

describe('direct invocation', () => {
	it('deckNames via invoke', async () => {
		const { result } = await client.invoke('deckNames')
		expect(result.length).toBeGreaterThan(0)
	})
})
