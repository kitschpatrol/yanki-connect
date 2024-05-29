/* eslint-disable @typescript-eslint/member-ordering */
/* eslint-disable @typescript-eslint/unified-signatures */

import { launchAnkiApp } from './launcher'
import type {
	Actions,
	ActionsWithParams,
	ActionsWithoutParams,
	AnkiConnectVersion,
	ParamsForAction,
	ResponseForAction,
	ResultForAction,
} from './types/shared'
import { platform } from 'node:process'

/** Optional options to pass when instantiating a new YankiConnect instance. */
export type YankiConnectOptions = {
	/**
	 * Attempt to open the desktop Anki.app if it's not already running.
	 *
	 * - `true` will always attempt to open Anki _when a request is made_. This might introduce significant latency on the first launch.
	 * - `false` will never attempt to open Anki. Requests will fail until something or someone else opens the Anki app.
	 * -  `immediately` is a special option that will open Anki when the client is instantiated.
	 *
	 * The Anki desktop app must be running for the client and the underlying AnkiConnect service to work.
	 *
	 * Currently supported on macOS only.
	 *
	 * The client does not attempt to close the app.
	 *
	 * @default false
	 */
	autoLaunchAnki?: 'immediately' | boolean
	/**
	 * Host where the Anki-Connect service is running.
	 *
	 * @default 'http://127.0.0.1'
	 */
	host?: string
	/**
	 * Anki-Connect security key (optional)
	 *
	 * @default undefined
	 */
	key?: string
	/**
	 * Port where the Anki-Connect service is running.
	 *
	 * @default 8765
	 */
	port?: number
	/**
	 * Anki-Connect API version.
	 *
	 * Only API version 6 is supported for now.
	 *
	 * @default 6
	 */
	version?: AnkiConnectVersion
}

/**
 * __YankiConnect is a client for the [Anki-Connect API](https://foosoft.net/projects/anki-connect/)__
 *
 * It implements every endpoint as of May 2024.
 */
export class YankiConnect {
	private readonly autoLaunchAnki: 'immediately' | boolean
	private readonly host: string
	private readonly key?: string
	private readonly port: number
	private readonly version: AnkiConnectVersion

	/**
	 * __Card Actions__
	 *
	 * [Documentation](https://foosoft.net/projects/anki-connect/index.html#card-actions)
	 */
	public readonly card = {
		/**
		 * Answer cards. Ease is between 1 (Again) and 4 (Easy). Will start the
		 * timer immediately before answering. Returns true if card exists, `false`
		 * otherwise.
		 */
		answerCards: this.build('answerCards'),
		/**
		 * Returns an array indicating whether each of the given cards is due (in
		 * the same order). Note: cards in the learning queue with a large interval
		 * (over 20 minutes) are treated as not due until the time of their interval
		 * has passed, to match the way Anki treats them when reviewing.
		 */
		areDue: this.build('areDue'),
		/**
		 * Returns an array indicating whether each of the given cards is suspended
		 * (in the same order). If card doesn’t exist returns `null`.
		 */
		areSuspended: this.build('areSuspended'),
		/**
		 * Returns a list of objects containing for each card ID the card fields,
		 * front and back sides including CSS, note type, the note that the card
		 * belongs to, and deck name, last modification timestamp as well as ease
		 * and interval.
		 */
		cardsInfo: this.build('cardsInfo'),
		/**
		 * Returns a list of objects containing for each card ID the modification
		 * time. This function is about 15 times faster than executing `cardsInfo`.
		 */
		cardsModTime: this.build('cardsModTime'),
		/**
		 * Returns an unordered array of note IDs for the given card IDs. For cards
		 * with the same note, the ID is only given once in the array.
		 */
		cardsToNotes: this.build('cardsToNotes'),
		/**
		 * Returns an array of card IDs for a given query. Functionally identical
		 * to `guiBrowse` but doesn’t use the GUI for better performance.
		 */
		findCards: this.build('findCards'),
		/**
		 * Forget cards, making the cards new again.
		 */
		forgetCards: this.build('forgetCards'),
		/**
		 * Returns an array with the ease factor for each of the given cards (in
		 * the same order).
		 */
		getEaseFactors: this.build('getEaseFactors'),
		/**
		 * Returns an array of the most recent intervals for each given card ID, or
		 * a 2-dimensional array of all the intervals for each given card ID when
		 * complete is `true`. Negative intervals are in seconds and positive
		 * intervals in days.
		 */
		getIntervals: this.build('getIntervals'),
		/**
		 * Make cards be “relearning”.
		 */
		relearnCards: this.build('relearnCards'),
		/**
		 * Sets ease factor of cards by card ID; returns `true` if successful (all
		 * cards existed) or `false` otherwise.
		 */
		setEaseFactors: this.build('setEaseFactors'),
		/**
		 * Sets specific value of a single card. Given the risk of wreaking havoc
		 * in the database when changing some of the values of a card, some of the
		 * keys require the argument “warning_check” set to True. This can be used
		 * to set a card’s flag, change it’s ease factor, change the review order in
		 * a filtered deck and change the column “data” (not currently used by anki
		 * apparently), and many other values. A list of values and explanation of
		 * their respective utility can be found at [AnkiDroid’s
		 * wiki](https://github.com/ankidroid/Anki-Android/wiki/Database-Structure).
		 */
		setSpecificValueOfCard: this.build('setSpecificValueOfCard'),
		/**
		 * Suspend cards by card ID; returns `true` if successful (at least one
		 * card wasn’t already suspended) or `false` otherwise.
		 */
		suspend: this.build('suspend'),
		/**
		 * Check if card is suspended by its ID. Returns `true` if suspended,
		 * `false` otherwise.
		 */
		suspended: this.build('suspended'),
		/**
		 * Unsuspend cards by card ID; returns `true` if successful (at least one
		 * card was previously suspended) or `false` otherwise.
		 */
		unsuspend: this.build('unsuspend'),
	}

