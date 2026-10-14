/* eslint-disable ts/no-restricted-types */

import type { Request } from './shared'

type StoreMediaFileParams = {
	/** Base64-encoded contents. Used first when more than one source is given. */
	data?: string
	/** Delete an existing file with the same name. Defaults to `true`. */
	deleteExisting?: boolean
	filename: string
	/** Absolute path of a local file. Used when `data` is absent. */
	path?: string
	/**
	 * MD5 hex digest. Nothing is stored and `null` is returned when it matches
	 * the incoming data.
	 */
	skipHash?: string
	/** URL to download. Used when `data` and `path` are absent. */
	url?: string
}

/**
 * `storeMediaFile` returns the stored filename, or `null` when `skipHash`
 * matches the incoming data, so the convenience method narrows its result from
 * the parameters.
 */
export type StoreMediaFileMethod = {
	(params: StoreMediaFileParams & { skipHash: string }): Promise<null | string>
	(params: StoreMediaFileParams): Promise<string>
}

export type MediaRequests =
	| Request<'deleteMediaFile', 6, { filename: string }>
	| Request<'getMediaDirPath', 6, never, string>
	| Request<
			'getMediaFilesNames',
			6,
			{
				/** Glob pattern. Defaults to every file. */
				pattern?: string
			},
			string[]
	  >
	| Request<
			'retrieveMediaFile',
			6,
			{
				filename: string
			},
			false | string
	  > // Base64 encoded string
	| Request<'storeMediaFile', 6, StoreMediaFileParams, null | string>
