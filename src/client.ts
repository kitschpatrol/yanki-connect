import type {
	Actions,
	ActionsWithoutParams,
	ActionsWithParams,
	AnkiConnectVersion,
	ParamsForAction,
	ResponseForAction,
	ResultForAction,
} from './types/shared'
import { launchAnkiApp } from './utilities/launcher'
import { ENVIRONMENT, PLATFORM } from './utilities/platform'

// For ease of extracting fields from connection errors
// type TypeErrorCause = {
// 	address?: string
// 	code?: string
// 	errno?: number
// 	port?: number
// 	syscall?: string
// }

/**
 * Subset of built-in Fetch interface that's actually used by Anki, for ease of
 * external re-implementation when passing a custom fetch function to
 * YankiClient.
 */
export type YankiFetchAdapter = (
	input: string,
	init?: {
		body?: string
		headers?: Record<string, string>
		method?: string
		mode?: RequestMode
	},
) => Promise<
	| undefined
	| {
			// eslint-disable-next-line node/no-unsupported-features/node-builtins
			headers: Headers | Record<string, string>
			// eslint-disable-next-line ts/no-explicit-any
			json(): Promise<any>
			status: number
	  }
>

/** Optional options to pass when instantiating a new YankiConnect instance. */
export type YankiConnectOptions = {
	/**
	 * Attempt to open the desktop Anki.app if it's not already running.
	 *
	 * - `true` will always attempt to open Anki _when a request is made_. This
	 *   might introduce significant latency on the first launch.
	 * - `false` will never attempt to open Anki. Requests will fail until something
	 *   or someone else opens the Anki app.
	 * - `immediately` is a special option that will open Anki when the client is
	 *   instantiated.
	 *
	 * The Anki desktop app must be running for the client and the underlying
	 * AnkiConnect service to work.
	 *
	 * Currently supported on macOS only.
	 *
	 * The client does not attempt to close the app.
	 *
	 * @default false
	 */
	autoLaunch: 'immediately' | boolean
	/**
	 * Advanced option to customize the resource fetch implementation used to make
	 * requests to AnkiConnect.
	 *
	 * Note that the signature reflects the subset of the built-in Fetch interface
	 * that's actually used by yanki-connect.
	 *
	 * The exact signature of this option is subject to change in the future.
	 *
	 * @default fetch
	 */
	fetchAdapter: undefined | YankiFetchAdapter
	/**
	 * Host where the AnkiConnect service is running.
	 *
	 * @default 'http://127.0.0.1'
	 */
	host: string
	/**
	 * AnkiConnect security key (optional)
	 *
	 * @default undefined
	 */
	key: string | undefined
	/**
	 * Port where the AnkiConnect service is running.
	 *
	 * @default 8765
	 */
	port: number
	/**
	 * AnkiConnect API version.
	 *
	 * Only API version 6 is supported for now.
	 *
	 * @default 6
	 */
	version: AnkiConnectVersion
}

export const defaultYankiConnectOptions: YankiConnectOptions = {
	autoLaunch: false,
	// eslint-disable-next-line node/no-unsupported-features/node-builtins
	fetchAdapter: fetch.bind(globalThis),
	host: 'http://127.0.0.1',
	key: undefined,
	port: 8765,
	version: 6,
}

/**
 * **YankiConnect is a client for the [AnkiConnect
 * API](https://git.sr.ht/~foosoft/anki-connect/tree/26.10.11.4/item/API_LEGACY.md)**.
 *
 * It implements every legacy (version 6) API endpoint from AnkiConnect version
 * 26.10.11.4, released 2026-10-11. The JSON-RPC API v1 introduced in
 * AnkiConnect 26.10.11.0 is not yet supported.
 *
 * Inline documentation is by the AnkiConnect authors, generated from [the
 * legacy API
 * guide](https://git.sr.ht/~foosoft/anki-connect/tree/26.10.11.4/item/API_LEGACY.md)
 */
