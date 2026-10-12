/* eslint-disable ts/no-restricted-types */

import type { Request } from './shared'

// Not sure if this is definitive
// https://github.com/ankitects/anki/blob/main/rslib/src/browser_table.rs
// https://github.com/ankidroid/Anki-Android/wiki/Database-Structure#cards
export type CardBrowserColumns =
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
	| (string & {}) // Allow arbitrary strings too

// Keys accepted by setSpecificValueOfCard as of AnkiConnect 26.10.11.4. Writes
// to other card columns (ownership, queue, type, due, and sync metadata) are
// rejected. See https://github.com/ankidroid/Anki-Android/wiki/Database-Structure#cards
type CardValueKeys =
	| 'custom_data' // Custom scheduling data, JSON string
	| 'did' // Deck ID, requires warning_check, can't be combined with other keys
	| 'factor' // Ease factor in permille, e.g. 2500 for 250%
	| 'flags' // Can't be combined with other keys
	| 'ivl' // Interval in days, requires warning_check
	| 'lapses' // Requires warning_check
	| 'reps' // Requires warning_check

type CardInfo = {
	answer: string // Back
	cardId: number
	css: string
	deckName: string
	due: number
	factor: number // Ease factor in permille, e.g. 2500 for 250%
	fieldOrder: number
	fields: Record<string, { order: number; value: string }>
	flags: number
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
	type: number
}

/** Subset of card information returned by `guiCurrentCard`. */
export type CurrentCardInfo = Pick<
	CardInfo,
	| 'answer'
	| 'cardId'
	| 'css'
	| 'deckName'
	| 'fieldOrder'
	| 'fields'
	| 'modelName'
	| 'nextReviews'
	| 'question'
> & {
	buttons: number[]
	template: string
}

export type CardRequests =
	| Request<'answerCards', 6, { answers: Array<{ cardId: number; ease: number }> }, boolean[]>
	| Request<'areDue', 6, { cards: number[] }, boolean[]>
	| Request<'areSuspended', 6, { cards: number[] }, Array<boolean | null>>
	| Request<'cardsInfo', 6, { cards: number[] }, CardInfo[]>
	| Request<'cardsModTime', 6, { cards: number[] }, Array<{ cardId: number; mod: number }>>
	| Request<'cardsToNotes', 6, { cards: number[] }, number[]>
	| Request<'findCards', 6, { query: string }, number[]> // Query syntax: https://docs.ankiweb.net/searching.html
	| Request<'forgetCards', 6, { cards: number[] }>
	| Request<'getEaseFactors', 6, { cards: number[] }, number[]>
	| Request<'getIntervals', 6, { cards: number[]; complete?: boolean }, number[] | number[][]>
	| Request<'relearnCards', 6, { cards: number[] }>
	| Request<'setDueDate', 6, { cards: number[]; days: string }, boolean>
	| Request<'setEaseFactors', 6, { cards: number[]; easeFactors: number[] }, boolean[]>
	| Request<
			'setSpecificValueOfCard',
			6,
			{
				card: number
				keys: CardValueKeys[]
				newValues: Array<number | string>
				warning_check?: boolean
			},
			[[false, string]] | [true] | false
	  >
	| Request<'suspend', 6, { cards: number[]; suspend?: boolean }, boolean>
	| Request<'suspended', 6, { card: number }, boolean>
	| Request<'unsuspend', 6, { cards: number[] }, boolean>
