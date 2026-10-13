/* eslint-disable ts/no-restricted-types */

import type { Request, Requests } from './shared'

type SingleRequest = Exclude<Requests, { action: 'multi' }>

type MultiResult =
	| MultiResult[]
	| SingleRequest['response']
	| SingleRequest['response']['result']
	| { error: null | string; result: MultiResult[] }

export type MiscellaneousRequests =
	| Request<
			'apiReflect',
			6,
			{ actions: null | string[]; scopes: Array<'actions'> },
			{
				actions?: string[]
				scopes: string[] // More than just 'actions?'
			}
	  >
	| Request<
			'exportPackage',
			6,
			{
				deck: string
				includeSched?: boolean
				path: string
			},
			boolean
	  >
	| Request<'getActiveProfile', 6, never, string>
	| Request<'getProfiles', 6, never, string[]>
	| Request<
			'importPackage',
			6,
			{
				path: string // Relative to media folder
			},
			boolean
	  >
	| Request<'loadProfile', 6, { name: string }, boolean>
	| Request<
			'multi',
			6, // Crazy, have to call this experimental
			{
				actions: Array<{
					action: Requests['action'] // No generic objects : /
					params?: Requests['params']
					version?: number
				}>
			},
			MultiResult[]
	  >
	| Request<'reloadCollection', 6>
	| Request<
			'requestPermission',
			6,
			never,
			| {
					permission: 'denied'
			  }
			| {
					permission: 'granted'
					requireApikey: boolean
					version: number
			  }
	  >
	| Request<'sync', 6>
	| Request<'version', 6, never, number> // Currently versions 1 through 6 are defined.
