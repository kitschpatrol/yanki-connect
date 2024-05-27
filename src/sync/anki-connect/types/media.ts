/* eslint-disable @typescript-eslint/ban-types */

import { type Request } from './shared'

export type MediaRequests =
	| Request<
			'retrieveMediaFile',
			{
				filename: string
			},
			false | string
	  > // Base64 encoded string
	| Request<
			'storeMediaFile',
			{
				data: string // First priority
				deleteExisting: boolean
				filename: string
				path: string // Second priority
				url: string // Third priority
			},
			string
	  >
	| Request<'deleteMediaFile', { filename: string }, null>
	| Request<'getMediaDirPath', undefined, string>
	| Request<'getMediaFilesNames', { pattern: string }, string[]>
