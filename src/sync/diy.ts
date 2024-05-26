/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/ban-types */
type Request<Action extends string, Params extends Record<string, unknown> | undefined, Result> = {
	action: Action
	params: Params
	response: {
		error: null | string
		result: Result
	}
}

type DeckStats = {
	deck_id: number
	learn_count: number
	name: string
	new_count: number
	review_count: number
	total_in_deck: number
}

type DeckConfig = {
	autoplay: boolean
	dyn: boolean
	id: number
	lapse: {
		delays: number[]
		leechAction: number
		leechFails: number
		minInt: number
		mult: number
	}
	maxTaken: number
	mod: number
	name: string
	new: {
		bury: boolean
		delays: number[]
		initialFactor: number
		ints: number[]
		order: number
		perDay: number
		separate: boolean
	}
	replayq: boolean
	rev: {
		bury: boolean
		ease4: number
		fuzz: 0.05
		ivlFct: number
		maxIvl: number
		minSpace: 1
		perDay: number
	}
	timer: number
	usn: number
}

type DeckRequests =
	| Request<'changeDeck', { cards: number[]; deck: string }, null>
	| Request<'cloneDeckConfigId', { cloneFrom: number; name: string }, false | number>
	| Request<'createDeck', { deck: string }, Record<string, number>>
	| Request<'deckNames', undefined, string[]>
	| Request<'deckNamesAndIds', undefined, Record<string, number>>
	| Request<'deleteDecks', { cardsToo: true; decks: string[] }, null>
	| Request<'getDeckConfig', { deck: string }, DeckConfig>
	| Request<'getDeckStats', { decks: string[] }, Record<string, DeckStats>>
	| Request<'getDecks', Record<'cards', number[]>, Record<string, number[]>>
	| Request<'removeDeckConfigId', { configId: number }, boolean>
	| Request<'saveDeckConfig', { config: DeckConfig }, boolean>
	| Request<'setDeckConfigId', { configId: number; decks: string[] }, boolean>

// See https://github.com/ankidroid/Anki-Android/wiki/Database-Structure#cards
type CardValueKeys =
	| 'data' // Text not null
	| 'did' // Integer not null,
	| 'due' // Integer not null,
	| 'factor' // Integer not null,
	| 'flags' // Integer not null,
	| 'id' //  Integer primary key,
	| 'ivl' // Integer not null,
	| 'lapses' // Integer not null,
	| 'left' // Integer not null,
	| 'mod' // Integer not null,
	| 'odid' // Integer not null,
	| 'odue' // Integer not null,
	| 'ord' // Integer not null,
	| 'queue' // Integer not null,
	| 'reps' // Integer not null,
	| 'type' // Integer not null,
	| 'usn' // Integer not null,

// TODO more keys for custom models?
// TODO what's optional?
type CardInfo = {
	answer: string // Back
	buttons?: number[]
	cardId: number
	css: string
	deckName: string
	due: number
	fieldOrder: number
	fields: Record<string, { order: number; value: string }>
	interval: number
	lapses: number
	left: number
	mod: number
	modelName: string
	nextReviews: string[]
	note: number
	ord: number
	question: string // Front
	queue: number
	reps: number
	template: string
	type: number
}

type CardRequests =
	| Request<
			'cardsModTime',
			{ cards: number[] },
			{
				cardId: number
				mod: number
			}
	  >
	| Request<
			'setSpecificValueOfCard',
			{ card: number; keys: CardValueKeys[]; newValues: string[] },
			boolean[]
	  >
	| Request<'answerCards', { answers: Array<{ cardId: number; ease: number }> }, boolean[]>
	| Request<'areDue', { cards: number[] }, boolean[]>
	| Request<'areSuspended', { cards: number[] }, Array<boolean | null>>
	| Request<'cardsInfo', { cards: number[] }, CardInfo[]>
	| Request<'cardsToNotes', { cards: number[] }, number[]>
	| Request<'findCards', { query: string }, number[]> // Query syntax: https://docs.ankiweb.net/searching.html
	| Request<'forgetCards', { cards: number[] }, null>
	| Request<'getEaseFactors', { cards: number[] }, number[]>
	| Request<'getIntervals', { cards: number[]; complete?: boolean }, number[] | number[][]>
	| Request<'relearnCards', { cards: number[] }, null>
	| Request<'setEaseFactors', { cards: number[]; easeFactors: number[] }, boolean[]> // TODo confirm return quantity
	| Request<'suspend', { cards: number[] }, boolean>
	| Request<'suspended', { card: number }, boolean>
	| Request<'unsuspend', { cards: number[] }, boolean>

