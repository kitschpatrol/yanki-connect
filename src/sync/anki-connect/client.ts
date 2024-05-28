/* eslint-disable perfectionist/sort-classes */

/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/ban-types */
import type {
	Actions,
	ActionsWithParams,
	ActionsWithoutParams,
	ParamsForAction,
	ResponseForAction,
} from './types/shared'

// --------------------------

// 	https://github.com/benfc1993/p5-typescript/blob/f767f1dbc177cacf8b5a6a5c1eff921060b9d74f/src/types/tupleDifference.ts#L20
type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (
	k: infer I,
) => void
	? I
	: never
type LastOf<T> =
	UnionToIntersection<T extends unknown ? () => T : never> extends () => infer R ? R : never

type Push<T extends unknown[], V> = [...T, V]
type UnionToTuple<T, L = LastOf<T>, N = [T] extends [never] ? true : false> = true extends N
	? []
	: Push<UnionToTuple<Exclude<T, L>>, L>

export type ObjectToTuple<
	T,
	KS extends unknown[] = UnionToTuple<keyof T>,
	R extends unknown[] = [],
> = KS extends [infer K, ...infer KT] ? ObjectToTuple<T, KT, [...R, T[K & keyof T]]> : R

type KeysOf<T> = {
	[K in keyof T]: K
}[keyof T]

type f = { a: number; b: number[]; c: { a: boolean } }
export type k = UnionToTuple<KeysOf<f>>
export type g = ObjectToTuple<f>

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

/**
 * AnkiConnectClient is a client for the AnkiConnect API.
 */
export class AnkiConnectClient {
	/**
	 * Card-related notes.
	 */
	// public readonly card = {
	// 	answerCards: this.build('answerCards'),
	// 	areDue: this.build('areDue'),
	// 	areSuspended: this.build('areSuspended'),
	// 	cardsInfo: this.build('cardsInfo'),
	// 	cardsModTime: this.build('cardsModTime'),
	// 	cardsToNotes: this.build('cardsToNotes'),
	// 	findCards: this.build('findCards'),
	// 	forgetCards: this.build('forgetCards'),
	// 	getEaseFactors: this.build('getEaseFactors'),
	// 	getIntervals: this.build('getIntervals'),
	// 	relearnCards: this.build('relearnCards'),
	// 	setEaseFactors: this.build('setEaseFactors'),
	// 	setSpecificValueOfCard: this.build('setSpecificValueOfCard'),
	// 	suspend: this.build('suspend'),
	// 	suspended: this.build('suspended'),
	// 	unsuspend: this.build('unsuspend'),
	// }

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
	// Type t = ActionsForRequests<DeckRequests>

	constructor(
		private readonly host = 'http://127.0.0.1',
		private readonly port = 8765,
		private readonly version = 6,
	) {
		if (version !== 6) {
			throw new Error('AnkiConnectClient only supports version 6')
		}
	}

	// Private build<T extends extends Requests['action']>(action: T): (params?: ParamsForAction<T>) => Promise<ResponseForAction<T>> {
	// 	return async (params: ParamsForAction<T>) => this.invoke<T>(action, params, this.version)
	// }

	// Overload for actions without params
	public async invoke<T extends ActionsWithoutParams>(action: T): Promise<ResponseForAction<T>>
	public async invoke<T extends ActionsWithParams>(
		action: T,
		// eslint-disable-next-line @typescript-eslint/unified-signatures
		params: ParamsForAction<T>,
	): Promise<ResponseForAction<T>>

	// Implementation
	public async invoke<T extends Actions>(
		action: T,
		params?: ParamsForAction<T>,
	): Promise<ResponseForAction<T>> {
		const response = await fetch(`${this.host}:${this.port}`, {
			body: JSON.stringify({ action, params, version: this.version }),
			headers: {
				'Content-Type': 'application/json',
			},
			method: 'POST',
		})

		if (!response.ok) {
			throw new Error('failed to issue request')
		}

		return response.json() as Promise<ResponseForAction<T>>
	}

	// Overload for actions with / without params
	private build<T extends ActionsWithoutParams>(action: T): () => Promise<ResponseForAction<T>>
	private build<T extends ActionsWithParams>(
		action: T,
	): (params: ParamsForAction<T>) => Promise<ResponseForAction<T>>

	private build<T extends Actions>(
		action: T,
	): (params?: ParamsForAction<T>) => Promise<ResponseForAction<T>>

	// // Implementation
	private build<T extends ActionsWithParams>(
		action: T,
	): (params?: ParamsForAction<T>) => Promise<ResponseForAction<T>> {
		return async (params?: ParamsForAction<T>) => this.invoke<T>(action, params)
	}
}

const client = new AnkiConnectClient()
const otherResult = await client.invoke('deckNames')
const result = await client.deck.removeDeckConfigId()

console.log(otherResult)

// Const noteIds = (await invoke('findNotes', 6, {
// 	query: 'deck:Default',
// })) as number[]

// const notes = (await invoke('notesInfo', 6, {
// 	notes: noteIds,
// })) as number[]

// console.log('----------------------------------')
// for (const note of notes) {
// 	console.log(note)
//
