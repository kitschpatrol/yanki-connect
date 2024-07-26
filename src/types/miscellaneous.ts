/* eslint-disable @typescript-eslint/ban-types */

import type { Request, Requests } from './shared'

export type MiscellaneousRequests =
	| Request<
			'apiReflect',
			6,
			{ actions: null | string[]; scopes: Array<'actions'> },
			{
				actions: string[]
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
	| Request<
			'importPackage',
			6,
			{
				path: string // Relative to media folder
			},
			boolean
	  >
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
			Array<{ error: null | string; result: Requests['response'] } | Requests['response']>
	  >
	| Request<
			'requestPermission',
			6,
			never,
			| {
					permission: 'denied'
			  }
			| {
					permission: 'granted'
					requireApiKey: boolean
					version: boolean
			  }
	  >
	| Request<'getProfiles', 6, never, string[]>
	| Request<'getActiveProfile', 6, never, string>
	| Request<'loadProfile', 6, { name: string }, true> // Also false?
	| Request<'reloadCollection', 6>
	| Request<'sync', 6>
	| Request<'version', 6, never, number> // Currently versions 1 through 6 are defined.