export class YankiConnect {
	/**
	 * **Card Actions**
	 *
	 * [Documentation](https://git.sr.ht/~foosoft/anki-connect/tree/26.10.11.4/item/API_LEGACY.md#card-actions)
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
		 * Returns an array of card IDs for a given query. Functionally identical to
		 * `guiBrowse` but doesn’t use the GUI for better performance.
		 */
		findCards: this.build('findCards'),
		/**
		 * Forget cards, making the cards new again.
		 */
		forgetCards: this.build('forgetCards'),
		/**
		 * Returns an array with the ease factor for each of the given cards (in the
		 * same order).
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
		 *
		 * As of AnkiConnect 26.10.11.0 this performs a real failed review on each
		 * card, which changes lapse counts and review history, and requires each
		 * card to be an active review card.
		 */
		relearnCards: this.build('relearnCards'),
		/**
		 * Set Due Date. Turns cards into review cards if they are new, and makes
		 * them due on a certain date.
		 *
		 * - 0 = today
		 * - 1! = tomorrow + change interval to 1
		 * - 3-7 = random choice of 3-7 days
		 */
		setDueDate: this.build('setDueDate'),
		/**
		 * Sets ease factor of cards by card ID; returns `true` if successful (all
		 * cards existed) or `false` otherwise.
		 */
		setEaseFactors: this.build('setEaseFactors'),
		/**
		 * Update supported card properties. `card` is a scalar ID; `keys` and
		 * `newValues` must be equal-length arrays with no duplicate keys. Supported
		 * keys are `flags`, `did`, `factor`, `ivl`, `reps`, `lapses`, and
		 * `custom_data`. `did`, `ivl`, `reps`, and `lapses` require
		 * `warning_check=true`. Flags and deck moves cannot be combined with each
		 * other or metadata patches. Raw ownership, queue, type, due, and sync
		 * metadata writes are rejected.
		 *
		 * Returns `false` for an invalid request shape or protected writes without
		 * `warning_check`, `[true]` on success, and `[[false, message]]` on native
		 * failure. A list of values and explanation of their respective utility can
		 * be found at [AnkiDroid’s
		 * wiki](https://github.com/ankidroid/Anki-Android/wiki/Database-Structure).
		 */
		setSpecificValueOfCard: this.build('setSpecificValueOfCard'),
		/**
		 * Suspend cards by card ID; returns `true` if successful (at least one card
		 * wasn’t already suspended) or `false` otherwise.
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
	 * **Deck Actions**
	 *
	 * [Documentation](https://git.sr.ht/~foosoft/anki-connect/tree/26.10.11.4/item/API_LEGACY.md#deck-actions)
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
		 */
		cloneDeckConfigId: this.build('cloneDeckConfigId'),
		/**
		 * Create a new empty deck. Will not overwrite a deck that exists with the
		 * same name.
		 */
		createDeck: this.build('createDeck'),
		/**
		 * Returns the name of an existing deck by its numeric ID. Throws if the
		 * deck does not exist.
		 */
		deckNameFromId: this.build('deckNameFromId'),
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
		 * Gets the configuration group object for the given deck, or `false` if the
		 * deck does not exist.
		 */
		getDeckConfig: this.build('getDeckConfig'),
		/**
		 * Accepts an array of card IDs and returns an object with each deck name as
		 * a key, and its value an array of the given cards which belong to it.
		 */
		getDecks: this.build('getDecks'),
		/**
		 * ```
		 * 	  Gets statistics such as total cards and cards due for the given decks.
		 * ```
		 */
		getDeckStats: this.build('getDeckStats'),
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
		 */
		saveDeckConfig: this.build('saveDeckConfig'),
		/**
		 * Changes the configuration group for the given decks to the one with the
		 * given ID. Returns `true` on success or `false` if the given configuration
		 * group or any of the given decks do not exist.
		 */
		setDeckConfigId: this.build('setDeckConfigId'),
	}
	/**
	 * **Graphical Actions**
	 *
	 * [Documentation](https://git.sr.ht/~foosoft/anki-connect/tree/26.10.11.4/item/API_LEGACY.md#graphical-actions)
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
		 * As of AnkiConnect 26.10.11.0 the result is always `0`, since the draft
		 * has not been saved yet, and replacing a draft with unsaved content is
		 * rejected. Older versions returned the ID the note would receive if the
		 * user confirmed the dialog.
		 */
		guiAddCards: this.build('guiAddCards'),
		/**
		 * Updates the note draft in the open _Add Cards_ dialog. Fields and tags
		 * replace the current values by default; when `append` is `true`, field
		 * text is concatenated and tags are merged. Deck and note type always
		 * replace the current values. Inline media is handled as in `addNote`.
		 *
		 * Returns `true` once the draft is updated. If the _Add Cards_ dialog is
		 * not open, the result is an object with `error` and `code` properties
		 * rather than a thrown error.
		 */
		guiAddNoteSetData: this.build('guiAddNoteSetData'),
		/**
		 * Answers the current card; returns `true` if succeeded or `false`
		 * otherwise. Note that the answer for the current card must be displayed
		 * before before any answer can be accepted by Anki.
		 */
		guiAnswerCard: this.build('guiAnswerCard'),
		/**
		 * Invokes the _Card Browser_ dialog and searches for a given query. Returns
		 * an array of identifiers of the cards that were found. Query syntax is
		 * [documented here](https://docs.ankiweb.net/searching.html).
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
		 * - Has a Preview button to preview the cards for the note
		 * - Has a Browse button to open the browser with these cards
		 * - Has Previous/Back buttons to navigate the history of the dialog
		 * - Has no bar with the Close button
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
		 * Plays any Audio for the current side of the current card; returns true if
		 * succeeded or false otherwise.
		 */
		guiPlayAudio: this.build('guiPlayAudio'),
		/**
		 * Returns `true` if the reviewer is currently active, `false` otherwise.
		 */
		guiReviewActive: this.build('guiReviewActive'),
		/**
		 * Finds the open instance of the Card Browser dialog and selects a card
		 * given a card identifier. Returns true if the Card Browser is open, false
		 * otherwise.
		 */
		guiSelectCard: this.build('guiSelectCard'),
		/**
		 * Finds the open instance of the _Card Browser_ dialog and returns an array
		 * of identifiers of the notes that are selected. Returns an empty list if
		 * the browser is not open.
		 */
		guiSelectedNotes: this.build('guiSelectedNotes'),
		/**
		 * @deprecated Actually selects card IDs. Use `guiSelectCard` instead.'
		 */
		guiSelectNote: this.build('guiSelectNote'),
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
		 * when calling `guiAnswerCard`. Returns `false` if not in review mode.
		 */
		guiStartCardTimer: this.build('guiStartCardTimer'),
		/**
		 * Undo the last action / card; returns `true` if succeeded or `false`
		 * otherwise.
		 */
		guiUndo: this.build('guiUndo'),
	}
	/**
	 * **Media Actions**
	 *
	 * [Documentation](https://git.sr.ht/~foosoft/anki-connect/tree/26.10.11.4/item/API_LEGACY.md#media-actions)
	 */
	public readonly media = {
		/**
		 * Deletes the specified file inside the media folder.
		 */
		deleteMediaFile: this.build('deleteMediaFile'),
		/**
		 * Gets the full path to the `collection.media` folder of the currently
		 * opened profile.
		 */
		getMediaDirPath: this.build('getMediaDirPath'),
		/**
		 * Gets the names of media files matched the pattern. Returning all names by
		 * default.
		 */
		getMediaFilesNames: this.build('getMediaFilesNames'),
		/**
		 * Retrieves the base64-encoded contents of the specified file, returning
		 * `false` if the file does not exist.
		 */
		retrieveMediaFile: this.build('retrieveMediaFile'),
		/**
		 * Stores a file with the specified base64-encoded contents inside the media
		 * folder. Alternatively you can specify a absolute file path, or a url from
		 * where the file shell be downloaded. If more than one of `data`, `path`
		 * and `url` are provided, the `data` field will be used first, then `path`,
		 * and finally `url`. To prevent Anki from removing files not used by any
		 * cards (e.g. for configuration files), prefix the filename with an
		 * underscore. These files are still synchronized to AnkiWeb. Any existing
		 * file with the same name is deleted by default. Set `deleteExisting` to
		 * `false` to prevent that by [letting Anki give the new file a
		 * non-conflicting
		 * name](https://github.com/ankitects/anki/blob/aeba725d3ea9628c73300648f748140db3fdd5ed/rslib/src/media/files.rs#L194).
		 *
		 * The result is the actual filename, which may be normalized or renamed.
		 * `skipHash` may be set to the MD5 digest of the incoming bytes; when it
		 * matches, nothing is stored and `null` is returned.
		 */
		storeMediaFile: this.build('storeMediaFile'),
	}
	/**
	 * **Miscellaneous Actions**
	 *
	 * [Documentation](https://git.sr.ht/~foosoft/anki-connect/tree/26.10.11.4/item/API_LEGACY.md#miscellaneous-actions)
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
		 * Exports a given deck in `.apkg` format. Returns `true` if successful or
		 * `false` otherwise. The optional property `includeSched` (default is
		 * `false`) can be specified to include the cards’ scheduling data.
		 */
		exportPackage: this.build('exportPackage'),
		/**
		 * Retrieve the name of the active profile, or `null` if no profile is
		 * loaded.
		 */
		getActiveProfile: this.build('getActiveProfile'),
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
		 * Selects the profile specified in request. Returns `true` when accepted,
		 * or `false` if the profile does not exist.
		 */
		loadProfile: this.build('loadProfile'),
		/**
		 * Performs multiple actions in one request, returning an array with the
		 * response of each action (in the given order).
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
		 * asking the user whether they want to allow your origin to use the API;
		 * calls from trusted origins will return the result without displaying the
		 * popup. When denying permission, the user may also choose to ignore
		 * further permission requests from that origin. These origins end up in the
		 * `ignoreOriginList`, editable via the add-on config.
		 *
		 * The result always contains the `permission` field, which in turn contains
		 * either the string `granted` or `denied`, corresponding to whether your
		 * origin is trusted. If your origin is trusted, the fields `requireApikey`
		 * (true if required) and `version` will also be returned.
		 *
		 * This should be the first call you make to make sure that your application
		 * and AnkiConnect are able to communicate properly with each other. New
		 * versions of AnkiConnect are backwards compatible; as long as you are
		 * using actions which are available in the reported AnkiConnect version or
		 * earlier, everything should work fine.
		 */
		requestPermission: this.build('requestPermission'),
		/**
		 * Synchronizes the local Anki collections with AnkiWeb.
		 */
		sync: this.build('sync'),
		/**
		 * Gets the version of the API exposed by this plugin. Currently versions
		 * `1` through `6` are defined.
		 */
		version: this.build('version'),
	}
	/**
	 * **Model Actions**
	 *
	 * [Documentation](https://git.sr.ht/~foosoft/anki-connect/tree/26.10.11.4/item/API_LEGACY.md#model-actions)
	 */
	public readonly model = {
		/**
		 * Creates a new model to be used in Anki. User must provide the
		 * `modelName`, `inOrderFields` and `cardTemplates` to be used in the model.
		 * There are optional fields `css` and `isCloze`. If not specified, `css`
		 * will use the default Anki css and `isCloze` will be equal to `false`. If
		 * `isCloze` is `true` then model will be created as Cloze.
		 *
		 * Optionally the `Name` field can be provided for each entry of
		 * `cardTemplates`. By default the card names will be `Card 1`, `Card 2`,
		 * and so on.
		 */
		createModel: this.build('createModel'),
		/**
		 * Find and replace string in existing model by model name. Customize to
		 * replace in front, back or css by setting to `true`/`false`. Pass an empty
		 * `modelName` to search every model. Returns the number of models changed.
		 */
		findAndReplaceInModels: this.build('findAndReplaceInModels'),
		/**
		 * Gets a list of models for the provided model IDs from the current user.
		 */
		findModelsById: this.build('findModelsById'),
		/**
		 * Gets a list of models for the provided model names from the current user.
		 */
		findModelsByName: this.build('findModelsByName'),
		/**
		 * Creates a new field within a given model.
		 *
		 * Optionally, the `index` value can be provided, which works exactly the
		 * same as the index in `modelFieldReposition`. By default, the field is
		 * added to the end of the field list.
		 */
		modelFieldAdd: this.build('modelFieldAdd'),
		/**
		 * Gets the complete list of field descriptions (the text seen in the gui
		 * editor when a field is empty) for the provided model name.
		 */
		modelFieldDescriptions: this.build('modelFieldDescriptions'),
		/**
		 * Gets the complete list of fonts along with their font sizes.
		 */
		modelFieldFonts: this.build('modelFieldFonts'),
		/**
		 * Gets the complete list of field names for the provided model name.
		 */
		modelFieldNames: this.build('modelFieldNames'),
		/**
		 * Deletes a field within a given model.
		 */
		modelFieldRemove: this.build('modelFieldRemove'),
		/**
		 * Rename the field name of a given model.
		 */
		modelFieldRename: this.build('modelFieldRename'),
		/**
		 * Reposition the field within the field list of a given model.
		 *
		 * The value of `index` starts at 0. For example, an `index` of `0` puts the
		 * field in the first position, and an `index` of `2` puts the field in the
		 * third position.
		 */
		modelFieldReposition: this.build('modelFieldReposition'),
		/**
		 * Sets the description (the text seen in the gui editor when a field is
		 * empty) for a field within a given model.
		 *
		 * Older versions of Anki (2.1.49 and below) do not have field descriptions.
		 * In that case, this will return with `false`.
		 */
		modelFieldSetDescription: this.build('modelFieldSetDescription'),
		/**
		 * Sets the font for a field within a given model.
		 */
		modelFieldSetFont: this.build('modelFieldSetFont'),
		/**
		 * Sets the font size for a field within a given model.
		 */
		modelFieldSetFontSize: this.build('modelFieldSetFontSize'),
		/**
		 * Returns an object indicating the fields on the question and answer side
		 * of each card template for the given model name. The question side is
		 * given first in each array.
		 */
		modelFieldsOnTemplates: this.build('modelFieldsOnTemplates'),
		/**
		 * Returns the name of an existing model by its numeric ID. Throws if the
		 * model does not exist.
		 */
		modelNameFromId: this.build('modelNameFromId'),
		/**
		 * Gets the complete list of model names for the current user.
		 */
		modelNames: this.build('modelNames'),
		/**
		 * Gets the complete list of model names and their corresponding IDs for the
		 * current user.
		 */
		modelNamesAndIds: this.build('modelNamesAndIds'),
		/**
		 * Gets the CSS styling for the provided model by name.
		 */
		modelStyling: this.build('modelStyling'),
		/**
		 * Adds a template to an existing model by name. If you want to update an
		 * existing template, use `updateModelTemplates`.
		 */
		modelTemplateAdd: this.build('modelTemplateAdd'),
		/**
		 * Removes a template from an existing model.
		 */
		modelTemplateRemove: this.build('modelTemplateRemove'),
		/**
		 * Renames a template in an existing model.
		 */
		modelTemplateRename: this.build('modelTemplateRename'),
		/**
		 * Repositions a template in an existing model.
		 */
		modelTemplateReposition: this.build('modelTemplateReposition'),
		/**
		 * Returns an object indicating the template content for each card connected
		 * to the provided model by name.
		 *
		 * The value of `index` starts at 0. For example, an `index` of `0` puts the
		 * template in the first position, and an `index` of `2` puts the template
		 * in the third position.
		 */
		modelTemplates: this.build('modelTemplates'),
		/**
		 * Modify the CSS styling of an existing model by name.
		 */
		updateModelStyling: this.build('updateModelStyling'),
		/**
		 * Modify the templates of an existing model by name. Only specifies cards
		 * and specified sides will be modified. If an existing card or side is not
		 * included in the request, it will be left unchanged.
		 */
		updateModelTemplates: this.build('updateModelTemplates'),
	}

	/**
	 * **Note Actions**
	 *
	 * [Documentation](https://git.sr.ht/~foosoft/anki-connect/tree/26.10.11.4/item/API_LEGACY.md#note-actions)
	 */
	public readonly note = {
		/**
		 * Creates a note using the given deck and model, with the provided field
		 * values and tags. Returns the identifier of the created note. Duplicates,
		 * empty first fields, and missing decks or models throw.
		 *
		 * AnkiConnect can download audio, video, and picture files and embed them
		 * in newly created notes. The corresponding `audio`, `video`, and `picture`
		 * note members are optional and can be omitted. If you choose to include
		 * any of them, they should contain a single object or an array of objects
		 * with the mandatory `filename` field and one of `data`, `path` or `url`.
		 * Refer to the documentation of `storeMediaFile` for an explanation of
		 * these fields. The `skipHash` field can be optionally provided to skip the
		 * inclusion of files with an MD5 hash that matches the provided value. This
		 * is useful for avoiding the saving of error pages and stub files. The
		 * `fields` member is a list of field names to which the inserted media
		 * should be appended to. It can be omitted if this isn't required. The
		 * `allowDuplicate` member inside `options` group can be set to true to
		 * enable adding duplicate cards. Normally duplicate cards can not be added
		 * and trigger exception.
		 *
		 * The `duplicateScope` member inside `options` can be used to specify the
		 * scope for which duplicates are checked. A value of `"deck"` will only
		 * check for duplicates in the target deck; `"collection"` (the default)
		 * will check the entire collection. Other values are rejected.
		 *
		 * The `duplicateScopeOptions` object can be used to specify some additional
		 * settings:
		 *
		 * - `duplicateScopeOptions.deckName` will specify which deck to use for
		 *   checking duplicates in. If undefined or `null`, the target deck will be
		 *   used.
		 * - `duplicateScopeOptions.checkChildren` will change whether or not
		 *   duplicate cards are checked in child decks. The default value is
		 *   `false`.
		 * - `duplicateScopeOptions.checkAllModels` specifies whether duplicate checks
		 *   are performed across all note types. The default value is `false`.
		 */
		addNote: this.build('addNote'),
		/**
		 * Creates multiple notes using the given deck and model, with the provided
		 * field values and tags, in one atomic batch. Returns an array of
		 * identifiers of the created notes in input order. If any note fails
		 * validation, the whole batch is rejected and an error is thrown.
		 *
		 * Please see the documentation for `addNote` for an explanation of objects
		 * in the `notes` array.
		 */
		addNotes: this.build('addNotes'),
		/**
		 * Adds tags to notes by note ID. Tags may be given as a space-separated
		 * string or an array.
		 */
		addTags: this.build('addTags'),
		/**
		 * Accepts an object which defines parameters for a candidate note (see
		 * `addNote`) and returns a boolean indicating whether or not the parameters
		 * could be used to create a new note. Does not download media or change the
		 * collection.
		 */
		canAddNote: this.build('canAddNote'),
		/**
		 * Accepts an array of objects which define parameters for candidate notes
		 * (see `addNote`) and returns an array of booleans indicating whether or
		 * not the parameters at the corresponding index could be used to create a
		 * new note.
		 */
		canAddNotes: this.build('canAddNotes'),
		/**
		 * Accepts an array of objects which define parameters for candidate notes
		 * (see `addNote`) and returns an array of objects with fields `canAdd` and
		 * `error`.
		 *
		 * - `canAdd` indicates whether or not the parameters at the corresponding
		 *   index could be used to create a new note.
		 * - `error` contains an explanation of why a note cannot be added.
		 */
		canAddNotesWithErrorDetail: this.build('canAddNotesWithErrorDetail'),
		/**
		 * Accepts an object which defines parameters for a candidate note (see
		 * `addNote`) and returns an object with fields `canAdd` and `error`.
		 *
		 * - `canAdd` indicates whether or not the parameters could be used to create
		 *   a new note.
		 * - `error` contains an explanation of why the note cannot be added.
		 */
		canAddNoteWithErrorDetail: this.build('canAddNoteWithErrorDetail'),
		/**
		 * Clears all the unused tags in the notes for the current user.
		 */
		clearUnusedTags: this.build('clearUnusedTags'),
		/**
		 * Deletes notes with the given ids. If a note has several cards associated
		 * with it, all associated cards will be deleted.
		 */
		deleteNotes: this.build('deleteNotes'),
		/**
		 * Returns an array of note IDs for a given query. Query syntax is
		 * [documented here](https://docs.ankiweb.net/searching.html).
		 */
		findNotes: this.build('findNotes'),
		/**
		 * Get a note's tags by note ID.
		 */
		getNoteTags: this.build('getNoteTags'),
		/**
		 * Gets the complete list of tags for the current user.
		 */
		getTags: this.build('getTags'),
		/**
		 * Returns a list of objects containing for each note ID the note fields,
		 * tags, note type, modification time, the cards belonging to the note and
		 * the profile where the note was created. Accepts either a list of note IDs
		 * or a search query.
		 */
		notesInfo: this.build('notesInfo'),
		/**
		 * Returns a list of objects containing for each note ID the modification
		 * time.
		 */
		notesModTime: this.build('notesModTime'),
		/**
		 * Removes all the empty notes for the current user.
		 *
		 * > [!WARNING] As of AnkiConnect 26.10.11.0 this action always throws a
		 * > compatibility error and leaves the collection intact. AnkiConnect
		 * > recommends the API v1 `notes.findEmpty` method instead.
		 */
		removeEmptyNotes: this.build('removeEmptyNotes'),
		/**
		 * Remove tags from notes by note ID.
		 */
		removeTags: this.build('removeTags'),
		/**
		 * Replace tags in notes by note ID.
		 */
		replaceTags: this.build('replaceTags'),
		/**
		 * Replace tags in all the notes for the current user.
		 */
		replaceTagsInAllNotes: this.build('replaceTagsInAllNotes'),
		/**
		 * Modify the fields and/or tags of an existing note. In other words,
		 * combines `updateNoteFields` and `updateNoteTags`. Please see their
		 * documentation for an explanation of all properties.
		 *
		 * Either `fields` or `tags` property can be omitted without affecting the
		 * other. Thus valid requests to `updateNoteFields` also work with
		 * `updateNote`. The note must have the `fields` property in order to update
		 * the optional audio, video, or picture objects.
		 *
		 * If neither `fields` nor `tags` are provided, the method will fail. Fields
		 * are updated first and are not rolled back if updating tags fails. Tags
		 * are not updated if updating fields fails.
		 *
		 * > [!WARNING] You must not be viewing the note that you are updating on your
		 * > Anki browser, otherwise the fields will not update. See [this
		 * > issue](https://github.com/FooSoft/anki-connect/issues/82) for further
		 * > details.
		 */
		updateNote: this.build('updateNote'),
		/**
		 * Modify the fields of an existing note. You can also include audio, video,
		 * or picture files which will be added to the note with an optional
		 * `audio`, `video`, or `picture` property. Please see the documentation for
		 * `addNote` for an explanation of objects in the `audio`, `video`, or
		 * `picture` array.
		 *
		 * > [!WARNING] You must not be viewing the note that you are updating on your
		 * > Anki browser, otherwise the fields will not update. See [this
		 * > issue](https://github.com/FooSoft/anki-connect/issues/82) for further
		 * > details.
		 */
		updateNoteFields: this.build('updateNoteFields'),
		/**
		 * Update the model, fields, and tags of an existing note. This allows you
		 * to change the note's model, update its fields with new content, and set
		 * new tags.
		 */
		updateNoteModel: this.build('updateNoteModel'),
		/**
		 * Set a note's tags by note ID. Old tags will be removed.
		 */
		updateNoteTags: this.build('updateNoteTags'),
	}

	/**
	 * **Statistic Actions**
	 *
	 * [Documentation](https://git.sr.ht/~foosoft/anki-connect/tree/26.10.11.4/item/API_LEGACY.md#statistic-actions)
	 */
	public readonly statistic = {
		/**
		 * Requests all card reviews for a specified deck after a certain time.
		 * `startID` is the latest unix time not included in the result. Returns a
		 * list of 9-tuples `(reviewTime, cardID, usn, buttonPressed, newInterval,
		 * previousInterval, newFactor, reviewDuration, reviewType)`.
		 */
		cardReviews: this.build('cardReviews'),
		/**
		 * Gets the collection statistics report.
		 */
		getCollectionStatsHTML: this.build('getCollectionStatsHTML'),
		/**
		 * Returns the unix time of the latest review for the given deck. 0 if no
		 * review has ever been made for the deck.
		 */
		getLatestReviewID: this.build('getLatestReviewID'),
		/**
		 * Gets the number of cards reviewed as a list of pairs of (`dateString`,
		 * `number`).
		 */
		getNumCardsReviewedByDay: this.build('getNumCardsReviewedByDay'),
		/**
		 * Gets the count of cards that have been reviewed in the current day. (With
		 * day start time as configured by user in Anki).
		 */
		getNumCardsReviewedToday: this.build('getNumCardsReviewedToday'),
		/**
		 * Requests all card reviews for each card ID. Returns a dictionary mapping
		 * each card ID to a list of dictionaries of the format:
		 *
		 * ```ts
		 * {
		 *    "id": reviewTime,
		 *    "usn": usn,
		 *    "ease": buttonPressed,
		 *    "ivl": newInterval,
		 *    "lastIvl": previousInterval,
		 *    "factor": newFactor,
		 *    "time": reviewDuration,
		 *    "type": reviewType,
		 * }
		 * ```
		 *
		 * The reason why these key values are used instead of the more descriptive
		 * counterparts is because these are the exact key values used in Anki's
		 * database.
		 */
		getReviewsOfCards: this.build('getReviewsOfCards'),
		/**
		 * Inserts the given reviews into the database. Required format: list of
		 * 9-tuples `(reviewTime, cardID, usn, buttonPressed, newInterval,
		 * previousInterval, newFactor, reviewDuration, reviewType)`.
		 */
		insertReviews: this.build('insertReviews'),
	}

	private readonly autoLaunch: 'immediately' | boolean

	private readonly fetchAdapter: YankiFetchAdapter

	private readonly host: string

	private readonly key: string | undefined

	private readonly port: number

	private readonly version: AnkiConnectVersion

	constructor(options?: Partial<YankiConnectOptions>) {
		this.host = options?.host ?? defaultYankiConnectOptions.host
		this.port = options?.port ?? defaultYankiConnectOptions.port
		this.version = options?.version ?? defaultYankiConnectOptions.version
		this.key = options?.key ?? defaultYankiConnectOptions.key
		this.autoLaunch = options?.autoLaunch ?? defaultYankiConnectOptions.autoLaunch

		if (defaultYankiConnectOptions.fetchAdapter === undefined) {
			// Just type issues with the default object
			throw new Error('A fetch implementation is required')
		}

		this.fetchAdapter = options?.fetchAdapter ?? defaultYankiConnectOptions.fetchAdapter

		if ((PLATFORM !== 'mac' || ENVIRONMENT !== 'node') && this.autoLaunch !== false) {
			console.warn('The autoLaunch option is only supported in a Node environment on macOS')
			this.autoLaunch = false
		}

		// eslint-disable-next-line ts/no-unnecessary-condition
		if (this.version !== 6) {
			throw new Error('YankiConnect currently only supports AnkiConnect API version 6')
		}

		if (this.autoLaunch === 'immediately') {
			void launchAnkiApp()
		}
	}

	/**
	 * Directly invoke the Anki Connect API.
	 *
	 * [Documentation](https://git.sr.ht/~foosoft/anki-connect/tree/26.10.11.4/item/API_LEGACY.md)
	 *
	 * Primarily for internal use, since the client provides a more convenient
	 * methods on its class, e.g. instead of:
	 *
	 * ```ts
	 * const client = new AnkiConnectClient()
	 * const response = await client.invoke('version')
	 * ```
	 *
	 * You can use:
	 *
	 * ```ts
	 * const client = new AnkiConnectClient()
	 * const result = await client.miscellaneous.version()
	 * ```
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
		let responseJson: ResponseForAction<T>
		try {
			// Fetch Response
			const response: Awaited<ReturnType<YankiFetchAdapter>> = await this.fetchAdapter(
				`${this.host}:${this.port}`,
				{
					body: JSON.stringify({
						action,
						...(this.key !== undefined && { key: this.key }),
						params,
						version: this.version,
					}),
					headers: {
						'Access-Control-Allow-Origin': '*', // Not all servers honor this
						'Content-Type': 'application/json',
					},
					method: 'POST',
					// TODO how necessary is this?
					// Ensure CORS mode is enabled
					mode: 'cors',
				},
			)

			if (response === undefined) {
				throw new Error('AnkiConnect response is undefined')
			}

			if (response.status !== 200) {
				throw new Error(`AnkiConnect response status is ${response.status}`)
			}

			responseJson = (await response.json()) as ResponseForAction<T>

			if (this.autoLaunch !== false && responseJson.error === 'collection is not available') {
				throw new Error(responseJson.error)
			}
		} catch (error) {
			// Attempt restart, but if it's a permissions issue then throw and stop trying
			if (
				this.autoLaunch !== false
				// TODO what about permission denial, or missing AnkiConnect plugin?
				// &&
				// !(error instanceof TypeError && (error.cause as TypeErrorCause)?.code === 'ECONNREFUSED')
			) {
				console.warn(`Can't connect to Anki app, retrying with auto-launch...`)

				// Internally throttled
				await launchAnkiApp()

				await new Promise((resolve) => {
					setTimeout(resolve, 500)
				})

				return params === undefined
					? (this.invoke(action as ActionsWithoutParams) as Promise<ResponseForAction<T>>)
					: (this.invoke(action as ActionsWithParams, params) as Promise<ResponseForAction<T>>)
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

	/**
	 * Factory for creating convenience functions for each action. Overload for
	 * actions with / without params
	 *
	 * Note that the generated function returns the response's Result field! Any
	 * errors, even from Anki, will throw.
	 */
	private build<T extends ActionsWithoutParams>(action: T): () => Promise<ResultForAction<T>>
	// Single point of contact with the Anki Connect API.
	private build<T extends ActionsWithParams>(
		action: T,
	): (params: ParamsForAction<T>) => Promise<ResultForAction<T>>
	private build<T extends Actions>(
		action: T,
	): (params?: ParamsForAction<T>) => Promise<ResultForAction<T>>
	// Implementation, have to lie about the action type
	private build<T extends ActionsWithParams>(
		action: T,
	): (params?: ParamsForAction<T>) => Promise<ResultForAction<T>> {
		return async (params?: ParamsForAction<T>) => {
			// Bang is a type appeasement...

			const response = await this.invoke<T>(action, params!)
			if (response.error !== null) {
				throw new Error(response.error)
			}

			return response.result as ResultForAction<T>
		}
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
