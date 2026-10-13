// cspell:ignore unsuspended
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import type * as Yanki from '../../src/index.ts'
import type { Note } from '../../src/types/note'
import type { Actions } from '../../src/types/shared'
import type { ActionOutcome } from './shared.ts'
import type { ProbeRecord } from './signatures.ts'
import { truncate } from './shared.ts'
import { applySignatureChecks } from './signatures.ts'

export type ProbeOptions = {
	host?: string
	port?: number
	/** Per-request timeout in milliseconds. */
	timeout?: number
}

export type ProbeReport = {
	actions: Record<Actions, ActionOutcome>
	records: ProbeRecord[]
}

/** Thrown when an earlier action failed to produce state this action needs. */
class SkipError extends Error {}

/** Thrown when a response is well-typed but not what the documentation promises. */
class BehaviorError extends Error {}

type Context = {
	cardId?: number
	client: Yanki.YankiConnect
	clozeModelName: string
	configId?: number
	deck: string
	deckId?: number
	extraNoteId?: number
	mediaUrl: (filename: string) => string
	modelId?: number
	modelName: string
	noteId?: number
	packagePath: string
	profile?: string
	reviewId?: number
	textPath: string
	/** Run readiness polling without recording responses for signature checks. */
	unrecorded: <T>(task: () => Promise<T>) => Promise<T>
	videoPath: string
}

type ProbeCase = (context: Context) => Promise<void>

/**
 * The probe exercises the built package, since Node cannot resolve the
 * extension-less imports in `src/` without a bundler. Run `pnpm build` first.
 */
async function loadClient(): Promise<typeof Yanki> {
	try {
		return (await import(new URL('../../dist/index.js', import.meta.url).href)) as typeof Yanki
	} catch (error) {
		throw new Error('The probe needs the built client in dist/. Run `pnpm build` first.', {
			cause: error,
		})
	}
}

const TEMPLATE = { Back: '{{Back}}', Front: '{{Front}}', Name: 'Card 1' }
const CSS = '.card { color: red; }'
const TEXT_BASE64 = 'dGVzdA=='
const PNG_BASE64 =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const UNRELATED_HASH = createHash('md5').update('unrelated').digest('hex')
const MEDIA_FILES = {
	data: '_yanki-compat-data.txt',
	path: '_yanki-compat-path.txt',
	url: '_yanki-compat-url.txt',
}
const POLL_TIMEOUT = 15_000

function assert(condition: boolean, message: string): asserts condition {
	if (!condition) {
		throw new BehaviorError(message)
	}
}

function assertNull(actual: unknown, label: string): void {
	assert(
		actual === null,
		`${label}: expected null, received ${truncate(JSON.stringify(actual), 200)}`,
	)
}

function assertEqual(actual: unknown, expected: unknown, label: string): void {
	assert(
		isDeepStrictEqual(actual, expected),
		`${label}: expected ${JSON.stringify(expected)}, received ${truncate(JSON.stringify(actual), 200)}`,
	)
}

function required<
	K extends
		| 'cardId'
		| 'configId'
		| 'deckId'
		| 'extraNoteId'
		| 'modelId'
		| 'noteId'
		| 'profile'
		| 'reviewId',
>(context: Context, key: K): NonNullable<Context[K]> {
	const value = context[key]
	if (value === undefined) {
		throw new SkipError(`Requires ${key} from an earlier action`)
	}

	return value
}

/**
 * Retry a GUI query until it settles, since Anki applies GUI requests
 * asynchronously. Responses are not recorded; the caller makes a final recorded
 * call once the state is ready.
 */
async function settle<T>(
	context: Context,
	task: () => Promise<T>,
	ready: (value: T) => boolean,
	label: string,
): Promise<void> {
	const start = Date.now()
	while (Date.now() - start < POLL_TIMEOUT) {
		try {
			if (ready(await context.unrecorded(task))) {
				return
			}
		} catch {
			// Not ready yet
		}

		await new Promise((resolve) => {
			setTimeout(resolve, 250)
		})
	}

	throw new BehaviorError(`${label} did not settle within ${String(POLL_TIMEOUT / 1000)}s`)
}

/**
 * Every media variant: inline data, local path, and URL, with and without
 * target fields.
 */
function media(context: Context): Pick<Note, 'audio' | 'picture' | 'video'> {
	return {
		audio: [{ filename: '_yanki-compat-audio.mp3', url: context.mediaUrl('audio.mp3') }],
		picture: [
			{
				data: PNG_BASE64,
				fields: ['Back'],
				filename: '_yanki-compat-picture.png',
				skipHash: UNRELATED_HASH,
			},
		],
		video: [{ fields: ['Back'], filename: '_yanki-compat-video.mp4', path: context.videoPath }],
	}
}

function note(context: Context, front: string) {
	return {
		deckName: context.deck,
		fields: { Back: 'Answer', Front: front },
		modelName: context.modelName,
		...media(context),
		options: {
			allowDuplicate: false,
			duplicateScope: 'deck',
			duplicateScopeOptions: {
				checkAllModels: true,
				checkChildren: true,
				deckName: context.deck,
			},
		},
		tags: [context.deck],
	}
}

async function expectNotes(context: Context, query: string, expected: number[], label: string) {
	assertEqual(await context.client.note.findNotes({ query }), expected, label)
}

async function expectCards(context: Context, query: string, expected: number[], label: string) {
	assertEqual(await context.client.card.findCards({ query }), expected, label)
}

async function expectFieldNames(context: Context, expected: string[], label: string) {
	assertEqual(
		await context.client.model.modelFieldNames({ modelName: context.modelName }),
		expected,
		label,
	)
}

