import { describe, expect, inject, it } from 'vitest'
import type { Actions } from '../src/types/shared'
import { YankiConnect } from '../src'

const exercised = new Set<Actions>()
const isLegacy = inject('ankiConnectVersion') === '25.11.9.0'
const hasLegacyEditor = Number(inject('ankiVersion').split('.', 1)[0]) < 26
const client = new YankiConnect({
	// Record coverage while forwarding every request to the real Anki fixture.
	async fetchAdapter(input, init) {
		// eslint-disable-next-line node/no-unsupported-features/node-builtins -- Fetch is supported by the project's minimum Node 20.
		const response = await fetch(input, init)
		const request = JSON.parse(init!.body!) as { action: Actions }
		exercised.add(request.action)
		return response
	},
})
const endpoints = Object.values({
	card: client.card,
	deck: client.deck,
	graphical: client.graphical,
	media: client.media,
	miscellaneous: client.miscellaneous,
	model: client.model,
	note: client.note,
	statistic: client.statistic,
}).flatMap((group) => Object.keys(group))
const deck = `yanki-e2e-${Date.now()}`
const modelName = `${deck}-model`
const note = { deckName: deck, fields: { Back: 'Answer', Front: deck }, modelName, tags: [deck] }
const template = { Back: '{{Back}}', Front: '{{Front}}', Name: 'Card 1' }
let deckId: number
let modelId: number
let noteId: number
let cardId: number
let mediaPath: string

