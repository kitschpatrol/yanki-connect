/* eslint-disable ts/no-restricted-types */

import type { Request } from './shared'

type NoteModel =
	'Basic' | 'Basic (and reversed card)' | 'Basic (type in the answer)' | 'Cloze' | (string & {}) // Allow arbitrary strings too

type NoteMedia = {
	/** Base64-encoded contents. Used first when more than one source is given. */
	data?: string
	/**
	 * Fields to embed the file in. Optional from AnkiConnect 25.11.2.0 on Anki
	 * 23.10 or later; earlier releases require it.
	 */
	fields?: string[]
	filename: string
	/** Absolute path of a local file. Used when `data` is absent. */
	path?: string
	/** MD5 hex digest. The file is skipped when it matches the incoming data. */
	skipHash?: string
	/** URL to download. Used when `data` and `path` are absent. */
	url?: string
}

export type Note = {
	audio?: NoteMedia[]
	deckName: string
	fields: Record<string, string>
	modelName: NoteModel
	picture?: NoteMedia[]
	tags?: string[]
	video?: NoteMedia[]
}

type NoteWithCreationOptions = Note & {
	options?: {
		allowDuplicate?: boolean
		duplicateScope?: 'deck' | (string & {}) // Only deck is official, any other value represents the entire collection
		duplicateScopeOptions?: {
			checkAllModels?: boolean
			checkChildren?: boolean
			deckName?: null | string
		}
	}
}

export type NoteRequests =
	| Request<'addNote', 6, { note: NoteWithCreationOptions }, null | number>
	| Request<'addNotes', 6, { notes: NoteWithCreationOptions[] }, number[]>
	| Request<
			'addTags',
			6,
			{
				notes: number[]
				tags: string // Array allowed?
			}
	  >
	| Request<'canAddNote', 6, { note: NoteWithCreationOptions }, boolean>
	| Request<'canAddNotes', 6, { notes: NoteWithCreationOptions[] }, boolean[]>
	| Request<
			'canAddNotesWithErrorDetail',
			6,
			{ notes: NoteWithCreationOptions[] },
			Array<
				| {
						canAdd: false
						error: string
				  }
				| { canAdd: true }
			>
	  >
	| Request<
			'canAddNoteWithErrorDetail',
			6,
			{ note: NoteWithCreationOptions },
			| {
					canAdd: false
					error: string
			  }
			| { canAdd: true }
	  >
	| Request<'clearUnusedTags', 6>
	| Request<'deleteNotes', 6, { notes: number[] }>
	| Request<
			'findNotes',
			6,
			{
				// https://docs.ankiweb.net/searching.html
				query: string
			},
			number[]
	  >
	| Request<
			'getNoteTags',
			6,
			{
				note: number
			},
			string[]
	  >
	| Request<'getTags', 6, never, string[]>
	| Request<
			'notesInfo',
			6,
			| {
					/** Search query. Requires AnkiConnect 25.2.24.0. */
					query: string
			  }
			| { notes: number[] },
			Array<
				| Record<string, never>
				| {
						cards: number[]
						fields: Record<
							string,
							{
								order: number
								value: string
							}
						>
						/** Present from AnkiConnect 24.7.25.0. */
						mod?: number
						modelName: string
						noteId: number
						/** Present from AnkiConnect 24.7.25.0. */
						profile?: string
						tags: string[]
				  }
			>
	  >
	| Request<
			'notesModTime',
			6,
			{
				notes: number[]
			},
			Array<
				| Record<string, never>
				| {
						mod: number
						noteId: number
				  }
			>
	  >
	| Request<'removeEmptyNotes', 6>
	| Request<
			'removeTags',
			6,
			{
				notes: number[]
				tags: string // Array allowed?
			}
	  >
	| Request<
			'replaceTags',
			6,
			{
				notes: number[]
				replace_with_tag: string
				tag_to_replace: string
			}
	  >
	| Request<
			'replaceTagsInAllNotes',
			6,
			{
				replace_with_tag: string
				tag_to_replace: string
			}
	  >
	| Request<
			'updateNote',
			6,
			{
				// Certain fields only available when fields is defined
				note:
					| {
							audio?: NoteMedia[]
							fields: Record<string, string>
							id: number
							picture?: NoteMedia[]
							tags?: string[]
							video?: NoteMedia[]
					  }
					| {
							fields?: Record<string, string>
							id: number
							tags: string[]
					  }
			}
	  >
	| Request<
			'updateNoteFields',
			6,
			{
				note: {
					audio?: NoteMedia[]
					fields: Record<string, string>
					id: number
					picture?: NoteMedia[]
					video?: NoteMedia[]
				}
			}
	  >
	| Request<
			'updateNoteModel',
			6,
			{
				note: {
					fields: Record<string, string>
					id: number
					modelName: string
					tags: string[]
				}
			}
	  >
	| Request<
			'updateNoteTags',
			6,
			{
				note: number
				tags: string[]
			}
	  >