async function templateNames(context: Context): Promise<string[]> {
	return Object.keys(await context.client.model.modelTemplates({ modelName: context.modelName }))
}

/* eslint-disable perfectionist/sort-objects -- Cases run in declaration order; later cases depend on state created by earlier ones. */
const cases: Record<Actions, 'untestable' | ProbeCase> = {
	// Miscellaneous
	async version({ client }) {
		assertEqual(await client.miscellaneous.version(), 6, 'version')
	},
	async requestPermission({ client }) {
		const permission = await client.miscellaneous.requestPermission()
		assertEqual(permission.permission, 'granted', 'permission')
	},
	async apiReflect({ client }) {
		// eslint-disable-next-line unicorn/no-null -- JSON null selects every action.
		const all = await client.miscellaneous.apiReflect({ actions: null, scopes: ['actions'] })
		assert(all.actions?.includes('version') === true, 'reflected actions include version')
		const some = await client.miscellaneous.apiReflect({
			actions: ['version', 'deckNames', 'yankiCompatibilityMissing'],
			scopes: ['actions'],
		})
		assertEqual(new Set(some.actions), new Set(['deckNames', 'version']), 'reflected subset')
		// eslint-disable-next-line unicorn/no-null -- JSON null selects every action.
		const none = await client.miscellaneous.apiReflect({ actions: null, scopes: [] })
		assertEqual(none.scopes, [], 'reflected scopes')
	},
	async getProfiles(context) {
		const profiles = await context.client.miscellaneous.getProfiles()
		assert(profiles.length > 0, 'at least one profile')
		context.profile ??= profiles[0]
	},
	async getActiveProfile(context) {
		const profile = await context.client.miscellaneous.getActiveProfile()
		assert(profile.length > 0, 'active profile name')
		context.profile = profile
	},
	async loadProfile(context) {
		const name = required(context, 'profile')
		assertEqual(await context.client.miscellaneous.loadProfile({ name }), true, 'loadProfile')
	},
	async reloadCollection({ client }) {
		assertNull(await client.miscellaneous.reloadCollection(), 'reloadCollection')
	},
	async multi({ client }) {
		const results = await client.miscellaneous.multi({
			actions: [{ action: 'version', version: 6 }, { action: 'deckNames' }],
		})
		assertEqual(results.length, 2, 'multi result count')
		const first = results[0] as number | { result?: unknown }
		assert(first === 6 || (typeof first === 'object' && first.result === 6), 'multi version result')
	},
	// Media
	async storeMediaFile(context) {
		const { client } = context
		assertEqual(
			await client.media.storeMediaFile({
				data: TEXT_BASE64,
				deleteExisting: true,
				filename: MEDIA_FILES.data,
			}),
			MEDIA_FILES.data,
			'store from data',
		)
		const fromPath = await client.media.storeMediaFile({
			deleteExisting: false,
			filename: MEDIA_FILES.path,
			path: context.textPath,
		})
		assert(fromPath.startsWith('_yanki-compat-path'), 'store from path')
		assertEqual(
			await client.media.storeMediaFile({
				deleteExisting: true,
				filename: MEDIA_FILES.url,
				url: context.mediaUrl('text.txt'),
			}),
			MEDIA_FILES.url,
			'store from url',
		)
	},
	async retrieveMediaFile({ client }) {
		assertEqual(
			await client.media.retrieveMediaFile({ filename: MEDIA_FILES.data }),
			TEXT_BASE64,
			'retrieve stored file',
		)
		assertEqual(
			await client.media.retrieveMediaFile({ filename: '_yanki-compat-missing.txt' }),
			false,
			'retrieve missing file',
		)
	},
	async getMediaFilesNames({ client }) {
		const names = await client.media.getMediaFilesNames({ pattern: '_yanki-compat-*' })
		assert(names.includes(MEDIA_FILES.data), 'stored file is listed')
	},
	async getMediaDirPath({ client }) {
		const directory = await client.media.getMediaDirPath()
		assert(
			directory.endsWith('collection.media') && fs.existsSync(directory),
			`media directory exists: ${directory}`,
		)
	},
	async deleteMediaFile({ client }) {
		assertNull(
			await client.media.deleteMediaFile({ filename: MEDIA_FILES.data }),
			'deleteMediaFile',
		)
		assertEqual(
			await client.media.retrieveMediaFile({ filename: MEDIA_FILES.data }),
			false,
			'deleted file is gone',
		)
	},
	// Decks and models
	async createDeck(context) {
		const id = await context.client.deck.createDeck({ deck: context.deck })
		assert(id > 0, 'deck id')
		context.deckId = id
	},
	async deckNames(context) {
		const names = await context.client.deck.deckNames()
		assert(names.includes(context.deck), 'deck is listed')
	},
	async deckNamesAndIds(context) {
		const ids = await context.client.deck.deckNamesAndIds()
		assertEqual(ids[context.deck], required(context, 'deckId'), 'deck id by name')
	},
	async createModel(context) {
		const model = await context.client.model.createModel({
			cardTemplates: [TEMPLATE],
			css: CSS,
			inOrderFields: ['Front', 'Back'],
			isCloze: false,
			modelName: context.modelName,
		})
		assertEqual(model.name, context.modelName, 'model name')
		context.modelId = model.id
		const cloze = await context.client.model.createModel({
			cardTemplates: [
				{ Back: '{{cloze:Text}}<br>{{Extra}}', Front: '{{cloze:Text}}', Name: 'Cloze' },
			],
			inOrderFields: ['Text', 'Extra'],
			isCloze: true,
			modelName: context.clozeModelName,
		})
		assertEqual(cloze.type, 1, 'cloze model type')
	},
	async modelNames(context) {
		const names = await context.client.model.modelNames()
		assert(
			names.includes(context.modelName) && names.includes(context.clozeModelName),
			'models are listed',
		)
	},
	async modelNamesAndIds(context) {
		const ids = await context.client.model.modelNamesAndIds()
		assertEqual(ids[context.modelName], required(context, 'modelId'), 'model id by name')
	},
	// Notes
	async addNote(context) {
		const id = await context.client.note.addNote({ note: note(context, context.deck) })
		assert(id !== null && id > 0, 'note id')
		context.noteId = id
	},
	async findNotes(context) {
		const noteId = required(context, 'noteId')
		await expectNotes(context, `nid:${String(noteId)}`, [noteId], 'find note by id')
	},
	async findCards(context) {
		const cards = await context.client.card.findCards({
			query: `nid:${String(required(context, 'noteId'))}`,
		})
		assertEqual(cards.length, 1, 'one card for the note')
		context.cardId = cards[0]
	},
	async cardsToNotes(context) {
		assertEqual(
			await context.client.card.cardsToNotes({ cards: [required(context, 'cardId')] }),
			[required(context, 'noteId')],
			'cardsToNotes',
		)
	},
	async canAddNotes(context) {
		assertEqual(
			await context.client.note.canAddNotes({
				notes: [note(context, context.deck), note(context, `${context.deck}-extra`)],
			}),
			[false, true],
			'canAddNotes',
		)
	},
	async canAddNotesWithErrorDetail(context) {
		const details = await context.client.note.canAddNotesWithErrorDetail({
			notes: [note(context, context.deck), note(context, `${context.deck}-extra`)],
		})
		assert(details[0]?.canAdd === false && details[0].error.length > 0, 'duplicate note has error')
		assert(details[1]?.canAdd === true, 'new note can be added')
	},
	async addNotes(context) {
		const added = await context.client.note.addNotes({
			notes: [note(context, `${context.deck}-extra`)],
		})
		assert(added.length === 1 && added[0]! > 0, 'one note added')
		context.extraNoteId = added[0]
	},
	async notesInfo(context) {
		const noteId = required(context, 'noteId')
		const info = await context.client.note.notesInfo({ notes: [noteId, 1] })
		assertEqual(info.length, 2, 'notesInfo count')
		assert('noteId' in info[0]! && info[0].noteId === noteId, 'note info id')
		assertEqual(info[1], {}, 'missing note info')
	},
	async notesModTime(context) {
		const noteId = required(context, 'noteId')
		const times = await context.client.note.notesModTime({ notes: [noteId, 1] })
		assert('noteId' in times[0]! && times[0].noteId === noteId, 'note mod time id')
		assertEqual(times[1], {}, 'missing note mod time')
	},
	async getTags(context) {
		const tags = await context.client.note.getTags()
		assert(tags.includes(context.deck), 'tag is listed')
	},
	async addTags(context) {
		const noteId = required(context, 'noteId')
		assertNull(
			await context.client.note.addTags({ notes: [noteId], tags: 'yanki-compat-added' }),
			'addTags',
		)
		await expectNotes(
			context,
			`nid:${String(noteId)} tag:yanki-compat-added`,
			[noteId],
			'tag added',
		)
	},
	async getNoteTags(context) {
		const tags = await context.client.note.getNoteTags({ note: required(context, 'noteId') })
		assert(tags.includes(context.deck), 'note has its tag')
	},
	async replaceTags(context) {
		const noteId = required(context, 'noteId')
		assertNull(
			await context.client.note.replaceTags({
				notes: [noteId],
				replace_with_tag: 'yanki-compat-replaced',
				tag_to_replace: 'yanki-compat-added',
			}),
			'replaceTags',
		)
		await expectNotes(
			context,
			`nid:${String(noteId)} tag:yanki-compat-replaced`,
			[noteId],
			'tag replaced',
		)
	},
	async replaceTagsInAllNotes(context) {
		const noteId = required(context, 'noteId')
		assertNull(
			await context.client.note.replaceTagsInAllNotes({
				replace_with_tag: 'yanki-compat-global',
				tag_to_replace: 'yanki-compat-replaced',
			}),
			'replaceTagsInAllNotes',
		)
		await expectNotes(
			context,
			`nid:${String(noteId)} tag:yanki-compat-global`,
			[noteId],
			'tag replaced globally',
		)
	},
	async removeTags(context) {
		const noteId = required(context, 'noteId')
		assertNull(
			await context.client.note.removeTags({ notes: [noteId], tags: 'yanki-compat-global' }),
			'removeTags',
		)
		await expectNotes(context, `nid:${String(noteId)} tag:yanki-compat-global`, [], 'tag removed')
	},
	async updateNoteTags(context) {
		const noteId = required(context, 'noteId')
		assertNull(
			await context.client.note.updateNoteTags({
				note: noteId,
				tags: [context.deck, 'yanki-compat-updated'],
			}),
			'updateNoteTags',
		)
		await expectNotes(
			context,
			`nid:${String(noteId)} tag:yanki-compat-updated`,
			[noteId],
			'tags updated',
		)
	},
	async updateNoteFields(context) {
		const noteId = required(context, 'noteId')
		assertNull(
			await context.client.note.updateNoteFields({
				note: { fields: { Back: 'Updated answer' }, id: noteId, ...media(context) },
			}),
			'updateNoteFields',
		)
		await expectNotes(context, `nid:${String(noteId)} back:Updated*`, [noteId], 'fields updated')
	},
	async updateNote(context) {
		const noteId = required(context, 'noteId')
		assertNull(
			await context.client.note.updateNote({
				note: {
					fields: { Back: 'Combined update' },
					id: noteId,
					tags: [context.deck, 'yanki-compat-combined'],
					...media(context),
				},
			}),
			'updateNote with fields and tags',
		)
		assertNull(
			await context.client.note.updateNote({ note: { id: noteId, tags: [context.deck] } }),
			'updateNote with tags only',
		)
		await expectNotes(
			context,
			`nid:${String(noteId)} back:Combined* tag:${context.deck} -tag:yanki-compat-combined`,
			[noteId],
			'note updated',
		)
	},
	async updateNoteModel(context) {
		const extraNoteId = required(context, 'extraNoteId')
		assertNull(
			await context.client.note.updateNoteModel({
				note: {
					fields: { Back: 'Answer', Front: `${context.deck}-extra` },
					id: extraNoteId,
					modelName: 'Basic',
					tags: [context.deck],
				},
			}),
			'updateNoteModel',
		)
		await expectNotes(
			context,
			`nid:${String(extraNoteId)} note:Basic`,
			[extraNoteId],
			'model updated',
		)
	},
	// Cards
	async cardsInfo(context) {
		const cardId = required(context, 'cardId')
		const info = await context.client.card.cardsInfo({ cards: [cardId, 1] })
		assertEqual(info.length, 2, 'cardsInfo count')
		const card = info[0]!
		assert(
			'cardId' in card &&
				card.cardId === cardId &&
				card.deckName === context.deck &&
				card.note === required(context, 'noteId'),
			'card info identifies the card',
		)
		assertEqual(info[1], {}, 'missing card info')
	},
	async cardsModTime(context) {
		const cardId = required(context, 'cardId')
		const times = await context.client.card.cardsModTime({ cards: [cardId, 1] })
		assert('cardId' in times[0]! && times[0].cardId === cardId, 'card mod time id')
		assertEqual(times[1], {}, 'missing card mod time')
	},
	async areDue(context) {
		assertEqual(
			await context.client.card.areDue({ cards: [required(context, 'cardId')] }),
			[true],
			'new card is due',
		)
	},
	async suspend(context) {
		const cardId = required(context, 'cardId')
		assertEqual(await context.client.card.suspend({ cards: [cardId] }), true, 'suspend')
		await expectCards(context, `cid:${String(cardId)} is:suspended`, [cardId], 'card suspended')
	},
	async suspended(context) {
		assertEqual(
			await context.client.card.suspended({ card: required(context, 'cardId') }),
			true,
			'suspended',
		)
	},
	async areSuspended(context) {
		assertEqual(
			await context.client.card.areSuspended({ cards: [required(context, 'cardId')] }),
			[true],
			'areSuspended',
		)
	},
	async unsuspend(context) {
		const cardId = required(context, 'cardId')
		assertEqual(await context.client.card.unsuspend({ cards: [cardId] }), true, 'unsuspend')
		await expectCards(context, `cid:${String(cardId)} -is:suspended`, [cardId], 'card unsuspended')
	},
	async setEaseFactors(context) {
		const cardId = required(context, 'cardId')
		assertEqual(
			await context.client.card.setEaseFactors({ cards: [cardId], easeFactors: [2500] }),
			[true],
			'setEaseFactors',
		)
		await expectCards(context, `cid:${String(cardId)} prop:ease=2.5`, [cardId], 'ease set')
	},
	async getEaseFactors(context) {
		assertEqual(
			await context.client.card.getEaseFactors({ cards: [required(context, 'cardId')] }),
			[2500],
			'getEaseFactors',
		)
	},
	async setSpecificValueOfCard(context) {
		const cardId = required(context, 'cardId')
		assertEqual(
			await context.client.card.setSpecificValueOfCard({
				card: cardId,
				keys: ['factor'],
				newValues: [2600],
				warning_check: true,
			}),
			[true],
			'setSpecificValueOfCard',
		)
		await expectCards(context, `cid:${String(cardId)} prop:ease=2.6`, [cardId], 'factor set')
	},
	async answerCards(context) {
		const cardId = required(context, 'cardId')
		assertEqual(
			await context.client.card.answerCards({ answers: [{ cardId, ease: 3 }] }),
			[true],
			'answerCards',
		)
		await expectCards(context, `cid:${String(cardId)} -is:new`, [cardId], 'card answered')
	},
	async getIntervals(context) {
		const cards = [required(context, 'cardId')]
		const latest = await context.client.card.getIntervals({ cards })
		assert(latest.length === 1 && typeof latest[0] === 'number', 'latest interval per card')
		const complete = await context.client.card.getIntervals({ cards, complete: true })
		assert(complete.length === 1 && Array.isArray(complete[0]), 'complete intervals per card')
	},
	async setDueDate(context) {
		const cardId = required(context, 'cardId')
		assertEqual(
			await context.client.card.setDueDate({ cards: [cardId], days: '1!' }),
			true,
			'setDueDate',
		)
		await expectCards(context, `cid:${String(cardId)} is:review`, [cardId], 'card is a review card')
	},
	async relearnCards(context) {
		const cardId = required(context, 'cardId')
		assertNull(await context.client.card.relearnCards({ cards: [cardId] }), 'relearnCards')
		await expectCards(context, `cid:${String(cardId)} is:learn`, [cardId], 'card is relearning')
	},
	async forgetCards(context) {
		const cardId = required(context, 'cardId')
		assertNull(await context.client.card.forgetCards({ cards: [cardId] }), 'forgetCards')
		await expectCards(context, `cid:${String(cardId)} is:new`, [cardId], 'card is new again')
	},
	// Statistics
	async insertReviews(context) {
		const cardId = required(context, 'cardId')
		const reviewId = Date.now() - 60_000
		assertNull(
			await context.client.statistic.insertReviews({
				reviews: [[reviewId, cardId, -1, 3, 1, 0, 2500, 1000, 0]],
			}),
			'insertReviews',
		)
		await expectCards(context, `cid:${String(cardId)} rated:1`, [cardId], 'review is recorded')
		context.reviewId = reviewId
	},
	async cardReviews(context) {
		const reviewId = required(context, 'reviewId')
		const reviews = await context.client.statistic.cardReviews({
			deck: context.deck,
			startID: reviewId - 1,
		})
		assert(
			reviews.some((review) =>
				isDeepStrictEqual(review, [
					reviewId,
					required(context, 'cardId'),
					-1,
					3,
					1,
					0,
					2500,
					1000,
					0,
				]),
			),
			'inserted review is returned',
		)
	},
	async getReviewsOfCards(context) {
		const cardId = required(context, 'cardId')
		const reviews = await context.client.statistic.getReviewsOfCards({ cards: [cardId] })
		assert(
			reviews[String(cardId)]?.some((review) => review.id === required(context, 'reviewId')) ===
				true,
			'inserted review is returned for the card',
		)
	},
	async getLatestReviewID(context) {
		const latest = await context.client.statistic.getLatestReviewID({ deck: context.deck })
		assert(latest >= required(context, 'reviewId'), 'latest review id')
	},
	async getNumCardsReviewedToday(context) {
		required(context, 'reviewId')
		assert((await context.client.statistic.getNumCardsReviewedToday()) >= 1, 'reviewed today')
	},
	async getNumCardsReviewedByDay(context) {
		required(context, 'reviewId')
		const byDay = await context.client.statistic.getNumCardsReviewedByDay()
		assert(byDay.length > 0, 'reviews by day')
	},
	async getCollectionStatsHTML({ client }) {
		const collection = await client.statistic.getCollectionStatsHTML({ wholeCollection: true })
		assert(collection.includes('<'), 'collection stats html')
		const deck = await client.statistic.getCollectionStatsHTML({ wholeCollection: false })
		assert(deck.includes('<'), 'deck stats html')
	},
	// Deck configuration and organization
	async getDecks(context) {
		const cardId = required(context, 'cardId')
		assertEqual(
			await context.client.deck.getDecks({ cards: [cardId] }),
			{ [context.deck]: [cardId] },
			'getDecks',
		)
	},
	async getDeckStats(context) {
		const stats = await context.client.deck.getDeckStats({ decks: [context.deck] })
		assert(
			Object.values(stats).some((entry) => entry.name === context.deck),
			'stats for the deck',
		)
	},
	async cloneDeckConfigId(context) {
		const configId = await context.client.deck.cloneDeckConfigId({
			cloneFrom: 1,
			name: context.deck,
		})
		assert(typeof configId === 'number', 'cloned config id')
		context.configId = configId
	},
	async setDeckConfigId(context) {
		assertEqual(
			await context.client.deck.setDeckConfigId({
				configId: required(context, 'configId'),
				decks: [context.deck],
			}),
			true,
			'setDeckConfigId',
		)
	},
	async getDeckConfig(context) {
		const config = await context.client.deck.getDeckConfig({ deck: context.deck })
		assert(
			config !== false && config.dyn === false && config.id === required(context, 'configId'),
			'deck uses the cloned config',
		)
		assertEqual(
			await context.client.deck.getDeckConfig({ deck: `${context.deck}-missing` }),
			false,
			'missing deck config',
		)
	},
	async saveDeckConfig(context) {
		const config = await context.client.deck.getDeckConfig({ deck: context.deck })
		if (config === false || config.dyn === 1) {
			throw new SkipError('Requires a regular deck config from getDeckConfig')
		}

		assertEqual(
			await context.client.deck.saveDeckConfig({ config: { ...config, maxTaken: 42 } }),
			true,
			'saveDeckConfig',
		)
		const saved = await context.client.deck.getDeckConfig({ deck: context.deck })
		assert(saved !== false && saved.dyn === false && saved.maxTaken === 42, 'config saved')
	},
	async removeDeckConfigId(context) {
		const configId = required(context, 'configId')
		await context.client.deck.setDeckConfigId({ configId: 1, decks: [context.deck] })
		assertEqual(
			await context.client.deck.removeDeckConfigId({ configId }),
			true,
			'removeDeckConfigId',
		)
	},
	async changeDeck(context) {
		const cardId = required(context, 'cardId')
		const moved = `${context.deck}-moved`
		assertNull(await context.client.deck.changeDeck({ cards: [cardId], deck: moved }), 'changeDeck')
		await expectCards(context, `cid:${String(cardId)} deck:${moved}`, [cardId], 'card moved')
		await context.client.deck.changeDeck({ cards: [cardId], deck: context.deck })
		await expectCards(
			context,
			`cid:${String(cardId)} deck:${context.deck}`,
			[cardId],
			'card moved back',
		)
	},
	async deleteDecks(context) {
		const moved = `${context.deck}-moved`
		assertNull(
			await context.client.deck.deleteDecks({ cardsToo: true, decks: [moved] }),
			'deleteDecks',
		)
		const names = await context.client.deck.deckNames()
		assert(!names.includes(moved), 'deck deleted')
	},
	// Model editing
	async findModelsById(context) {
		const models = await context.client.model.findModelsById({
			modelIds: [required(context, 'modelId')],
		})
		assertEqual(models[0]?.name, context.modelName, 'model by id')
	},
	async findModelsByName(context) {
		const models = await context.client.model.findModelsByName({ modelNames: [context.modelName] })
		assertEqual(models[0]?.id, required(context, 'modelId'), 'model by name')
	},
	async modelFieldNames(context) {
		await expectFieldNames(context, ['Front', 'Back'], 'initial field names')
	},
	async modelFieldAdd(context) {
		assertNull(
			await context.client.model.modelFieldAdd({
				fieldName: 'Extra',
				index: 2,
				modelName: context.modelName,
			}),
			'modelFieldAdd',
		)
		await expectFieldNames(context, ['Front', 'Back', 'Extra'], 'field added')
	},
	async modelFieldRename(context) {
		assertNull(
			await context.client.model.modelFieldRename({
				modelName: context.modelName,
				newFieldName: 'Renamed',
				oldFieldName: 'Extra',
			}),
			'modelFieldRename',
		)
		await expectFieldNames(context, ['Front', 'Back', 'Renamed'], 'field renamed')
	},
	async modelFieldReposition(context) {
		assertNull(
			await context.client.model.modelFieldReposition({
				fieldName: 'Renamed',
				index: 1,
				modelName: context.modelName,
			}),
			'modelFieldReposition',
		)
		await expectFieldNames(context, ['Front', 'Renamed', 'Back'], 'field repositioned')
	},
	async modelFieldSetFont(context) {
		assertNull(
			await context.client.model.modelFieldSetFont({
				fieldName: 'Renamed',
				font: 'Arial',
				modelName: context.modelName,
			}),
			'modelFieldSetFont',
		)
	},
	async modelFieldSetFontSize(context) {
		assertNull(
			await context.client.model.modelFieldSetFontSize({
				fieldName: 'Renamed',
				fontSize: 24,
				modelName: context.modelName,
			}),
			'modelFieldSetFontSize',
		)
	},
	async modelFieldFonts(context) {
		const fonts = await context.client.model.modelFieldFonts({ modelName: context.modelName })
		assertEqual(fonts.Renamed, { font: 'Arial', size: 24 }, 'font and size were set')
	},
	async modelFieldSetDescription(context) {
		assertEqual(
			await context.client.model.modelFieldSetDescription({
				description: 'Test description',
				fieldName: 'Renamed',
				modelName: context.modelName,
			}),
			true,
			'modelFieldSetDescription',
		)
	},
	async modelFieldDescriptions(context) {
		assertEqual(
			await context.client.model.modelFieldDescriptions({ modelName: context.modelName }),
			['', 'Test description', ''],
			'field descriptions',
		)
	},
	async modelFieldRemove(context) {
		assertNull(
			await context.client.model.modelFieldRemove({
				fieldName: 'Renamed',
				modelName: context.modelName,
			}),
			'modelFieldRemove',
		)
		await expectFieldNames(context, ['Front', 'Back'], 'field removed')
	},
	async modelTemplateAdd(context) {
		assertNull(
			await context.client.model.modelTemplateAdd({
				modelName: context.modelName,
				template: { ...TEMPLATE, Front: '{{Back}}', Name: 'Extra' },
			}),
			'modelTemplateAdd',
		)
		const names = await templateNames(context)
		assert(names.includes('Extra'), 'template added')
	},
	async modelTemplateRename(context) {
		assertNull(
			await context.client.model.modelTemplateRename({
				modelName: context.modelName,
				newTemplateName: 'Renamed',
				oldTemplateName: 'Extra',
			}),
			'modelTemplateRename',
		)
		const names = await templateNames(context)
		assert(names.includes('Renamed'), 'template renamed')
	},
	async modelTemplateReposition(context) {
		assertNull(
			await context.client.model.modelTemplateReposition({
				index: 0,
				modelName: context.modelName,
				templateName: 'Renamed',
			}),
			'modelTemplateReposition',
		)
		const names = await templateNames(context)
		assertEqual(names[0], 'Renamed', 'template repositioned')
	},
	async modelTemplateRemove(context) {
		assertNull(
			await context.client.model.modelTemplateRemove({
				modelName: context.modelName,
				templateName: 'Renamed',
			}),
			'modelTemplateRemove',
		)
		assertEqual(await templateNames(context), ['Card 1'], 'template removed')
	},
	async updateModelTemplates(context) {
		assertNull(
			await context.client.model.updateModelTemplates({
				model: {
					name: context.modelName,
					templates: { 'Card 1': { Back: '{{Back}}', Front: '{{Front}} marker' } },
				},
			}),
			'updateModelTemplates',
		)
		const templates = await context.client.model.modelTemplates({ modelName: context.modelName })
		assertEqual(templates['Card 1']?.Front, '{{Front}} marker', 'template updated')
	},
	async modelTemplates(context) {
		const templates = await context.client.model.modelTemplates({ modelName: context.modelName })
		assertEqual(templates['Card 1']?.Back, '{{Back}}', 'template back')
	},
	async modelFieldsOnTemplates(context) {
		assertEqual(
			await context.client.model.modelFieldsOnTemplates({ modelName: context.modelName }),
			{ 'Card 1': [['Front'], ['Back']] },
			'fields on templates',
		)
	},
	async updateModelStyling(context) {
		assertNull(
			await context.client.model.updateModelStyling({
				model: { css: '.card { color: blue; }', name: context.modelName },
			}),
			'updateModelStyling',
		)
		assertEqual(
			await context.client.model.modelStyling({ modelName: context.modelName }),
			{ css: '.card { color: blue; }' },
			'styling updated',
		)
	},
	async modelStyling(context) {
		assertEqual(
			await context.client.model.modelStyling({ modelName: context.modelName }),
			{ css: '.card { color: blue; }' },
			'modelStyling',
		)
	},
	async findAndReplaceInModels(context) {
		assertEqual(
			await context.client.model.findAndReplaceInModels({
				back: true,
				css: true,
				findText: 'marker',
				front: true,
				modelName: context.modelName,
				replaceText: 'replaced',
			}),
			1,
			'findAndReplaceInModels',
		)
		const templates = await context.client.model.modelTemplates({ modelName: context.modelName })
		assertEqual(templates['Card 1']?.Front, '{{Front}} replaced', 'text replaced')
	},
	// Packages
	async exportPackage(context) {
		assertEqual(
			await context.client.miscellaneous.exportPackage({
				deck: context.deck,
				includeSched: true,
				path: context.packagePath,
			}),
			true,
			'exportPackage',
		)
		assert(fs.existsSync(context.packagePath), 'package file written')
	},
	async importPackage(context) {
		const noteId = required(context, 'noteId')
		if (!fs.existsSync(context.packagePath)) {
			throw new SkipError('Requires the package from exportPackage')
		}

		await context.client.note.deleteNotes({ notes: [noteId] })
		await expectNotes(context, `nid:${String(noteId)}`, [], 'note deleted before import')
		assertEqual(
			await context.client.miscellaneous.importPackage({ path: context.packagePath }),
			true,
			'importPackage',
		)
		await expectNotes(context, `nid:${String(noteId)}`, [noteId], 'note restored from package')
		const cards = await context.client.card.findCards({ query: `nid:${String(noteId)}` })
		context.cardId = cards[0]
	},
	// Cleanup
	async deleteNotes(context) {
		const extraNoteId = required(context, 'extraNoteId')
		assertNull(await context.client.note.deleteNotes({ notes: [extraNoteId] }), 'deleteNotes')
		await expectNotes(context, `nid:${String(extraNoteId)}`, [], 'note deleted')
	},
	async clearUnusedTags({ client }) {
		assertNull(await client.note.clearUnusedTags(), 'clearUnusedTags')
	},
	async removeEmptyNotes({ client }) {
		assertNull(await client.note.removeEmptyNotes(), 'removeEmptyNotes')
	},
	// Graphical
	async guiDeckBrowser({ client }) {
		assertNull(await client.graphical.guiDeckBrowser(), 'guiDeckBrowser')
	},
	async guiCheckDatabase({ client }) {
		assertEqual(await client.graphical.guiCheckDatabase(), true, 'guiCheckDatabase')
	},
	async guiDeckOverview(context) {
		const open = async () => context.client.graphical.guiDeckOverview({ name: context.deck })
		await settle(context, open, (result) => result, 'deck overview')
		assertEqual(await open(), true, 'guiDeckOverview')
	},
	async guiDeckReview(context) {
		assertEqual(
			await context.client.graphical.guiDeckReview({ name: context.deck }),
			true,
			'guiDeckReview',
		)
	},
	async guiCurrentCard(context) {
		const cardId = required(context, 'cardId')
		const current = async () => context.client.graphical.guiCurrentCard()
		await settle(context, current, (card) => card.cardId === cardId, 'review of the card')
		const card = await current()
		assertEqual(card.cardId, cardId, 'guiCurrentCard')
	},
	async guiStartCardTimer({ client }) {
		assertEqual(await client.graphical.guiStartCardTimer(), true, 'guiStartCardTimer')
	},
	async guiShowQuestion({ client }) {
		assertEqual(await client.graphical.guiShowQuestion(), true, 'guiShowQuestion')
	},
	async guiPlayAudio({ client }) {
		assertEqual(await client.graphical.guiPlayAudio(), true, 'guiPlayAudio')
	},
	async guiShowAnswer({ client }) {
		assertEqual(await client.graphical.guiShowAnswer(), true, 'guiShowAnswer')
	},
	async guiAnswerCard({ client }) {
		assertEqual(await client.graphical.guiAnswerCard({ ease: 3 }), true, 'guiAnswerCard')
	},
	async guiUndo({ client }) {
		assertEqual(await client.graphical.guiUndo(), true, 'guiUndo')
	},
	async guiImportFile(context) {
		if (!fs.existsSync(context.packagePath)) {
			throw new SkipError('Requires the package from exportPackage')
		}

		assertNull(
			await context.client.graphical.guiImportFile({ path: context.packagePath }),
			'guiImportFile',
		)
	},
	async guiBrowse(context) {
		const cardId = required(context, 'cardId')
		const browse = async () =>
			context.client.graphical.guiBrowse({
				query: `nid:${String(required(context, 'noteId'))}`,
				reorderCards: { columnId: 'cardDue', order: 'ascending' },
			})
		await settle(context, browse, (cards) => cards.includes(cardId), 'card browser')
		const cards = await browse()
		assert(cards.includes(cardId), 'guiBrowse lists the card')
	},
	async guiSelectCard(context) {
		assertEqual(
			await context.client.graphical.guiSelectCard({ card: required(context, 'cardId') }),
			true,
			'guiSelectCard',
		)
	},
	async guiSelectedNotes(context) {
		const noteId = required(context, 'noteId')
		const selected = async () => context.client.graphical.guiSelectedNotes()
		await settle(context, selected, (notes) => isDeepStrictEqual(notes, [noteId]), 'note selection')
		assertEqual(await selected(), [noteId], 'guiSelectedNotes')
	},
	async guiSelectNote(context) {
		// The deprecated endpoint takes a card ID despite the parameter name.
		assertEqual(
			// eslint-disable-next-line ts/no-deprecated -- The deprecated endpoint is part of the documented client.
			await context.client.graphical.guiSelectNote({ note: required(context, 'cardId') }),
			true,
			'guiSelectNote',
		)
	},
	async guiEditNote(context) {
		assertNull(
			await context.client.graphical.guiEditNote({ note: required(context, 'noteId') }),
			'guiEditNote',
		)
	},
	async guiAddCards(context) {
		const id = await context.client.graphical.guiAddCards({
			note: {
				deckName: context.deck,
				fields: { Back: '', Front: '' },
				modelName: context.modelName,
				...media(context),
				tags: [context.deck],
			},
		})
		assert(Number.isInteger(id), 'guiAddCards note id')
	},
	async guiExitAnki({ client }) {
		assertNull(await client.graphical.guiExitAnki(), 'guiExitAnki')
	},
	// Requires an AnkiWeb account, which the disposable profile does not have.
	sync: 'untestable',
}
/* eslint-enable perfectionist/sort-objects */

