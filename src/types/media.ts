import type { Request } from './shared'

export type MediaRequests =
	| Request<'deleteMediaFile', 6, { filename: string }>
	| Request<'getMediaDirPath', 6, never, string>
	| Request<'getMediaFilesNames', 6, { pattern: string }, string[]>
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
				data?: string // First priority, must have one of these three
				deleteExisting?: boolean // Defaults to true
				filename: string
				path?: string // Second priority, must have one of these three
				url?: string // Third priority, must have one of these three
			},
			string
	  >