// Not sure if this is definitive
// https://github.com/ankitects/anki/blob/main/rslib/src/browser_table.rs
// https://github.com/ankidroid/Anki-Android/wiki/Database-Structure#cards
type CardBrowserColumns =
	| 'answer'
	| 'cardDue'
	| 'cardEase'
	| 'cardIvl'
	| 'cardLapses'
	| 'cardMod'
	| 'cardReps'
	| 'deck'
	| 'note'
	| 'noteCrt'
	| 'noteFld'
	| 'noteMod'
	| 'noteTags'
	| 'question'
	| 'template'
	| ({} & string) // Allow arbitrary strings too

type NoteModel =
	| 'Basic (and reversed card)'
	| 'Basic (type in the answer)'
	| 'Basic'
	| 'Cloze'
	| ({} & string) // Allow arbitrary strings too

type NoteMedia = {
	fields: string[]
	filename: string
	skipHash?: false
	url: string
}

type Note = {
	audio?: NoteMedia[]
	deckName: string
	fields: Record<string, string>
	modelName: NoteModel
	picture?: NoteMedia[]
	tags?: string[]
	video?: NoteMedia[]
}

type NoteWithCreationOptions = {
	options?: {
		allowDuplicate?: boolean
		duplicateScope: 'deck' | ({} & string) // Only deck is official, any other value represents the entire collection
		duplicateScopeOptions: {
			checkAllModels?: boolean
			checkChildren?: boolean
			deckName?: null | string
		}
	}
} & Note

type GraphicalRequests =
	| Request<
			'guiBrowse',
			{
				query: string
				reorderCards?: {
					columnId: CardBrowserColumns
					order: 'ascending' | 'descending'
				}
			},
			number[]
	  > // Query syntax: https://docs.ankiweb.net/searching.html
	| Request<'guiAddCards', { note: Note }, number>
	| Request<'guiAnswerCard', { ease: number }, boolean>
	| Request<'guiCheckDatabase', undefined, true> // True even if errors detected
	| Request<'guiCurrentCard', undefined, CardInfo | null>
	| Request<'guiDeckBrowser', undefined, null>
	| Request<'guiDeckOverview', { name: string }, boolean>
	| Request<'guiDeckReview', { name: string }, boolean>
	| Request<'guiEditNote', { note: number }, null>
	| Request<'guiExitAnki', undefined, null> // Returns before it actually closes
	| Request<'guiImportFile', { path: string }, null>
	| Request<'guiSelectNote', { note: number }, boolean>
	| Request<'guiSelectNotes', undefined, number[]>
	| Request<'guiShowAnswer', undefined, boolean>
	| Request<'guiShowQuestion', undefined, boolean>
	| Request<'guiStartCardTimer', undefined, true> // Or null?
	| Request<'guiUndo', undefined, boolean> // Or null?

type MediaRequests =
	| Request<
			'retrieveMediaFile',
			{
				filename: string
			},
			false | string
	  > // Base64 encoded string
	| Request<
			'storeMediaFile',
			{
				data: string // First priority
				deleteExisting: boolean
				filename: string
				path: string // Second priority
				url: string // Third priority
			},
			string
	  >
	| Request<'deleteMediaFile', { filename: string }, null>
	| Request<'getMediaDirPath', undefined, string>
	| Request<'getMediaFilesNames', { pattern: string }, string[]>

type MiscellaneousRequests =
	| Request<
			'apiReflect',
			{ actions: null | string[]; scopes: Array<'actions'> },
			{
				actions: string[]
				scopes: string[] // More than just 'actions?'
			}
	  >
	| Request<
			'exportPackage',
			{
				deck: string
				includeSched?: boolean
				path: string
			},
			boolean
	  >
	| Request<
			'importPackage',
			{
				path: string // Relative to media folder
			},
			boolean
	  >
	| Request<
			'multi', // Crazy, have to call this experimental
			{
				actions: Array<{
					action: Requests['action'] // No generic objects : /
					params?: Requests['params']
					version?: number
				}>
			},
			Array<{ error: null | string; result: Requests['response'] } | Requests['response']>
	  >
	| Request<
			'requestPermission',
			undefined,
			| {
					permission: 'denied'
			  }
			| {
					permission: 'granted'
					requireApiKey: boolean
					version: boolean
			  }
	  >
	| Request<'getProfiles', undefined, string[]>
	| Request<'loadProfile', { name: string }, true> // Also false?
	| Request<'reloadCollection', undefined, null>
	| Request<'sync', undefined, null>
	| Request<'version', undefined, number> // Currently versions 1 through 6 are defined.

