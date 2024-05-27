/* eslint-disable @typescript-eslint/ban-types */

import type { Request, Requests } from './shared'

export type MiscellaneousRequests =
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
