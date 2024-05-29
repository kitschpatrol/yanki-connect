import { type Request } from './shared'

export type MediaRequests =
	| Request<
			'retrieveMediaFile',
			6,
			{
				filename: string
			},
			false | string
	  > // Base64 encoded string
	| Request<
			'storeMediaFile',
			6,
			{
				data: string // First priority
				deleteExisting: boolean
				filename: string
				path: string // Second priority
				url: string // Third priority
			},
			string
	  >
	| Request<'deleteMediaFile', 6, { filename: string }>
	| Request<'getMediaDirPath', 6, never, string>
	| Request<'getMediaFilesNames', 6, { pattern: string }, string[]>