type ModelField = {
	collapsed: boolean
	description: string
	excludeFromSearch: boolean
	font: string
	id: number
	name: string
	ord: number
	plainText: boolean
	preventDeletion: boolean
	rtl: boolean
	size: number
	sticky: boolean
	tag: null // Always?
}

type ModelTemplate = {
	afmt: string
	bafmt: string
	bfont: string
	bqfmt: string
	bsize: number
	did: null // Always?
	id: number
	name: string
	ord: number
	qfmt: string
}

type Model = {
	css: string
	did: null // Always?
	flds: ModelField[]
	id: number
	latexPost: string
	latexPre: string
	latexsvg: boolean
	mod: number
	name: string
	originalStockKind: number
	req: Array<[number, string, number[]]> // Hmm?
	sortf: number
	tmpls: ModelTemplate[]
	type: number
	usn: number
}

type ModelActions =
	| Request<
			'createModel',
			{
				cardTemplates: Array<{
					Back: string
					Front: string
					Name?: string // Default is 'Card 1', 'Card 2', etc.
				}>
				css?: string
				inOrderFields: string[]
				isCloze?: boolean
				modelName: string
			},
			Model
	  >
	| Request<
			'findAndReplaceInModels',
			{
				model: {
					back: boolean
					css: boolean
					fieldText: string
					front: boolean
					modelName: string
					replaceText: string
				}
			},
			number
	  >
	| Request<
			'modelFieldDescriptions',
			{ description: string; fieldName: string; modelName: string },
			boolean
	  > // Only ancient versions return false
	| Request<
			'modelFieldFonts',
			{ modelName: string },
			Record<
				string,
				{
					font: string
					size: number
				}
			>
	  >
	| Request<
			'modelFieldRename',
			{ modelName: string; newFieldName: string; oldFieldName: string },
			null
	  >
	| Request<
			'modelFieldSetDescription',
			{ fieldName: string; index: number; modelName: string },
			null
	  >
	| Request<
			'modelFieldSetFontSize',
			{ fieldName: string; fontSize: number; modelName: string },
			null
	  >
	| Request<
			'modelTemplateAdd',
			{
				modelName: string
				template: {
					Back: string
					Front: string
					Name: string
				}
			},
			null
	  >
	| Request<
			'modelTemplateRemove',
			{
				modelName: string
				templateName: string
			},
			null
	  >
	| Request<
			'modelTemplateRename',
			{ modelName: string; newTemplateName: string; oldTemplateName: string },
			null
	  >
	| Request<
			'modelTemplateReposition',
			{ index: number; modelName: string; templateName: string },
			null
	  >
	| Request<
			'modelTemplates',
			{ modelName: string },
			Record<
				string,
				{
					// More fields?
					Back: string
					Front: string
				}
			>
	  >
	| Request<
			'updateModelStyling',
			{
				model: {
					css: string
					name: string
				}
			},
			null
	  >
	| Request<
			'updateModelTemplates',
			{
				model: {
					name: string
					templates: Record<string, { Back?: string; Front?: string }>
				}
			},
			null
	  >
	| Request<'findModelsById', { modelNames: string[] }, Model[]>
	| Request<'findModelsByName', { modelIds: number[] }, Model[]>
	| Request<'modelFieldAdd', { fieldName: string; index: number; modelName: string }, null>
	| Request<'modelFieldNames', { modelName: string }, string[]>
	| Request<'modelFieldRemove', { fieldName: string; modelName: string }, null>
	| Request<'modelFieldReposition', { fieldName: string; index: number; modelName: string }, null>
	| Request<'modelFieldSetFont', { fieldName: string; font: string; modelName: string }, null>
	| Request<'modelFieldsOnTemplates', { modelName: string }, Record<string, [string[], string[]]>> // Note tuple
	| Request<'modelNames', undefined, string[]>
	| Request<'modelNamesAndIds', undefined, Record<string, number>>
	| Request<'modelStyling', { modelName: string }, { css: string }>

