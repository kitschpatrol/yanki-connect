import { describe, expect, inject, it } from 'vitest'
import type { Actions } from '../src/types/shared'
import { YankiConnect } from '../src'

const ANKI_USER_AGENT = /^Anki /v
const INVALID_EASE = /^invalid ease\.?$/iv
// Browsers can't read October's 413 response, which lacks CORS headers.
const OVERSIZED_REQUEST = /^(?:AnkiConnect response status is 413|Failed to fetch)$/v
const exercised = new Set<Actions>()
const isLegacy = inject('ankiConnectVersion') === '25.11.9.0'
const isOctober = inject('ankiConnectVersion') === '26.10.14.0'
const hasLegacyEditor = Number(inject('ankiVersion').split('.', 1)[0]) < 26
const client = new YankiConnect({
	// Record coverage while forwarding every request to the real Anki fixture.
	async fetchAdapter(input, init) {
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
			// eslint-disable-next-line unicorn/no-null -- Reflect all upstream actions to detect additions too.
			actions: null,
			scopes: ['actions'],
		})
		// The 2025 fixture predates guiAddNoteSetData.
		const expectedActions = isLegacy
			? endpoints.filter((action) => action !== 'guiAddNoteSetData')
			: endpoints
		expect(new Set(reflected.actions)).toEqual(new Set(expectedActions))
		await expect(client.miscellaneous.requestPermission()).resolves.toMatchObject({
			permission: 'granted',
			requireApikey: false,
			version: 6,
		})
		// eslint-disable-next-line unicorn/no-null -- The API uses JSON null to select all actions.
		await expect(client.miscellaneous.apiReflect({ actions: null, scopes: [] })).resolves.toEqual({
			scopes: [],
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
		expect(await client.deck.deckNameFromId({ deckId })).toBe(deck)
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
		if (config === false || config.dyn === 1) {
			throw new Error('Could not get a regular deck config')
		}

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
		await expect(client.deck.getDeckConfig({ deck: movedDeck })).resolves.toBe(false)
	})

	it('model actions', async () => {
		expect(await client.model.modelNames()).toContain(modelName)
		await expect(client.model.modelNamesAndIds()).resolves.toMatchObject({ [modelName]: modelId })
		expect(await client.model.modelNameFromId({ modelId })).toBe(modelName)
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

	it('model creation uses Anki LaTeX defaults', async () => {
		const [model] = await client.model.findModelsById({ modelIds: [modelId] })
		const [basic] = await client.model.findModelsByName({ modelNames: ['Basic'] })
		expect(model!.latexPre).toBe(isOctober ? '' : basic!.latexPre)
		expect(model!.latexPost).toBe(isOctober ? '' : basic!.latexPost)
		expect(basic!.latexPre).not.toBe('')
		expect(basic!.latexPost).not.toBe('')
	})

	it('note actions', async () => {
		const extraNote = { ...note, fields: { ...note.fields, Front: `${deck}-extra` } }
		expect(await client.note.canAddNotes({ notes: [note, extraNote] })).toEqual([false, true])
		const details = await client.note.canAddNotesWithErrorDetail({ notes: [note, extraNote] })
		expect(details[0]).toMatchObject({ canAdd: false })
		expect(details[1]).toEqual({ canAdd: true })
		expect(await client.note.canAddNote({ note })).toBe(false)
		expect(await client.note.canAddNote({ note: extraNote })).toBe(true)
		expect(await client.note.canAddNoteWithErrorDetail({ note })).toMatchObject({ canAdd: false })
		expect(await client.note.canAddNoteWithErrorDetail({ note: extraNote })).toEqual({
			canAdd: true,
		})
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
		await client.note.addTags({ notes: [noteId], tags: 'toggled' })
		expect(await client.note.getNoteTags({ note: noteId })).toContain('toggled')
		await client.note.addTags({ add: false, notes: [noteId], tags: 'toggled' })
		expect(await client.note.getNoteTags({ note: noteId })).not.toContain('toggled')
		const tagArray = ['array-a', 'array-b']
		if (isLegacy) {
			// eslint-disable-next-line test/no-conditional-expect -- The 2025 fixture predates tag arrays.
			await expect(client.note.addTags({ notes: [noteId], tags: tagArray })).rejects.toThrow(
				'bad argument type for built-in operation',
			)
		} else {
			const arrayTags = async () => {
				const tags = await client.note.getNoteTags({ note: noteId })
				return tags.filter((tag) => tag.startsWith('array-'))
			}

			await client.note.addTags({ notes: [noteId], tags: tagArray })
			// eslint-disable-next-line test/no-conditional-expect -- Only the newer fixture accepts tag arrays.
			expect(await arrayTags()).toEqual(tagArray)
			await client.note.removeTags({ notes: [noteId], tags: tagArray })
			// eslint-disable-next-line test/no-conditional-expect -- Only the newer fixture accepts tag arrays.
			expect(await arrayTags()).toEqual([])
		}

		await client.note.updateNoteTags({ note: noteId, tags: [deck, 'updated'] })
		expect(await client.note.getNoteTags({ note: noteId })).toContain('updated')
		await client.note.updateNoteFields({ note: { fields: { Back: 'Updated answer' }, id: noteId } })
		await expect(client.note.notesInfo({ notes: [noteId] })).resolves.toMatchObject([
			{
				fields: { Back: { value: 'Updated answer' } },
				mod: expect.any(Number) as number,
				profile: 'yanki-tests',
			},
		])
		await expect(client.note.notesInfo({ query: `nid:${noteId}` })).resolves.toMatchObject([
			{ noteId },
		])
		// Media may target a field that the text update leaves out, and
		// `deleteExisting: false` keeps an existing file with the same name.
		const attachment = `${deck}-attachment.txt`
		const original = 'b3JpZ2luYWw='
		expect(await client.media.storeMediaFile({ data: original, filename: attachment })).toBe(
			attachment,
		)
		await client.note.updateNoteFields({
			note: {
				audio: [
					{ data: 'dGVzdA==', deleteExisting: false, fields: ['Back'], filename: attachment },
				],
				fields: {},
				id: added[0]!,
			},
		})
		expect(await client.media.retrieveMediaFile({ filename: attachment })).toBe(original)
		// Anki renames the new file with the SHA-1 of its contents ("test").
		const renamed = `${deck}-attachment-a94a8fe5ccb19ba61c4c0873d391e987982fbbd3.txt`
		await expect(client.note.notesInfo({ notes: added })).resolves.toMatchObject([
			{ fields: { Back: { value: `Answer[sound:${renamed}]` } } },
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
			note: { fields: extraNote.fields, id: added[0]!, modelName: 'Basic' },
		})
		await expect(client.note.notesInfo({ notes: added })).resolves.toMatchObject([
			// November restores the historical default of clearing omitted tags.
			{ modelName: 'Basic', tags: isOctober ? [deck] : [] },
		])
		expect(await client.note.notesModTime({ notes: [noteId] })).toEqual([
			{ mod: expect.any(Number) as number, noteId },
		])
		await client.note.deleteNotes({ notes: added })
		expect(await client.note.notesInfo({ notes: added })).toEqual([{}])
		await expect(client.note.clearUnusedTags()).resolves.toBeNull()
		expect(await client.note.getTags()).not.toContain('replaced')
		const unusedModelName = `${deck}-unused`
		await client.model.createModel({
			cardTemplates: [template],
			inOrderFields: ['Front', 'Back'],
			modelName: unusedModelName,
		})
		if (isOctober) {
			// eslint-disable-next-line test/no-conditional-expect -- The fixtures define different behavior for this legacy endpoint.
			await expect(client.note.removeEmptyNotes()).rejects.toThrow(
				'Use notes.findEmpty with explicit criteria, then notes.delete.',
			)
		} else {
			// eslint-disable-next-line test/no-conditional-expect -- The fixtures define different behavior for this legacy endpoint.
			await expect(client.note.removeEmptyNotes()).resolves.toBeNull()
		}

		// Despite its name, the 2025 fixture deletes unused note types; November does nothing.
		const modelNames = await client.model.modelNames()
		expect(modelNames).toContain(modelName)
		expect(modelNames.includes(unusedModelName)).toBe(!isLegacy)
	})

	it('nested deck statistics retain native names and own-card totals', async () => {
		const childDeck = `${deck}::Child`
		const childDeckId = await client.deck.createDeck({ deck: childDeck })
		const childNoteId = (await client.note.addNote({
			note: { ...note, deckName: childDeck, fields: { ...note.fields, Front: childDeck } },
		}))!
		await expect(client.deck.getDeckStats({ decks: [deck, childDeck] })).resolves.toMatchObject({
			[String(childDeckId)]: { name: isOctober ? childDeck : 'Child', total_in_deck: 1 },
			[String(deckId)]: { name: deck, new_count: 2, total_in_deck: isOctober ? 2 : 1 },
		})
		await client.note.deleteNotes({ notes: [childNoteId] })
		await client.deck.deleteDecks({ cardsToo: true, decks: [childDeck] })
	})

	it('missing duplicate-scope decks allow duplicates without being created', async () => {
		const missingDeck = `${deck}-missing`
		const candidate = {
			...note,
			options: { duplicateScope: 'deck', duplicateScopeOptions: { deckName: missingDeck } },
		}
		await expect(client.note.canAddNoteWithErrorDetail({ note: candidate })).resolves.toMatchObject(
			{ canAdd: !isOctober },
		)
		expect(await client.deck.deckNames()).not.toContain(missingDeck)
	})

	it('deck and all-model duplicate checks skip cloze validation', async () => {
		const clozeModelName = `${deck}-cloze`
		await client.model.createModel({
			cardTemplates: [{ Back: '{{cloze:Text}}', Front: '{{cloze:Text}}' }],
			inOrderFields: ['Text'],
			isCloze: true,
			modelName: clozeModelName,
		})
		const candidate = { deckName: deck, fields: { Text: 'No deletion' }, modelName: clozeModelName }
		expect(await client.note.canAddNote({ note: candidate })).toBe(false)
		expect(
			await client.note.canAddNotes({
				notes: [
					{ ...candidate, options: { duplicateScope: 'deck' } },
					{ ...candidate, options: { duplicateScopeOptions: { checkAllModels: true } } },
				],
			}),
		).toEqual([!isOctober, !isOctober])
	})

	it('oversized field and template indexes move to the end', async () => {
		await client.model.modelFieldAdd({ fieldName: 'Last', index: 0, modelName })
		const fieldResult = await client.invoke('modelFieldReposition', {
			fieldName: 'Last',
			index: 99,
			modelName,
		})
		expect(fieldResult.error === null).toBe(!isOctober)
		expect(await client.model.modelFieldNames({ modelName })).toEqual(
			isOctober ? ['Last', 'Front', 'Back'] : ['Front', 'Back', 'Last'],
		)
		await client.model.modelFieldRemove({ fieldName: 'Last', modelName })
		await client.model.modelTemplateAdd({ modelName, template: { ...template, Name: 'Last' } })
		await client.model.modelTemplateReposition({ index: 0, modelName, templateName: 'Last' })
		const templateResult = await client.invoke('modelTemplateReposition', {
			index: 99,
			modelName,
			templateName: 'Last',
		})
		expect(templateResult.error === null).toBe(!isOctober)
		const [model] = await client.model.findModelsById({ modelIds: [modelId] })
		expect(model!.tmpls.map((entry) => entry.name)).toEqual(
			isOctober ? ['Last', 'Card 1'] : ['Card 1', 'Last'],
		)
		await client.model.modelTemplateRemove({ modelName, templateName: 'Last' })
	})

	it('field and template names that differ only in case are rejected', async () => {
		// Earlier releases let Anki rename the repeat with a "+" suffix.
		const savesRepeats = isLegacy || isOctober
		const added = await client.invoke('modelFieldAdd', { fieldName: 'front', modelName })
		expect(added.error === null).toBe(savesRepeats)
		expect(await client.model.modelFieldNames({ modelName })).toEqual(
			savesRepeats ? ['Front', 'Back', 'front+'] : ['Front', 'Back'],
		)
		if (savesRepeats) {
			await client.model.modelFieldRemove({ fieldName: 'front+', modelName })
		}

		const renamed = await client.invoke('modelFieldRename', {
			modelName,
			newFieldName: 'front',
			oldFieldName: 'Back',
		})
		expect(renamed.error === null).toBe(savesRepeats)
		expect(await client.model.modelFieldNames({ modelName })).toEqual([
			'Front',
			savesRepeats ? 'front+' : 'Back',
		])
		if (savesRepeats) {
			await client.model.modelFieldRename({
				modelName,
				newFieldName: 'Back',
				oldFieldName: 'front+',
			})
		}

		const addedTemplate = await client.invoke('modelTemplateAdd', {
			modelName,
			template: { ...template, Name: 'card 1' },
		})
		expect(addedTemplate.error === null).toBe(savesRepeats)
		expect(Object.keys(await client.model.modelTemplates({ modelName }))).toEqual(
			savesRepeats ? ['Card 1', 'card 1+'] : ['Card 1'],
		)
		if (savesRepeats) {
			await client.model.modelTemplateRemove({ modelName, templateName: 'card 1+' })
		}

		await client.model.modelTemplateAdd({ modelName, template: { ...template, Name: 'Extra' } })
		const renamedTemplate = await client.invoke('modelTemplateRename', {
			modelName,
			newTemplateName: 'card 1',
			oldTemplateName: 'Extra',
		})
		expect(renamedTemplate.error === null).toBe(savesRepeats)
		const templateName = savesRepeats ? 'card 1+' : 'Extra'
		expect(Object.keys(await client.model.modelTemplates({ modelName }))).toEqual([
			'Card 1',
			templateName,
		])
		await client.model.modelTemplateRemove({ modelName, templateName })

		const created = await client.invoke('createModel', {
			cardTemplates: [template],
			inOrderFields: ['Front', 'front', 'Back'],
			modelName: `${deck}-repeats`,
		})
		const createdFields =
			created.error === null ? created.result.flds.map(({ name }) => name) : undefined
		expect(createdFields).toEqual(savesRepeats ? ['Front', 'front+', 'Back'] : undefined)
	})

	it('obsolete deck configuration values are accepted', async () => {
		const configId = await client.deck.cloneDeckConfigId({ name: `${deck}-obsolete` })
		if (configId === false) {
			throw new Error('Could not clone deck config')
		}

		await client.deck.setDeckConfigId({ configId, decks: [deck] })
		const config = await client.deck.getDeckConfig({ deck })
		if (config === false || config.dyn === 1) {
			throw new Error('Could not get a regular deck config')
		}

		const result = await client.deck.saveDeckConfig({
			config: {
				...config,
				maxTaken: 43,
				new: { ...config.new, ints: [2, 5, 99], separate: true },
				rev: { ...config.rev, fuzz: 0.5, minSpace: 9 },
			},
		})
		expect(result).toBe(!isOctober)
		await expect(client.deck.getDeckConfig({ deck })).resolves.toMatchObject({
			maxTaken: isOctober ? config.maxTaken : 43,
		})
		await client.deck.setDeckConfigId({ configId: 1, decks: [deck] })
		await client.deck.removeDeckConfigId({ configId })
	})

	it.each(['addNote', 'addNotes', 'updateNoteFields', 'updateNote'] as const)(
		'%s attachment collisions respect default and explicit replacement flags',
		async (action) => {
			for (const replaceExisting of [undefined, false, true]) {
				const filename = `${deck}-${action.toLowerCase()}-${String(replaceExisting)}.txt`
				await client.media.storeMediaFile({ data: 'b3JpZ2luYWw=', filename })
				const fields = { Back: '', Front: filename }
				const audio = [
					{
						data: 'dGVzdA==',
						fields: ['Back'],
						filename,
						...(replaceExisting !== undefined && { deleteExisting: replaceExisting }),
					},
				]
				let id: number
				if (action === 'addNotes') {
					const added = await client.note.addNotes({ notes: [{ ...note, audio, fields }] })
					id = added[0]!
				} else if (action === 'addNote') {
					id = (await client.note.addNote({ note: { ...note, audio, fields } }))!
				} else {
					id = (await client.note.addNote({ note: { ...note, fields } }))!
					await client.note[action]({ note: { audio, fields: { Back: '' }, id } })
				}

				const replace = replaceExisting ?? isOctober
				const stored = replace
					? filename
					: filename.replace('.txt', '-a94a8fe5ccb19ba61c4c0873d391e987982fbbd3.txt')
				expect(await client.media.retrieveMediaFile({ filename })).toBe(
					replace ? 'dGVzdA==' : 'b3JpZ2luYWw=',
				)
				await expect(client.note.notesInfo({ notes: [id] })).resolves.toMatchObject([
					{ fields: { Back: { value: `[sound:${stored}]` } } },
				])
				await client.note.deleteNotes({ notes: [id] })
			}
		},
	)

	it.each([{ tags: [] }, { tags: [deck] }])(
		'updateNoteModel replaces explicit tags: $tags',
		async ({ tags }) => {
			const targetModelName = `${deck}-converted-${tags.length}`
			await client.model.createModel({
				cardTemplates: [template],
				inOrderFields: ['Front', 'Back'],
				modelName: targetModelName,
			})
			const id = (await client.note.addNote({
				note: { ...note, fields: { ...note.fields, Front: `${deck}-conversion` } },
			}))!
			const cards = await client.card.findCards({ query: `nid:${id}` })
			await client.note.updateNoteModel({
				note: { fields: note.fields, id, modelName: targetModelName, tags },
			})
			expect(await client.note.getNoteTags({ note: id })).toEqual(tags)
			expect(await client.card.findCards({ query: `nid:${id}` })).toEqual(cards)
			await client.note.deleteNotes({ notes: [id] })
		},
	)

	it.runIf(!isLegacy)('updateNoteModel accepts null to clear tags', async () => {
		const id = (await client.note.addNote({
			note: { ...note, fields: { ...note.fields, Front: `${deck}-null-tags` } },
		}))!
		await client.note.updateNoteModel({
			// eslint-disable-next-line unicorn/no-null -- AnkiConnect 26.10.14.0 added null normalization.
			note: { fields: note.fields, id, modelName: 'Basic', tags: null },
		})
		expect(await client.note.getNoteTags({ note: id })).toEqual([])
		await client.note.deleteNotes({ notes: [id] })
	})

	it('card actions', async () => {
		const cards = [cardId]
		await expect(client.card.cardsInfo({ cards })).resolves.toMatchObject([
			{
				cardId,
				deckName: deck,
				flags: expect.any(Number) as number,
				nextReviews: expect.any(Array) as string[],
				note: noteId,
			},
		])
		if (isLegacy) {
			// eslint-disable-next-line test/no-conditional-expect -- The 2025 fixture predates the fields parameter.
			await expect(client.card.cardsInfo({ cards, fields: ['cardId', 'queue'] })).rejects.toThrow(
				'fields',
			)
		} else {
			// eslint-disable-next-line test/no-conditional-expect -- Only the newer fixture filters card records.
			expect(await client.card.cardsInfo({ cards, fields: ['cardId', 'queue'] })).toEqual([
				{ cardId, queue: 0 },
			])
		}

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

	it('bulk card writes ignore missing card IDs', async () => {
		const missingCardId = 1
		const movedDeck = `${deck}-missing-cards`
		const responses = [
			await client.invoke('changeDeck', { cards: [cardId, missingCardId], deck: movedDeck }),
			await client.invoke('forgetCards', { cards: [missingCardId] }),
			await client.invoke('setDueDate', { cards: [missingCardId], days: '1' }),
		]
		expect(responses.map(({ error }) => error === null)).toEqual([
			!isOctober,
			!isOctober,
			!isOctober,
		])
		// October reports the missing card after moving the existing one.
		expect(await client.deck.getDecks({ cards: [cardId] })).toEqual({ [movedDeck]: [cardId] })
		await client.deck.changeDeck({ cards: [cardId], deck })
		await client.deck.deleteDecks({ cardsToo: true, decks: [movedDeck] })
	})

	it('answerCards leaves suspended cards and invalid batches unanswered', async () => {
		const cards = [cardId]
		await client.card.suspend({ cards })
		const suspended = await client.invoke('answerCards', { answers: [{ cardId, ease: 3 }] })
		if (isOctober) {
			// eslint-disable-next-line test/no-conditional-expect -- October rejects the whole batch.
			expect(suspended.error).toBe('This card cannot be answered outside the reviewer.')
		} else {
			// eslint-disable-next-line test/no-conditional-expect -- The other fixtures report per-card results.
			expect(suspended.result).toEqual([isLegacy])
		}

		// The 2025 fixture answers the suspended card, taking it out of suspension.
		expect(await client.card.areSuspended({ cards })).toEqual([!isLegacy])
		await client.card.unsuspend({ cards })
		await client.card.forgetCards({ cards })
		const invalid = await client.invoke('answerCards', {
			answers: [
				{ cardId, ease: 3 },
				{ cardId, ease: 5 },
			],
		})
		expect(invalid.error).toMatch(INVALID_EASE)
		// Earlier releases answer the cards before the invalid ease, leaving this one learning.
		await expect(client.card.cardsInfo({ cards })).resolves.toMatchObject([
			{ type: isLegacy || isOctober ? 1 : 0 },
		])
		await client.card.forgetCards({ cards })
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
		// The MD5 of the decoded data tells AnkiConnect the file is unchanged.
		expect(
			await client.media.storeMediaFile({
				data,
				filename,
				skipHash: '098f6bcd4621d373cade4e832627b4f6',
			}),
		).toBeNull()
		expect(await client.media.getMediaFilesNames({})).toContain(filename)
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

	it.runIf(!isOctober)(
		"media downloads encode non-ASCII URLs and use Anki's user agent",
		async () => {
			const filename = `${deck}-download.json`
			const url = `${inject('mediaServerUrl')}/語彙.mp3?q=音`
			expect(await client.media.storeMediaFile({ filename, url })).toBe(filename)
			const data = await client.media.retrieveMediaFile({ filename })
			if (data === false) {
				throw new Error('Downloaded media is missing')
			}

			const response = await fetch(`data:application/json;base64,${data}`)
			await expect(response.json()).resolves.toMatchObject({
				url: '/%E8%AA%9E%E5%BD%99.mp3?q=%E9%9F%B3',
				userAgent: expect.stringMatching(ANKI_USER_AGENT) as string,
			})
		},
	)

	it('media downloads reject HTTP 204', async () => {
		const filename = `${deck}-empty.txt`
		const url = `${inject('mediaServerUrl')}/empty`
		const response = await client.invoke('storeMediaFile', { filename, url })
		expect(response.error ?? undefined).toBe(
			isOctober ? undefined : `${url} download failed with return code 204`,
		)
		expect(await client.media.retrieveMediaFile({ filename })).toBe(isOctober ? '' : false)
	})

	// The 2025 fixture has no limit, but reads a body this size too slowly for CI.
	it.runIf(!isLegacy)(
		'media uploads accept requests over 16 MiB',
		async () => {
			const filename = `${deck}-large.txt`
			const upload = client.media.storeMediaFile({ data: 'A'.repeat(17 * 1024 * 1024), filename })
			if (isOctober) {
				// eslint-disable-next-line test/no-conditional-expect -- October limits requests to 16 MiB.
				await expect(upload).rejects.toThrow(OVERSIZED_REQUEST)
			} else {
				// eslint-disable-next-line test/no-conditional-expect -- November accepts larger requests.
				await expect(upload).resolves.toBe(filename)
				await client.media.deleteMediaFile({ filename })
			}
		},
		30_000,
	)

	it('graphical actions', async () => {
		await client.graphical.guiDeckBrowser()
		expect(await client.graphical.guiReviewActive()).toBe(false)
		const draft = { note: { fields: { Front: 'draft' }, tags: ['draft'] } }
		if (isLegacy) {
			// eslint-disable-next-line test/no-conditional-expect -- The 2025 fixture predates this action.
			await expect(client.graphical.guiAddNoteSetData(draft)).rejects.toThrow('unsupported action')
		} else {
			// eslint-disable-next-line test/no-conditional-expect -- Only the newer fixture reports the closed dialog.
			expect(await client.graphical.guiAddNoteSetData(draft)).toEqual({
				code: 1,
				error: 'Add Note dialog is not open',
			})
		}

		await expect(client.graphical.guiStartCardTimer()).resolves.toBe(false)
		await expect(client.graphical.guiPlayAudio()).resolves.toBe(false)
		expect(await client.graphical.guiCheckDatabase()).toBe(true)
		// Database checks acknowledge immediately; wait until Anki accepts GUI navigation.
		await expect
			.poll(async () => client.graphical.guiDeckOverview({ name: deck }), { timeout: 10_000 })
			.toBe(true)
		expect(await client.graphical.guiDeckReview({ name: deck })).toBe(true)
		await expect
			.poll(async () => client.graphical.guiCurrentCard())
			.toMatchObject({
				buttons: expect.any(Array) as number[],
				cardId,
				nextReviews: expect.any(Array) as string[],
				template: 'Card 1',
			})
		expect(await client.graphical.guiReviewActive()).toBe(true)
		expect(await client.graphical.guiStartCardTimer()).toBe(true)
		expect(await client.graphical.guiShowQuestion()).toBe(true)
		expect(await client.graphical.guiPlayAudio()).toBe(true)
		expect(await client.graphical.guiShowAnswer()).toBe(true)
		expect(await client.graphical.guiAnswerCard({ ease: 3 })).toBe(true)
		// Answering and undoing return before their background collection operations finish.
		await expect.poll(async () => client.graphical.guiUndo(), { timeout: 10_000 }).toBe(true)
		await expect.poll(async () => client.graphical.guiDeckBrowser(), { timeout: 10_000 }).toBeNull()
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
		const missingSelections = [
			await client.invoke('guiSelectCard', { card: 1 }),
			await client.invoke('guiSelectNote', { note: 1 }),
		]
		expect(missingSelections.map(({ error }) => error === null)).toEqual([!isOctober, !isOctober])
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
		if (!isLegacy) {
			// eslint-disable-next-line test/no-conditional-expect -- The 2025 fixture predates this action.
			expect(await client.graphical.guiAddNoteSetData({ ...draft, append: true })).toBe(true)
		}
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
