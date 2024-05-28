/* eslint-disable @typescript-eslint/ban-types */

import { type Request } from './shared'

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
	| ({} & string) // Allow arbitrary strings too

// See https://github.com/ankidroid/Anki-Android/wiki/Database-Structure#cards
export type CardValueKeys =
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

export type CardRequests =
	| Request<
			'cardsModTime',
			{ cards: number[] },
			{
				cardId: number
				mod: number
			}
	  >
	| Request<'answerCards', { answers: Array<{ cardId: number; ease: number }> }, boolean[]>
	| Request<'areDue', { cards: number[] }, boolean[]>
	| Request<'areSuspended', { cards: number[] }, Array<boolean | null>>
	| Request<'cardsInfo', { cards: number[] }, CardInfo[]>
	| Request<'cardsToNotes', { cards: number[] }, number[]>
	| Request<'findCards', { query: string }, number[]> // Query syntax: https://docs.ankiweb.net/searching.html
	| Request<'forgetCards', { cards: number[] }>
	| Request<'getEaseFactors', { cards: number[] }, number[]>
	| Request<'getIntervals', { cards: number[]; complete?: boolean }, number[] | number[][]>
	| Request<'relearnCards', { cards: number[] }>
	| Request<'setEaseFactors', { cards: number[]; easeFactors: number[] }, boolean[]> // TODO confirm return quantity
	| Request<'setSpecificValueOfCard', { card: number; keys: CardValueKeys[]; newValues: string[] }, boolean[]>
	| Request<'suspend', { cards: number[] }, boolean>
	| Request<'suspended', { card: number }, boolean>
	| Request<'unsuspend', { cards: number[] }, boolean>
