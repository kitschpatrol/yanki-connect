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
	| Request<'deleteMediaFile', { filename: string }>
	| Request<'getMediaDirPath', never, string>
	| Request<'getMediaFilesNames', { pattern: string }, string[]>