	/**
	 * __Deck Actions__
	 *
	 * [Documentation](https://foosoft.net/projects/anki-connect/index.html#deck-actions)
	 */
	public readonly deck = {
		/**
		 * Moves cards with the given IDs to a different deck, creating the deck if
		 * it doesn’t exist yet.
		 */
		changeDeck: this.build('changeDeck'),
		/**
		 * Creates a new configuration group with the given name, cloning from the
		 * group with the given ID, or from the default group if this is
		 * unspecified. Returns the ID of the new configuration group, or `false` if
		 * the specified group to clone from does not exist.
		 * */
		cloneDeckConfigId: this.build('cloneDeckConfigId'),
		/**
		 * Create a new empty deck. Will not overwrite a deck that exists with the
		 * same name.
		 */
		createDeck: this.build('createDeck'),
		/**
		 * Gets the complete list of deck names for the current user.
		 */
		deckNames: this.build('deckNames'),
		/**
		 * Gets the complete list of deck names and their respective IDs for the
		 * current user.
		 */
		deckNamesAndIds: this.build('deckNamesAndIds'),
		/**
		 * Deletes decks with the given names. The argument `cardsToo` must be
		 * specified and set to `true`.
		 */
		deleteDecks: this.build('deleteDecks'),
		/**
		 * Gets the configuration group object for the given deck.
		 */
		getDeckConfig: this.build('getDeckConfig'),
		/** Gets statistics such as total cards and cards due for the given decks.
		 */
		getDeckStats: this.build('getDeckStats'),
		/**
		 * Accepts an array of card IDs and returns an object with each deck name
		 * as a key, and its value an array of the given cards which belong to it.
		 */
		getDecks: this.build('getDecks'),
		/**
		 * Removes the configuration group with the given ID, returning `true` if
		 * successful, or `false` if attempting to remove either the default
		 * configuration group (ID = 1) or a configuration group that does not
		 * exist.
		 */
		removeDeckConfigId: this.build('removeDeckConfigId'),
		/**
		 * Saves the given configuration group, returning `true` on success or
		 * `false` if the ID of the configuration group is invalid (such as when it
		 * does not exist).
		 * */
		saveDeckConfig: this.build('saveDeckConfig'),
		/**
		 * Changes the configuration group for the given decks to the one with the
		 * given ID. Returns `true` on success or `false` if the given configuration
		 * group or any of the given decks do not exist.
		 */
		setDeckConfigId: this.build('setDeckConfigId'),
	}