type NoteActions =
	| Request<
			'addTags',
			{
				notes: number[]
				tags: string // Array allowed?
			},
			null
	  >
	| Request<
			'canAddNotesWithErrorDetail',
			{ notes: NoteWithCreationOptions[] },
			Array<
				| {
						canAdd: false
						error: string
				  }
				| { canAdd: true }
			>
	  >
	| Request<
			'findNotes',
			{
				// https://docs.ankiweb.net/searching.html
				query: string
			},
			number[]
	  >
	| Request<
			'getNoteTags',
			{
				note: number
			},
			string[]
	  >
	| Request<
			'notesInfo',
			{
				notes: number[]
			},
			Array<{
				fields: Record<string, string>
				modelName: string
				noteId: number
				tags: string[]
			}>
	  >
	| Request<
			'removeTags',
			{
				notes: number[]
				tags: string // Array allowed?
			},
			null
	  >
	| Request<
			'replaceTags',
			{
				notes: number[]
				replace_with_tag: string
				tag_to_replace: string
			},
			null
	  >
	| Request<
			'replaceTagsInAllNotes',
			{
				replace_with_tag: string
				tag_to_replace: string
			},
			null
	  >
	| Request<
			'updateNote',
			{
				// Certain fields only available when fields is defined
				note:
					| {
							audio?: NoteMedia[]
							fields: Record<string, string>
							id: number
							picture?: NoteMedia[]
							tags?: string[]
							video?: NoteMedia[]
					  }
					| {
							fields?: Record<string, string>
							id: number
							tags: string[]
					  }
			},
			null
	  >
	| Request<
			'updateNoteFields',
			{
				note: {
					audio?: NoteMedia[]
					fields: Record<string, string>
					id: number
					picture?: NoteMedia[]
					video?: NoteMedia[]
				}
			},
			null
	  >
	| Request<
			'updateNoteModel',
			{
				note: {
					fields: Record<string, string>
					id: number
					modelName: string
					tags: string[]
				}
			},
			null
	  >
	| Request<
			'updateNoteTags',
			{
				note: number
				tags: string[]
			},
			null
	  >
	| Request<'addNote', { note: NoteWithCreationOptions }, number>
	| Request<'addNotes', { notes: NoteWithCreationOptions[] }, Array<null | string>>
	| Request<'canAddNotes', { notes: NoteWithCreationOptions[] }, boolean[]>
	| Request<'clearUnusedTags', undefined, string[]>
	| Request<'deleteNotes', { notes: number[] }, number>
	| Request<'getTags', undefined, string[]>
	| Request<'removeEmptyNotes', undefined, null>

type ReviewStatisticTuple = [
	reviewTime: number,
	cardID: number,
	usn: number,
	buttonPressed: number,
	newInterval: number,
	previousInterval: number,
	newFactor: number,
	reviewDuration: number,
	reviewType: number,
]

type StatisticRequests =
	| Request<
			'cardReviews',
			{
				deck: string
				startID: number
			},
			ReviewStatisticTuple[]
	  >
	| Request<
			'getReviewsOfCards',
			{
				cards: string[]
			},
			Record<
				string,
				Array<{
					/** ButtonPressed */
					ease: number
					/** NewFactor */
					factor: number
					/** ReviewTime */
					id: number
					/** NewInterval */
					ivl: number
					/** PreviousInterval */
					lastIvl: number
					/** ReviewDuration */
					time: number
					/** ReviewType */
					type: number
					/** Usn */
					usn: number
				}>
			>
	  >
	| Request<'getCollectionStatsHTML', { wholeCollection: boolean }, string>
	| Request<'getLatestReviewID', { deck: string }, number>
	| Request<'getNumCardsReviewedByDay', undefined, Array<[string, number]>>
	| Request<'getNumCardsReviewedToday', undefined, number>
	| Request<'insertReviews', { reviews: ReviewStatisticTuple[] }, null>

type Requests =
	| CardRequests
	| DeckRequests
	| GraphicalRequests
	| MediaRequests
	| MiscellaneousRequests
	| ModelActions
	| NoteActions
	| StatisticRequests

type ParamsForRequest<T extends Requests['action']> = Extract<Requests, { action: T }>['params']
type ResponseForRequest<T extends Requests['action']> = Extract<Requests, { action: T }>['response']

export async function invoke<T extends Requests['action']>(
	action: T,
	params?: ParamsForRequest<T>,
	version = 6,
): Promise<ResponseForRequest<T>> {
	const response = await fetch('http://127.0.0.1:8765', {
		body: JSON.stringify({ action, params, version }),
		headers: {
			'Content-Type': 'application/json',
		},
		method: 'POST',
	})

	if (!response.ok) {
		throw new Error('failed to issue request')
	}

	return (await response.json()) as ResponseForRequest<T>
}

export async function deckNames() {
	return invoke('deckNames')
}

const f = await invoke('getNumCardsReviewedByDay')

console.log(f)

// Const noteIds = (await invoke('findNotes', 6, {
// 	query: 'deck:Default',
// })) as number[]

// const notes = (await invoke('notesInfo', 6, {
// 	notes: noteIds,
// })) as number[]

// console.log('----------------------------------')
// for (const note of notes) {
// 	console.log(note)
// }
