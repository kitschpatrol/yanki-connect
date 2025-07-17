import type { Request } from './shared'

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
		fuzz: number
		ivlFct: number
		maxIvl: number
		minSpace: number
		perDay: number
	}
	timer: number
	usn: number
}

export type DeckRequests =
	| Request<'changeDeck', 6, { cards: number[]; deck: string }>
	| Request<'cloneDeckConfigId', 6, { cloneFrom: number; name: string }, false | number>
	| Request<'createDeck', 6, { deck: string }, number>
	| Request<'deckNames', 6, never, string[]>
	| Request<'deckNamesAndIds', 6, never, Record<string, number>>
	| Request<'deleteDecks', 6, { cardsToo: true; decks: string[] }>
	| Request<'getDeckConfig', 6, { deck: string }, DeckConfig>
	| Request<'getDecks', 6, Record<'cards', number[]>, Record<string, number[]>>
	| Request<'getDeckStats', 6, { decks: string[] }, Record<string, DeckStats>>
	| Request<'removeDeckConfigId', 6, { configId: number }, boolean>
	| Request<'saveDeckConfig', 6, { config: DeckConfig }, boolean>
	| Request<'setDeckConfigId', 6, { configId: number; decks: string[] }, boolean>