	/**
	 * __Graphical Actions__
	 *
	 * [Documentation](https://foosoft.net/projects/anki-connect/index.html#graphical-actions)
	 */
	public readonly graphical = {
		/**
		 * Invokes the _Add Cards_ dialog, presets the note using the given deck and
		 * model, with the provided field values and tags. Invoking it multiple
		 * times closes the old window and _reopen the window_ with the new provided
		 * values.
		 *
		 * Audio, video, and picture files can be embedded into the fields via the
		 * `audio`, `video`, and `picture` keys, respectively. Refer to the
		 * documentation of `addNote` and `storeMediaFile` for an explanation of
		 * these fields.
		 *
		 * The result is the ID of the note which would be added, if the user chose
		 * to confirm the _Add Cards_ dialogue.
		 */
		guiAddCards: this.build('guiAddCards'),
		/**
		 * Answers the current card; returns `true` if succeeded or `false`
		 * otherwise. Note that the answer for the current card must be displayed
		 * before before any answer can be accepted by Anki.
		 */
		guiAnswerCard: this.build('guiAnswerCard'),
		/**
		 * Invokes the _Card Browser_ dialog and searches for a given query.
		 * Returns an array of identifiers of the cards that were found. Query
		 * syntax is [documented here](https://docs.ankiweb.net/searching.html).
		 *
		 * Optionally, the `reorderCards` property can be provided to reorder the
		 * cards shown in the _Card Browser_. This is an array including the `order`
		 * and `columnId` objects. `order` can be either `ascending` or `descending`
		 * while `columnId` can be one of several column identifiers (as documented
		 * in the [Anki source
		 * code](https://github.com/ankitects/anki/blob/main/rslib/src/browser_table.rs)).
		 * The specified column needs to be visible in the _Card Browser_.
		 */
		guiBrowse: this.build('guiBrowse'),
		/**
		 * Requests a database check, but returns immediately without waiting for
		 * the check to complete. Therefore, the action will always return `true`
		 * even if errors are detected during the database check.
		 */
		guiCheckDatabase: this.build('guiCheckDatabase'),
		/**
		 * Returns information about the current card or `null` if not in review
		 * mode.
		 */
		guiCurrentCard: this.build('guiCurrentCard'),
		/**
		 * Opens the _Deck Browser_ dialog.
		 */
		guiDeckBrowser: this.build('guiDeckBrowser'),
		/**
		 * Opens the _Deck Overview_ dialog for the deck with the given name;
		 * returns `true` if succeeded or `false` otherwise.
		 */
		guiDeckOverview: this.build('guiDeckOverview'),
		/**
		 * Starts review for the deck with the given name; returns `true` if
		 * succeeded or `false` otherwise.
		 */
		guiDeckReview: this.build('guiDeckReview'),
		/**
		 * Opens the _Edit_ dialog with a note corresponding to given note ID. The
		 * dialog is similar to the _Edit Current_ dialog, but:
		 *
		 * - has a Preview button to preview the cards for the note
		 * - has a Browse button to open the browser with these cards
		 * - has Previous/Back buttons to navigate the history of the dialog
		 * - has no bar with the Close button
		 */
		guiEditNote: this.build('guiEditNote'),
		/**
		 * Schedules a request to gracefully close Anki. This operation is
		 * asynchronous, so it will return immediately and won’t wait until the Anki
		 * process actually terminates.
		 */
		guiExitAnki: this.build('guiExitAnki'),
		/**
		 * Invokes the _Import… (Ctrl+Shift+I)_ dialog with an optional file path.
		 * Brings up the dialog for user to review the import. Supports all file
		 * types that Anki supports. Brings open file dialog if no path is provided.
		 * Forward slashes must be used in the path on Windows. Only supported for
		 * Anki 2.1.52+.
		 */
		guiImportFile: this.build('guiImportFile'),
		/**
		 * Finds the open instance of the Card Browser dialog and selects a note
		 * given a note identifier. Returns `true` if the _Card Browser_ is open,
		 * `false` otherwise.
		 */
		guiSelectNote: this.build('guiSelectNote'),
		/**
		 * Finds the open instance of the _Card Browser_ dialog and returns an
		 * array of identifiers of the notes that are selected. Returns an empty
		 * list if the browser is not open.
		 */
		guiSelectedNotes: this.build('guiSelectedNotes'),
		/**
		 * Shows answer text for the current card; returns `true` if in review mode
		 * or `false` otherwise.
		 */
		guiShowAnswer: this.build('guiShowAnswer'),
		/**
		 * Shows question text for the current card; returns `true` if in review
		 * mode or `false` otherwise.
		 */
		guiShowQuestion: this.build('guiShowQuestion'),
		/**
		 * Starts or resets the `timerStarted` value for the current card. This is
		 * useful for deferring the start time to when it is displayed via the API,
		 * allowing the recorded time taken to answer the card to be more accurate
		 * when calling `guiAnswerCard`.
		 */
		guiStartCardTimer: this.build('guiStartCardTimer'),
		/**
		 * Undo the last action / card; returns `true` if succeeded or `false`
		 * otherwise.
		 */
		guiUndo: this.build('guiUndo'),
	}

	/**
	 * __Media Actions__
	 *
	 * [Documentation](https://foosoft.net/projects/anki-connect/index.html#media-actions)
	 */
	public readonly media = {
		/**
		 * Deletes the specified file inside the media folder.
		 */
		deleteMediaFile: this.build('deleteMediaFile'),
		/**
		 * Gets the full path to the `collection.media` folder of the currently opened profile.
		 */
		getMediaDirPath: this.build('getMediaDirPath'),
		/**
		 * Gets the names of media files matched the pattern. Returning all names by default.
		 */
		getMediaFilesNames: this.build('getMediaFilesNames'),
		/**
		 * Retrieves the base64-encoded contents of the specified file, returning `false` if the file does not exist.
		 */
		retrieveMediaFile: this.build('retrieveMediaFile'),
		/**
		 * Stores a file with the specified base64-encoded contents inside the media
		 * folder. Alternatively you can specify a absolute file path, or a url from
		 * where the file shell be downloaded. If more than one of `data`, `path` and
		 * `url` are provided, the `data` field will be used first, then `path`, and
		 * finally `url`. To prevent Anki from removing files not used by any cards
		 * (e.g. for configuration files), prefix the filename with an underscore.
		 * These files are still synchronized to AnkiWeb. Any existing file with the
		 * same name is deleted by default. Set `deleteExisting` to `false` to prevent
		 * that by [letting Anki give the new file a non-conflicting
		 * name](https://github.com/ankitects/anki/blob/aeba725d3ea9628c73300648f748140db3fdd5ed/rslib/src/media/files.rs#L194).
		 */
		storeMediaFile: this.build('storeMediaFile'),
	}

