/* eslint-disable @typescript-eslint/ban-types */

import type { CardRequests } from './card'
import type { DeckRequests } from './deck'
import type { GraphicalRequests } from './graphical'
import type { MediaRequests } from './media'
import type { MiscellaneousRequests } from './miscellaneous'
import type { ModelRequests } from './model'
import type { NoteRequests } from './note'
import type { StatisticRequests } from './statistic'

/**
 * Abstract wrapper over an Anki Connect action / response
 */
export type Request<
	Action extends string,
	Params extends Record<string, unknown> | undefined,
	Result,
> = {
	action: Action
	params?: Params
	response: {
		error: null | string
		result: Result
	}
}

/**
 * Requests
 */
export type Requests =
	// | CardRequests
	| DeckRequests
	// | GraphicalRequests
	// | MediaRequests
	// | MiscellaneousRequests
	// | ModelRequests
	// | NoteRequests
	| StatisticRequests

// Helpers
export type ActionsForRequests<T extends Requests> = T['action']
export type Actions = Requests['action']

export type ActionsWithParams = {
	[K in Actions]: ParamsForAction<K> extends undefined ? never : K
}[Actions]

export type ActionsWithoutParams = {
	[K in Actions]: ParamsForAction<K> extends undefined ? K : never
}[Actions]

export type ParamsForAction<T extends Requests['action']> = Extract<
	Requests,
	{ action: T }
>['params']

export type ResponseForAction<T extends Requests['action']> = Extract<
	Requests,
	{ action: T }
>['response']
