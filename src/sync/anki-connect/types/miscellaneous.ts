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
	| Request<'getProfiles', never, string[]>
	| Request<'loadProfile', { name: string }, true> // Also false?
	| Request<'reloadCollection'>
	| Request<'sync'>
	| Request<'version', never, number> // Currently versions 1 through 6 are defined.
