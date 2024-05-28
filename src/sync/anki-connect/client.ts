/* eslint-disable @typescript-eslint/member-ordering */
/* eslint-disable @typescript-eslint/unified-signatures */

import { launchAnkiApp } from './anki-launcher'
import type {
	Actions,
	ActionsWithParams,
	ActionsWithoutParams,
	ParamsForAction,
	ResponseForAction,
	ResultForAction,
} from './types/shared'

type ClientOptions = {
	/**
	 * Attempt to open the desktop Anki.app if it's not already running.
	 *
	 * - `true` will always attempt to open Anki _when a request is made_. This might introduce significant latency on the first launch.
	 * - `false` (default) will never attempt to open Anki. Requests will fail until something or someone else opens the Anki app.
	 * -  `immediately` is a special option that will open Anki when the client is instantiated.
	 *
	 * The Anki desktop app must be running for the client and the underlying AnkiConnect service to work.
	 *
	 *
	 * The client does not attempt to close the app.
	 *  */
	autoLaunchAnki?: 'immediately' | boolean
	/** Host where the AnkiConnect service is running. */
	host?: string
	/** Anki-Connect security key (optional) */
	key?: string
	/** Port where the AnkiConnect service is running. */
	port?: number
	/** Only version 6 is supported for now. */
	version?: 6
}

/**
 * AnkiConnectClient is a client for the [Anki-Connect API](https://foosoft.net/projects/anki-connect/)
 *
 * It implements every endpoint as of May 2024.
 *
 */
export class AnkiConnectClient {
	private readonly autoLaunchAnki: 'immediately' | boolean

	private readonly host: string

	private readonly key?: string

	private readonly port: number

	private readonly version: number

	/**
	 * Card Actions
	 * [Documentation](https://foosoft.net/projects/anki-connect/index.html#card-actions)
	 */
	public readonly card = {
		/** Answer cards. Ease is between 1 (Again) and 4 (Easy). Will start the
		 * timer immediately before answering. Returns true if card exists, `false`
		 * otherwise. */
		answerCards: this.build('answerCards'),
		/** Returns an array indicating whether each of the given cards is due (in
		 * the same order). Note: cards in the learning queue with a large interval
		 * (over 20 minutes) are treated as not due until the time of their interval
		 * has passed, to match the way Anki treats them when reviewing. */
		areDue: this.build('areDue'),
		/** Returns an array indicating whether each of the given cards is suspended
		 * (in the same order). If card doesn’t exist returns `null`. */
		areSuspended: this.build('areSuspended'),
		/** Returns a list of objects containing for each card ID the card fields,
		 * front and back sides including CSS, note type, the note that the card
		 * belongs to, and deck name, last modification timestamp as well as ease
		 * and interval. */
		cardsInfo: this.build('cardsInfo'),
		/** Returns a list of objects containing for each card ID the modification
		 * time. This function is about 15 times faster than executing `cardsInfo`.
		 * */
		cardsModTime: this.build('cardsModTime'),
		/** Returns an unordered array of note IDs for the given card IDs. For cards
		 * with the same note, the ID is only given once in the array. */
		cardsToNotes: this.build('cardsToNotes'),
		/** Returns an array of card IDs for a given query. Functionally identical
		 * to `guiBrowse` but doesn’t use the GUI for better performance. */
		findCards: this.build('findCards'),
		/** Forget cards, making the cards new again. */
		forgetCards: this.build('forgetCards'),
		/** Returns an array with the ease factor for each of the given cards (in
		 * the same order). */
		getEaseFactors: this.build('getEaseFactors'),
		/** Returns an array of the most recent intervals for each given card ID, or
		 * a 2-dimensional array of all the intervals for each given card ID when
		 * complete is `true`. Negative intervals are in seconds and positive
		 * intervals in days. */
		getIntervals: this.build('getIntervals'),
		/** Make cards be “relearning”. */
		relearnCards: this.build('relearnCards'),
		/** Sets ease factor of cards by card ID; returns `true` if successful (all
		 * cards existed) or `false` otherwise. */
		setEaseFactors: this.build('setEaseFactors'),
		/** Sets specific value of a single card. Given the risk of wreaking havoc
		 * in the database when changing some of the values of a card, some of the
		 * keys require the argument “warning_check” set to True. This can be used
		 * to set a card’s flag, change it’s ease factor, change the review order in
		 * a filtered deck and change the column “data” (not currently used by anki
		 * apparently), and many other values. A list of values and explanation of
		 * their respective utility can be found at [AnkiDroid’s
		 * wiki](https://github.com/ankidroid/Anki-Android/wiki/Database-Structure).
		 * */
		setSpecificValueOfCard: this.build('setSpecificValueOfCard'),
		/** Suspend cards by card ID; returns `true` if successful (at least one
		 * card wasn’t already suspended) or `false` otherwise. */
		suspend: this.build('suspend'),
		/** Check if card is suspended by its ID. Returns `true` if suspended,
		 * `false` otherwise. */
		suspended: this.build('suspended'),
		/** Unsuspend cards by card ID; returns `true` if successful (at least one
		 * card was previously suspended) or `false` otherwise. */
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

	constructor(options?: ClientOptions) {
		this.port = options?.port ?? 8765
		this.version = options?.version ?? 6
		this.autoLaunchAnki = options?.autoLaunchAnki ?? false
		this.key = options?.key ?? undefined
		this.host = options?.host ?? 'http://127.0.0.1'

		if (this.version !== 6) {
			throw new Error('AnkiConnectClient only supports version 6')
		}

		if (this.autoLaunchAnki === 'immediately') {
			void launchAnkiApp()
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
		let response: Response
		let responseJson: ResponseForAction<T>
		try {
			response = await fetch(`${this.host}:${this.port}`, {
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

			if (response === undefined) {
				throw new Error('Anki-Connect response is undefined')
			}

			if (!response.ok) {
				throw new Error('failed to issue request')
			}

			responseJson = (await response.json()) as ResponseForAction<T>

			if (this.autoLaunchAnki !== false && responseJson.error === 'collection is not available') {
				throw new Error(responseJson.error)
			}
		} catch (error) {
			// Attempt restart
			if (this.autoLaunchAnki !== false) {
				console.log("Can't connect to Anki app, retrying...")

				// Internally throttled
				await launchAnkiApp()

				await new Promise((resolve) => {
					setTimeout(resolve, 500)
				})

				if (params === undefined) {
					return this.invoke(action as ActionsWithoutParams) as Promise<ResponseForAction<T>>
				}

				return this.invoke(action as ActionsWithParams, params) as Promise<ResponseForAction<T>>
			}

			throw error
		}

		// Non-recoverable by launching app
		if (!('error' in responseJson)) {
			throw new Error('response is missing required error field')
		}

		if (!('result' in responseJson)) {
			throw new Error('response is missing required result field')
		}

		return responseJson
	}
}

const client = new AnkiConnectClient({ autoLaunchAnki: true })
// Const t1 = await client.deck.deckNames()
const t1 = await client.invoke('deckNames')

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