	/**
	 * Miscellaneous
	 */
	public readonly miscellaneous = {
		/**
		 * Gets information about the AnkiConnect APIs available. The request
		 * supports the following params:
		 *
		 * - `scopes` - An array of scopes to get reflection information about. The
		 *   only currently supported value is `"actions"`.
		 * - `actions` - Either `null` or an array of API method names to check for.
		 *   If the value is `null`, the result will list all of the available API
		 *   actions. If the value is an array of strings, the result will only
		 *   contain actions which were in this array.
		 */
		apiReflect: this.build('apiReflect'),
		/**
		 * Exports a given deck in `.apkg` format. Returns `true` if successful or `false`
		 * otherwise. The optional property `includeSched` (default is `false`) can be
		 * specified to include the cards’ scheduling data.
		 */
		exportPackage: this.build('exportPackage'),
		/**
		 * Retrieve the list of profiles.
		 */
		getProfiles: this.build('getProfiles'),
		/**
		 * Imports a file in `.apkg` format into the collection. Returns `true` if
		 * successful or `false` otherwise. Note that the file path is relative to
		 * Anki’s collection.media folder, not to the client.
		 */
		importPackage: this.build('importPackage'),
		/**
		 * Selects the profile specified in request.
		 */
		loadProfile: this.build('loadProfile'),
		/**
		 * Performs multiple actions in one request, returning an array with the response of each action (in the given order).
		 */
		multi: this.build('multi'),
		/**
		 * Tells `anki` to reload all data from the database.
		 */
		reloadCollection: this.build('reloadCollection'),
		/**
		 * Requests permission to use the API exposed by this plugin. This method
		 * does not require the API key, and is the only one that accepts requests
		 * from any origin; the other methods only accept requests from trusted
		 * origins, which are listed under `webCorsOriginList` in the add-on config.
		 * `localhost` is trusted by default.
		 *
		 * Calling this method from an untrusted origin will display a popup in Anki
		 * asking the user whether they want to allow your origin to use the API; calls
		 * from trusted origins will return the result without displaying the popup. When
		 * denying permission, the user may also choose to ignore further permission
		 * requests from that origin. These origins end up in the `ignoreOriginList`,
		 * editable via the add-on config.
		 *
		 * The result always contains the `permission` field, which in turn contains either
		 * the string `granted` or `denied`, corresponding to whether your origin is trusted.
		 * If your origin is trusted, the fields `requireApiKey` (true if required) and
		 * `version` will also be returned.
		 *
		 * This should be the first call you make to make sure that your application and
		 * Anki-Connect are able to communicate properly with each other. New versions of
		 * Anki-Connect are backwards compatible; as long as you are using actions which
		 * are available in the reported Anki-Connect version or earlier, everything
		 * should work fine.
		 */
		requestPermission: this.build('requestPermission'),
		/**
		 * Synchronizes the local Anki collections with AnkiWeb.
		 */
		sync: this.build('sync'),
		/**
		 * Gets the version of the API exposed by this plugin. Currently versions `1` through `6` are defined.
		 */
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

	constructor(options?: YankiConnectOptions) {
		this.port = options?.port ?? 8765
		this.version = options?.version ?? 6

		if (platform !== 'darwin' && options?.autoLaunchAnki !== false) {
			console.warn('The autoLaunchAnki option is only supported on macOS')
			this.autoLaunchAnki = false
		} else {
			this.autoLaunchAnki = options?.autoLaunchAnki ?? false
		}

		this.key = options?.key ?? undefined
		this.host = options?.host ?? 'http://127.0.0.1'

		if (this.version !== 6) {
			throw new Error('YankiConnect currently only supports Anki-Connect API version 6')
		}

		if (this.autoLaunchAnki === 'immediately') {
			void launchAnkiApp()
		}
	}

	/**
	 * Factory for creating convenience functions for each action. Overload for
	 * actions with / without params
	 *
	 * Note that the generated function returns the response's Result field! Any
	 * errors, even from Anki, will throw.
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
