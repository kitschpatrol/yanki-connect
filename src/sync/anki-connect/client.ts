/* eslint-disable @typescript-eslint/member-ordering */
/* eslint-disable @typescript-eslint/unified-signatures */

import type {
	Actions,
	ActionsWithParams,
	ActionsWithoutParams,
	ParamsForAction,
	ResponseForAction,
	ResultForAction,
} from './types/shared'

/**
 * AnkiConnectClient is a client for the AnkiConnect API.
 *
 * It implements every endpoint as of May 2024.
 *
 */
export class AnkiConnectClient {
	/**
	 * Card-related notes.
	 */
	public readonly card = {
		answerCards: this.build('answerCards'),
		areDue: this.build('areDue'),
		areSuspended: this.build('areSuspended'),
		cardsInfo: this.build('cardsInfo'),
		cardsModTime: this.build('cardsModTime'),
		cardsToNotes: this.build('cardsToNotes'),
		findCards: this.build('findCards'),
		forgetCards: this.build('forgetCards'),
		getEaseFactors: this.build('getEaseFactors'),
		getIntervals: this.build('getIntervals'),
		relearnCards: this.build('relearnCards'),
		setEaseFactors: this.build('setEaseFactors'),
		setSpecificValueOfCard: this.build('setSpecificValueOfCard'),
		suspend: this.build('suspend'),
		suspended: this.build('suspended'),
		unsuspend: this.build('unsuspend'),
	}

	/**
	 * Deck-related notes.
	 */
	public readonly deck = {
		changeDeck: this.build('changeDeck'),
		cloneDeckConfigId: this.build('cloneDeckConfigId'),
		createDeck: this.build('createDeck'),
		deckNames: this.build('deckNames'),
		deckNamesAndIds: this.build('deckNamesAndIds'),
		deleteDecks: this.build('deleteDecks'),
		getDeckConfig: this.build('getDeckConfig'),
		getDeckStats: this.build('getDeckStats'),
		getDecks: this.build('getDecks'),
		removeDeckConfigId: this.build('removeDeckConfigId'),
		saveDeckConfig: this.build('saveDeckConfig'),
		setDeckConfigId: this.build('setDeckConfigId'),
	}

	/**
	 * Graphical
	 */
	public readonly graphical = {
		guiAddCards: this.build('guiAddCards'),
		guiAnswerCard: this.build('guiAnswerCard'),
		guiBrowse: this.build('guiBrowse'),
		guiCheckDatabase: this.build('guiCheckDatabase'),
		guiCurrentCard: this.build('guiCurrentCard'),
		guiDeckBrowser: this.build('guiDeckBrowser'),
		guiDeckOverview: this.build('guiDeckOverview'),
		guiDeckReview: this.build('guiDeckReview'),
		guiEditNote: this.build('guiEditNote'),
		guiExitAnki: this.build('guiExitAnki'),
		guiImportFile: this.build('guiImportFile'),
		guiSelectNote: this.build('guiSelectNote'),
		guiSelectNotes: this.build('guiSelectNotes'),
		guiShowAnswer: this.build('guiShowAnswer'),
		guiShowQuestion: this.build('guiShowQuestion'),
		guiStartCardTimer: this.build('guiStartCardTimer'),
		guiUndo: this.build('guiUndo'),
	}

	/**
	 * Media
	 */
	public readonly media = {
		deleteMediaFile: this.build('deleteMediaFile'),
		getMediaDirPath: this.build('getMediaDirPath'),
		getMediaFilesNames: this.build('getMediaFilesNames'),
		retrieveMediaFile: this.build('retrieveMediaFile'),
		storeMediaFile: this.build('storeMediaFile'),
	}

	/**
	 * Miscellaneous
	 */
	public readonly miscellaneous = {
		apiReflect: this.build('apiReflect'),
		exportPackage: this.build('exportPackage'),
		getProfiles: this.build('getProfiles'),
		importPackage: this.build('importPackage'),
		loadProfile: this.build('loadProfile'),
		multi: this.build('multi'),
		reloadCollection: this.build('reloadCollection'),
		requestPermission: this.build('requestPermission'),
		sync: this.build('sync'),
		version: this.build('version'),
	}

	/**
	 * Model
	 */
	public readonly model = {
		createModel: this.build('createModel'),
		findAndReplaceInModels: this.build('findAndReplaceInModels'),
		findModelsById: this.build('findModelsById'),
		findModelsByName: this.build('findModelsByName'),
		modelFieldAdd: this.build('modelFieldAdd'),
		modelFieldDescriptions: this.build('modelFieldDescriptions'),
		modelFieldFonts: this.build('modelFieldFonts'),
		modelFieldNames: this.build('modelFieldNames'),
		modelFieldRemove: this.build('modelFieldRemove'),
		modelFieldRename: this.build('modelFieldRename'),
		modelFieldReposition: this.build('modelFieldReposition'),
		modelFieldSetDescription: this.build('modelFieldSetDescription'),
		modelFieldSetFont: this.build('modelFieldSetFont'),
		modelFieldSetFontSize: this.build('modelFieldSetFontSize'),
		modelFieldsOnTemplates: this.build('modelFieldsOnTemplates'),
		modelNames: this.build('modelNames'),
		modelNamesAndIds: this.build('modelNamesAndIds'),
		modelStyling: this.build('modelStyling'),
		modelTemplateAdd: this.build('modelTemplateAdd'),
		modelTemplateRemove: this.build('modelTemplateRemove'),
		modelTemplateRename: this.build('modelTemplateRename'),
		modelTemplateReposition: this.build('modelTemplateReposition'),
		modelTemplates: this.build('modelTemplates'),
		updateModelStyling: this.build('updateModelStyling'),
		updateModelTemplates: this.build('updateModelTemplates'),
	}

