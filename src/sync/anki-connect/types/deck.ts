/* eslint-disable @typescript-eslint/naming-convention */

import { type Request } from './shared'

export type DeckStats = {
	deck_id: number
	learn_count: number
	name: string
	new_count: number
	review_count: number
	total_in_deck: number
}

export type DeckConfig = {
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

export type DeckRequests =
	| Request<'changeDeck', { cards: number[]; deck: string }>
	| Request<'cloneDeckConfigId', { cloneFrom: number; name: string }, false | number>
	| Request<'createDeck', { deck: string }, Record<string, number>>
	| Request<'deckNames', never, string[]>
	| Request<'deckNamesAndIds', never, Record<string, number>>
	| Request<'deleteDecks', { cardsToo: true; decks: string[] }>
	| Request<'getDeckConfig', { deck: string }, DeckConfig>
	| Request<'getDeckStats', { decks: string[] }, Record<string, DeckStats>>
	| Request<'getDecks', Record<'cards', number[]>, Record<string, number[]>>
	| Request<'removeDeckConfigId', { configId: number }, boolean>
	| Request<'saveDeckConfig', { config: DeckConfig }, boolean>
	| Request<'setDeckConfigId', { configId: number; decks: string[] }, boolean>
