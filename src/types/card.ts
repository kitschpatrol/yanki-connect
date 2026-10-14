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
export type CardInfo = {
	answer: string // Back
	cardId: number
	css: string
	deckName: string
	due: number
	fieldOrder: number
	fields: Record<string, { order: number; value: string }>
	/** Present from AnkiConnect 24.11.5.0. */
	flags?: number
	interval: number
	lapses: number
	left: number
	mod: number
	modelName: string
	/** Present from AnkiConnect 24.6.17.0 on Anki 2.1.55 or later. */
	nextReviews?: string[]
	note: number
	ord: number
	question: string // Front
	queue: number
	reps: number
	type: number
}

/**
 * `cardsInfo` returns complete records unless `fields` selects a subset, so the
 * convenience method narrows its result from the parameters.
 */
export type CardsInfoMethod = {
	<Field extends keyof CardInfo>(params: {
		cards: number[]
		/** Requires AnkiConnect 26.10.12.2; earlier releases reject the request. */
		fields: Field[]
	}): Promise<Array<Pick<CardInfo, Field> | Record<string, never>>>
	(params: { cards: number[] }): Promise<Array<CardInfo | Record<string, never>>>
}

export type CardRequests =
	| Request<'answerCards', 6, { answers: Array<{ cardId: number; ease: number }> }, boolean[]>
	| Request<'areDue', 6, { cards: number[] }, boolean[]>
	| Request<'areSuspended', 6, { cards: number[] }, Array<boolean | null>>
	| Request<
			'cardsInfo',
			6,
			{
				cards: number[]
				/** Requires AnkiConnect 26.10.12.2; earlier releases reject the request. */
				fields?: Array<keyof CardInfo>
			},
			Array<Partial<CardInfo>> // Missing cards are {}, and `fields` selects a subset of each record
	  >
	| Request<
			'cardsModTime',
			6,
			{ cards: number[] },
			Array<
				| Record<string, never>
				| {
						cardId: number
						mod: number
				  }
			>
	  >
	| Request<'cardsToNotes', 6, { cards: number[] }, number[]>
	| Request<'findCards', 6, { query: string }, number[]> // Query syntax: https://docs.ankiweb.net/searching.html
	| Request<'forgetCards', 6, { cards: number[] }>
	| Request<'getEaseFactors', 6, { cards: number[] }, number[]>
	| Request<'getIntervals', 6, { cards: number[]; complete?: boolean }, number[] | number[][]>
	| Request<'relearnCards', 6, { cards: number[] }>
	| Request<'setDueDate', 6, { cards: number[]; days: string }, boolean>
	| Request<'setEaseFactors', 6, { cards: number[]; easeFactors: number[] }, boolean[]> // TODO confirm return quantity
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
	| Request<'suspend', 6, { cards: number[] }, boolean>
	| Request<'suspended', 6, { card: number }, boolean>
	| Request<'unsuspend', 6, { cards: number[] }, boolean | null>