	/**
	 * Note
	 */
	public readonly note = {
		addNote: this.build('addNote'),
		addNotes: this.build('addNotes'),
		addTags: this.build('addTags'),
		canAddNotes: this.build('canAddNotes'),
		canAddNotesWithErrorDetail: this.build('canAddNotesWithErrorDetail'),
		clearUnusedTags: this.build('clearUnusedTags'),
		deleteNotes: this.build('deleteNotes'),
		findNotes: this.build('findNotes'),
		getNoteTags: this.build('getNoteTags'),
		getTags: this.build('getTags'),
		notesInfo: this.build('notesInfo'),
		removeEmptyNotes: this.build('removeEmptyNotes'),
		removeTags: this.build('removeTags'),
		replaceTags: this.build('replaceTags'),
		replaceTagsInAllNotes: this.build('replaceTagsInAllNotes'),
		updateNote: this.build('updateNote'),
		updateNoteFields: this.build('updateNoteFields'),
		updateNoteModel: this.build('updateNoteModel'),
		updateNoteTags: this.build('updateNoteTags'),
	}

	/**
	 * Statistic
	 */
	public readonly statistic = {
		cardReviews: this.build('cardReviews'),
		getCollectionStatsHTML: this.build('getCollectionStatsHTML'),
		getLatestReviewID: this.build('getLatestReviewID'),
		getNumCardsReviewedByDay: this.build('getNumCardsReviewedByDay'),
		getNumCardsReviewedToday: this.build('getNumCardsReviewedToday'),
		getReviewsOfCards: this.build('getReviewsOfCards'),
		insertReviews: this.build('insertReviews'),
	}

	constructor(
		private readonly host = 'http://127.0.0.1',
		private readonly port = 8765,
		private readonly version = 6,
		private readonly key?: string,
	) {
		if (version !== 6) {
			throw new Error('AnkiConnectClient only supports version 6')
		}
	}

	//

	/**
	 * Factory for creating convenience functions for each action.
	 * Overload for actions with / without params
	 *
	 * Note that the results are provided as the Result field! Any errors, even from Anki will throw.
	 */
	private build<T extends ActionsWithoutParams>(action: T): () => Promise<ResultForAction<T>>
	private build<T extends ActionsWithParams>(
		action: T,
	): (params: ParamsForAction<T>) => Promise<ResultForAction<T>>

	private build<T extends Actions>(
		action: T,
	): (params?: ParamsForAction<T>) => Promise<ResultForAction<T>>

	// // Implementation
	private build<T extends ActionsWithParams>(
		action: T,
	): (params?: ParamsForAction<T>) => Promise<ResultForAction<T>> {
		// Bang is a type appeasement...
		return async (params?: ParamsForAction<T>) => {
			const response = await this.invoke<T>(action, params!)
			if (response.error !== null) {
				throw new Error(String(response.error))
			}

			return response.result as ResultForAction<T>
		}
	}

	/**
	 *  Single point of contact with the Anki Connect API.
	 *
	 *  Primarily for internal use, since the client provides a more convenient methods on its class.
	 */
	public async invoke<T extends ActionsWithoutParams>(action: T): Promise<ResponseForAction<T>>
	public async invoke<T extends ActionsWithParams>(
		action: T,
		params: ParamsForAction<T>,
	): Promise<ResponseForAction<T>>
	public async invoke<T extends Actions>(
		action: T,
		params?: T extends ActionsWithParams ? ParamsForAction<T> : undefined,
	): Promise<ResponseForAction<T>> {
		const response = await fetch(`${this.host}:${this.port}`, {
			body: JSON.stringify({
				action,
				...(this.key === undefined ? {} : { key: this.key }),
				params,
				version: this.version,
			}),
			headers: {
				'Content-Type': 'application/json',
			},
			method: 'POST',
		})

		if (!response.ok) {
			throw new Error('failed to issue request')
		}

		const responseJson = (await response.json()) as Record<string, unknown>

		// Borrowing some validation from chenlijun99/autoanki
		if (Object.getOwnPropertyNames(responseJson).length !== 2) {
			throw new Error('Response has an unexpected number of fields.')
		}

		if (!('error' in responseJson)) {
			throw new Error('response is missing required error field')
		}

		if (!('result' in responseJson)) {
			throw new Error('response is missing required result field')
		}

		return responseJson as unknown as Promise<ResponseForAction<T>>
	}
}

const client = new AnkiConnectClient()
// Const t1 = await client.invoke('cardReviews', { deck: 'Default', startID: 0 })
const t1 = await client.deck.deckNamesAndIds()

console.log(t1)

// --------------------------

// Everything but the return params type seems to work...
// private groupFactory<U extends Requests>(...actions: ActionsForRequests<U>[]): Record<ActionsForRequests<U>, (params?: ParamsForAction<ActionsForRequests<U>>) => Promise<ResponseForAction<ActionsForRequests<U>>>>{
// 	return actions.reduce((accumulator, action) => {
// 		accumulator[action] = this.convenienceFunctionFactory(action)
// 		return accumulator
// 	}, {} as Record<ActionsForRequests<U>, (params?: ParamsForAction<ActionsForRequests<U>>) => Promise<ResponseForAction<ActionsForRequests<U>>>>)
// }

// public decksTest = this.groupFactory<DeckRequests>('deckNames', 'changeDeck', 'cloneDeckConfigId', 'createDeck', 'deckNamesAndIds', 'deleteDecks')

// --------------------------