describe('real AnkiConnect endpoints', { concurrent: false }, () => {
	it('create fixture data', async () => {
		deckId = await client.deck.createDeck({ deck })
		expect(deckId).toBeGreaterThan(0)
		const model = await client.model.createModel({
			cardTemplates: [template],
			inOrderFields: ['Front', 'Back'],
			modelName,
		})
		modelId = model.id
		expect(model.name).toBe(modelName)
		noteId = (await client.note.addNote({ note }))!
		expect(noteId).toBeGreaterThan(0)
		const cards = await client.card.findCards({ query: `nid:${noteId}` })
		expect(cards).toHaveLength(1)
		cardId = cards[0]!
		const directory = await client.media.getMediaDirPath()
		mediaPath = directory.replaceAll('\\', '/')
	})

	it('miscellaneous actions and direct invocation', async () => {
		expect(await client.miscellaneous.version()).toBe(6)
		await expect(client.invoke('version')).resolves.toMatchObject({ result: 6 })
		const reflected = await client.miscellaneous.apiReflect({
			actions: endpoints,
			scopes: ['actions'],
		})
		expect(new Set(reflected.actions)).toEqual(new Set(endpoints))
		await expect(client.miscellaneous.requestPermission()).resolves.toMatchObject({
			permission: 'granted',
		})
		const profile = await client.miscellaneous.getActiveProfile()
		expect(profile).toBe('yanki-tests')
		expect(await client.miscellaneous.getProfiles()).toContain(profile)
		expect(await client.miscellaneous.loadProfile({ name: profile })).toBe(true)
		await client.miscellaneous.reloadCollection()

		expect(
			await client.miscellaneous.multi({ actions: [{ action: 'version', version: 6 }] }),
			// eslint-disable-next-line unicorn/no-null -- The real API response uses JSON null.
		).toEqual([{ error: null, result: 6 }])
		// The isolated fixture has no AnkiWeb account; exercise its real error response.
		await expect(client.miscellaneous.sync()).rejects.toThrow('sync: auth not configured')
	})

	it('deck actions', async () => {
		expect(await client.deck.deckNames()).toContain(deck)
		await expect(client.deck.deckNamesAndIds()).resolves.toMatchObject({ [deck]: deckId })
		expect(await client.deck.getDecks({ cards: [cardId] })).toEqual({ [deck]: [cardId] })
		await expect(client.deck.getDeckStats({ decks: [deck] })).resolves.toMatchObject({
			[String(deckId)]: {
				name: deck,
				total_in_deck: 1,
			},
		})
		const configId = await client.deck.cloneDeckConfigId({ cloneFrom: 1, name: deck })
		expect(typeof configId).toBe('number')
		if (configId === false) {
			throw new Error('Could not clone deck config')
		}

		expect(await client.deck.setDeckConfigId({ configId, decks: [deck] })).toBe(true)
		const config = await client.deck.getDeckConfig({ deck })
		expect(config.id).toBe(configId)
		expect(await client.deck.saveDeckConfig({ config: { ...config, maxTaken: 42 } })).toBe(true)
		await expect(client.deck.getDeckConfig({ deck })).resolves.toMatchObject({ maxTaken: 42 })
		expect(await client.deck.setDeckConfigId({ configId: 1, decks: [deck] })).toBe(true)
		expect(await client.deck.removeDeckConfigId({ configId })).toBe(true)
		const movedDeck = `${deck}-moved`
		await client.deck.changeDeck({ cards: [cardId], deck: movedDeck })
		expect(await client.deck.getDecks({ cards: [cardId] })).toEqual({ [movedDeck]: [cardId] })
		await client.deck.changeDeck({ cards: [cardId], deck })
		await client.deck.deleteDecks({ cardsToo: true, decks: [movedDeck] })
		expect(await client.deck.deckNames()).not.toContain(movedDeck)
	})

	it('model actions', async () => {
		expect(await client.model.modelNames()).toContain(modelName)
		await expect(client.model.modelNamesAndIds()).resolves.toMatchObject({ [modelName]: modelId })
		await expect(client.model.findModelsById({ modelIds: [modelId] })).resolves.toMatchObject([
			{ name: modelName },
		])
		await expect(client.model.findModelsByName({ modelNames: [modelName] })).resolves.toMatchObject(
			[{ id: modelId }],
		)
		await client.model.modelFieldAdd({ fieldName: 'Extra', index: 2, modelName })
		await client.model.modelFieldRename({
			modelName,
			newFieldName: 'Renamed',
			oldFieldName: 'Extra',
		})
		await client.model.modelFieldReposition({ fieldName: 'Renamed', index: 1, modelName })
		expect(await client.model.modelFieldNames({ modelName })).toEqual(['Front', 'Renamed', 'Back'])
		await client.model.modelFieldSetFont({ fieldName: 'Renamed', font: 'Arial', modelName })
		await client.model.modelFieldSetFontSize({ fieldName: 'Renamed', fontSize: 24, modelName })
		await expect(client.model.modelFieldFonts({ modelName })).resolves.toMatchObject({
			Renamed: {
				font: 'Arial',
				size: 24,
			},
		})
		expect(
			await client.model.modelFieldSetDescription({
				description: 'Test description',
				fieldName: 'Renamed',
				modelName,
			}),
		).toBe(true)
		expect(await client.model.modelFieldDescriptions({ modelName })).toEqual([
			'',
			'Test description',
			'',
		])
		await client.model.modelFieldRemove({ fieldName: 'Renamed', modelName })
		expect(await client.model.modelFieldNames({ modelName })).toEqual(['Front', 'Back'])
		await client.model.modelTemplateAdd({
			modelName,
			template: { ...template, Front: '{{Back}}', Name: 'Extra' },
		})
		await client.model.modelTemplateRename({
			modelName,
			newTemplateName: 'Renamed',
			oldTemplateName: 'Extra',
		})
		await client.model.modelTemplateReposition({ index: 0, modelName, templateName: 'Renamed' })
		const models = await client.model.findModelsById({ modelIds: [modelId] })
		expect(models[0]!.tmpls[0]!.name).toBe('Renamed')
		await client.model.modelTemplateRemove({ modelName, templateName: 'Renamed' })
		await client.model.updateModelTemplates({
			model: {
				name: modelName,
				templates: { 'Card 1': { Back: '{{Back}}', Front: '{{Front}} marker' } },
			},
		})
		await expect(client.model.modelTemplates({ modelName })).resolves.toMatchObject({
			'Card 1': { Front: '{{Front}} marker' },
		})
		expect(await client.model.modelFieldsOnTemplates({ modelName })).toEqual({
			'Card 1': [['Front'], ['Back']],
		})
		await client.model.updateModelStyling({
			model: { css: '.card { color: red; }', name: modelName },
		})
		expect(await client.model.modelStyling({ modelName })).toEqual({ css: '.card { color: red; }' })
		expect(
			await client.model.findAndReplaceInModels({
				findText: 'marker',
				modelName,
				replaceText: 'replaced',
			}),
		).toBe(1)
		await expect(client.model.modelTemplates({ modelName })).resolves.toMatchObject({
			'Card 1': { Front: '{{Front}} replaced' },
		})
	})

	it('note actions', async () => {
		const extraNote = { ...note, fields: { ...note.fields, Front: `${deck}-extra` } }
		expect(await client.note.canAddNotes({ notes: [note, extraNote] })).toEqual([false, true])
		const details = await client.note.canAddNotesWithErrorDetail({ notes: [note, extraNote] })
		expect(details[0]).toMatchObject({ canAdd: false })
		expect(details[1]).toEqual({ canAdd: true })
		const added = await client.note.addNotes({ notes: [extraNote] })
		expect(added).toHaveLength(1)
		expect(added[0]).toBeGreaterThan(0)
		expect(await client.note.findNotes({ query: `tag:${deck}` })).toContain(noteId)
		await client.note.addTags({ notes: [noteId], tags: 'extra' })
		expect(await client.note.getTags()).toContain('extra')
		expect(await client.note.getNoteTags({ note: noteId })).toContain('extra')
		await client.note.replaceTags({
			notes: [noteId],
			replace_with_tag: 'renamed',
			tag_to_replace: 'extra',
		})
		expect(await client.note.getNoteTags({ note: noteId })).toContain('renamed')
		await client.note.replaceTagsInAllNotes({
			replace_with_tag: 'replaced',
			tag_to_replace: 'renamed',
		})
		expect(await client.note.getNoteTags({ note: noteId })).toContain('replaced')
		await client.note.removeTags({ notes: [noteId], tags: 'replaced' })
		expect(await client.note.getNoteTags({ note: noteId })).not.toContain('replaced')
		await client.note.updateNoteTags({ note: noteId, tags: [deck, 'updated'] })
		expect(await client.note.getNoteTags({ note: noteId })).toContain('updated')
		await client.note.updateNoteFields({ note: { fields: { Back: 'Updated answer' }, id: noteId } })
		await expect(client.note.notesInfo({ notes: [noteId] })).resolves.toMatchObject([
			{ fields: { Back: { value: 'Updated answer' } } },
		])
		await client.note.updateNote({
			note: { fields: { Back: 'Combined update' }, id: noteId, tags: [deck] },
		})
		await expect(client.note.notesInfo({ notes: [noteId] })).resolves.toMatchObject([
			{
				fields: { Back: { value: 'Combined update' } },
				tags: [deck],
			},
		])
		await client.note.updateNoteModel({
			note: { fields: extraNote.fields, id: added[0]!, modelName: 'Basic', tags: [deck] },
		})
		await expect(client.note.notesInfo({ notes: added })).resolves.toMatchObject([
			{ modelName: 'Basic' },
		])
		expect(await client.note.notesModTime({ notes: [noteId] })).toEqual([
			{ mod: expect.any(Number) as number, noteId },
		])
		await client.note.deleteNotes({ notes: added })
		expect(await client.note.notesInfo({ notes: added })).toEqual([{}])
		await client.note.clearUnusedTags()
		expect(await client.note.getTags()).not.toContain('replaced')
		if (isLegacy) {
			await client.note.removeEmptyNotes()
		} else {
			// eslint-disable-next-line test/no-conditional-expect -- The fixtures define different behavior for this legacy endpoint.
			await expect(client.note.removeEmptyNotes()).rejects.toThrow(
				'Use notes.findEmpty with explicit criteria, then notes.delete.',
			)
		}

		expect(await client.model.modelNames()).toContain(modelName)
	})

	it('card actions', async () => {
		const cards = [cardId]
		await expect(client.card.cardsInfo({ cards })).resolves.toMatchObject([
			{
				cardId,
				deckName: deck,
				note: noteId,
			},
		])
		expect(await client.card.cardsModTime({ cards })).toEqual([
			{ cardId, mod: expect.any(Number) as number },
		])
		expect(await client.card.cardsToNotes({ cards })).toEqual([noteId])
		expect(await client.card.areDue({ cards })).toEqual([true])
		expect(await client.card.suspend({ cards })).toBe(true)
		expect(await client.card.suspended({ card: cardId })).toBe(true)
		expect(await client.card.areSuspended({ cards })).toEqual([true])
		await client.card.unsuspend({ cards })
		expect(await client.card.areSuspended({ cards })).toEqual([false])
		expect(await client.card.setEaseFactors({ cards, easeFactors: [2500] })).toEqual([true])
		expect(await client.card.getEaseFactors({ cards })).toEqual([2500])
		expect(
			await client.card.setSpecificValueOfCard({
				card: cardId,
				keys: ['factor'],
				newValues: [2600],
			}),
		).toEqual([true])
		expect(await client.card.getEaseFactors({ cards })).toEqual([2600])
		expect(await client.card.getIntervals({ cards })).toEqual([0])
		expect(await client.card.answerCards({ answers: [{ cardId, ease: 3 }] })).toEqual([true])
		expect(await client.card.getIntervals({ cards, complete: true })).toEqual([
			expect.arrayContaining([expect.any(Number)]),
		])
		expect(await client.card.setDueDate({ cards, days: '1!' })).toBe(true)
		await expect(client.card.cardsInfo({ cards })).resolves.toMatchObject([{ type: 2 }])
		await client.card.relearnCards({ cards })
		await expect(client.card.cardsInfo({ cards })).resolves.toMatchObject([{ type: 3 }])
		await client.card.forgetCards({ cards })
		await expect(client.card.cardsInfo({ cards })).resolves.toMatchObject([{ type: 0 }])
	})

	it('statistic actions', async () => {
		const reviewId = Date.now() - 60_000
		await client.statistic.insertReviews({
			reviews: [[reviewId, cardId, -1, 3, 1, 0, 2500, 1000, 0]],
		})
		expect(await client.statistic.cardReviews({ deck, startID: reviewId - 1 })).toContainEqual([
			reviewId,
			cardId,
			-1,
			3,
			1,
			0,
			2500,
			1000,
			0,
		])
		const reviews = await client.statistic.getReviewsOfCards({ cards: [cardId] })
		expect(reviews[String(cardId)]).toEqual(
			expect.arrayContaining([expect.objectContaining({ id: reviewId })]),
		)
		expect(await client.statistic.getLatestReviewID({ deck })).toBeGreaterThanOrEqual(reviewId)
		expect(await client.statistic.getNumCardsReviewedToday()).toBeGreaterThan(0)
		await expect(client.statistic.getNumCardsReviewedByDay()).resolves.not.toEqual([])
		expect(await client.statistic.getCollectionStatsHTML({ wholeCollection: true })).toContain('<')
	})

	it('media and package actions', async () => {
		const filename = `${deck}.txt`
		const data = 'dGVzdA=='
		expect(await client.media.storeMediaFile({ data, filename })).toBe(filename)
		expect(await client.media.retrieveMediaFile({ filename })).toBe(data)
		expect(await client.media.getMediaFilesNames({ pattern: `${deck}*` })).toContain(filename)
		await client.media.deleteMediaFile({ filename })
		expect(await client.media.retrieveMediaFile({ filename })).toBe(false)
		const path = `${mediaPath}/${deck}.apkg`
		expect(await client.miscellaneous.exportPackage({ deck, includeSched: true, path })).toBe(true)
		// Remove the source note so import must restore actual collection data.
		await client.note.deleteNotes({ notes: [noteId] })
		expect(await client.note.findNotes({ query: `nid:${noteId}` })).toEqual([])
		expect(await client.miscellaneous.importPackage({ path })).toBe(true)
		const restored = await client.note.findNotes({ query: `deck:"${deck}"` })
		expect(restored).toHaveLength(1)
		noteId = restored[0]!
		const cards = await client.card.findCards({ query: `nid:${noteId}` })
		cardId = cards[0]!
	})

	it('graphical actions', async () => {
		expect(await client.graphical.guiCheckDatabase()).toBe(true)
		// Database checks acknowledge immediately; wait until Anki accepts GUI navigation.
		await expect
			.poll(async () => client.graphical.guiDeckOverview({ name: deck }), { timeout: 10_000 })
			.toBe(true)
		expect(await client.graphical.guiDeckReview({ name: deck })).toBe(true)
		await expect.poll(async () => client.graphical.guiCurrentCard()).toMatchObject({ cardId })
		expect(await client.graphical.guiStartCardTimer()).toBe(true)
		expect(await client.graphical.guiShowQuestion()).toBe(true)
		expect(await client.graphical.guiPlayAudio()).toBe(true)
		expect(await client.graphical.guiShowAnswer()).toBe(true)
		expect(await client.graphical.guiAnswerCard({ ease: 3 })).toBe(true)
		expect(await client.graphical.guiUndo()).toBe(true)
		await client.graphical.guiDeckBrowser()
		await client.graphical.guiImportFile({ path: `${mediaPath}/${deck}.apkg` })
		// GUI imports return before their native dialog and collection operation finish.
		await expect
			.poll(async () => client.graphical.guiBrowse({ query: `nid:${noteId}` }), { timeout: 10_000 })
			.toContain(cardId)
		expect(await client.graphical.guiSelectCard({ card: cardId })).toBe(true)
		await expect.poll(async () => client.graphical.guiSelectedNotes()).toEqual([noteId])
		// The deprecated endpoint takes a card ID despite the parameter name.
		// eslint-disable-next-line ts/no-deprecated -- Exercise the deprecated endpoint too.
		expect(await client.graphical.guiSelectNote({ note: cardId })).toBe(true)
		if (isLegacy && !hasLegacyEditor) {
			// Anki 26 removed the Qt editor used by this frozen AnkiConnect fixture.
			// eslint-disable-next-line test/no-conditional-expect -- Assert the known error only for the incompatible fixture/runtime pair.
			await expect(client.graphical.guiEditNote({ note: noteId })).rejects.toThrow(
				"'Ui_Dialog' object has no attribute 'buttonBox'",
			)
		} else {
			await client.graphical.guiEditNote({ note: noteId })
		}

		expect(
			typeof (await client.graphical.guiAddCards({
				note: { ...note, fields: { Back: '', Front: '' } },
			})),
		).toBe('number')
	}, 30_000)

	it('exit and exhaustive endpoint coverage', async () => {
		await expect(client.graphical.guiExitAnki()).resolves.toBeNull()
		expect(exercised).toEqual(new Set(endpoints))
		// The 2025 fixture loses its local shutdown timer; the newer fixture actually exits.
		if (!isLegacy) {
			// eslint-disable-next-line test/no-conditional-expect -- Only the newer fixture implements shutdown correctly.
			await expect
				.poll(
					async () => {
						try {
							await client.miscellaneous.version()
							return true
						} catch {
							return false
						}
					},
					{ timeout: 10_000 },
				)
				.toBe(false)
		}
	}, 15_000)
})