function classify(error: unknown): ActionOutcome {
	const message = truncate(error instanceof Error ? error.message : String(error))
	if (error instanceof SkipError) {
		return { detail: message, status: 'skipped' }
	}

	const status = error instanceof BehaviorError ? 'failed' : 'error'
	return { detail: message, status }
}

/** Serve media bytes to AnkiConnect for the `url` media variant. */
async function startMediaServer(): Promise<{
	close: () => void
	url: (filename: string) => string
}> {
	const server = http.createServer((request, response) => {
		response.statusCode = request.url?.startsWith('/') === true ? 200 : 404
		response.end('test')
	})
	server.listen(0, '127.0.0.1')
	await once(server, 'listening')
	const address = server.address()
	if (address === null || typeof address === 'string') {
		throw new Error('Media server did not report a port')
	}

	return {
		close() {
			server.close()
		},
		url: (filename) => `http://127.0.0.1:${String(address.port)}/${filename}`,
	}
}

/**
 * Exercise every client action against the AnkiConnect instance at the given
 * host and port, recording each successful response for signature checks.
 * Actions never abort the run: each one records its own outcome.
 */
export async function probe(options: ProbeOptions = {}): Promise<ProbeReport> {
	const timeout = options.timeout ?? 30_000
	const records: ProbeRecord[] = []
	const calls: Actions[] = []
	let recording = true
	const { YankiConnect } = await loadClient()
	const client = new YankiConnect({
		async fetchAdapter(input, init) {
			const request = JSON.parse(init!.body!) as { action: Actions }
			calls.push(request.action)
			// eslint-disable-next-line node/no-unsupported-features/node-builtins -- Scripts run on the development Node version.
			const response = await fetch(input, { ...init, signal: AbortSignal.timeout(timeout) })
			// eslint-disable-next-line ts/no-restricted-types -- AnkiConnect responses use JSON null.
			const body = (await response.clone().json()) as { error: null | string; result: unknown }
			if (recording && response.status === 200 && body.error === null) {
				records.push({ action: request.action, result: body.result })
			}

			return response
		},
		...(options.host !== undefined && { host: options.host }),
		...(options.port !== undefined && { port: options.port }),
	})

	const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'yanki-compat-probe-'))
	const deck = `yanki-compat-${String(Date.now())}`
	const mediaServer = await startMediaServer()
	const context: Context = {
		client,
		clozeModelName: `${deck}-cloze`,
		deck,
		mediaUrl: mediaServer.url,
		modelName: `${deck}-model`,
		packagePath: path.join(directory, `${deck}.apkg`),
		textPath: path.join(directory, 'text.txt'),
		async unrecorded(task) {
			recording = false
			try {
				return await task()
			} finally {
				recording = true
			}
		},
		videoPath: path.join(directory, 'video.mp4'),
	}
	await fs.promises.writeFile(context.textPath, 'test')
	await fs.promises.writeFile(context.videoPath, 'test')

	const outcomes: Partial<Record<Actions, ActionOutcome>> = {}
	try {
		for (const [action, probeCase] of Object.entries(cases) as Array<
			[Actions, 'untestable' | ProbeCase]
		>) {
			if (probeCase === 'untestable') {
				outcomes[action] = { detail: 'Not testable in an isolated profile', status: 'untestable' }
				continue
			}

			const before = calls.length
			try {
				await probeCase(context)
				outcomes[action] = calls.slice(before).includes(action)
					? { status: 'ok' }
					: { detail: `Probe did not call ${action}`, status: 'failed' }
			} catch (error) {
				outcomes[action] = classify(error)
			}
		}
	} finally {
		mediaServer.close()
		await fs.promises.rm(directory, { force: true, recursive: true })
	}

	return {
		actions: applySignatureChecks(outcomes, records),
		records,
	}
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const report = await probe()
	console.log(JSON.stringify(report.actions, undefined, '\t'))
	const summary: Record<string, number> = {}
	for (const outcome of Object.values(report.actions)) {
		summary[outcome.status] = (summary[outcome.status] ?? 0) + 1
	}

	console.error(JSON.stringify(summary))
}
