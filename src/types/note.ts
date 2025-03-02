/* eslint-disable ts/no-restricted-types */

import { type Request } from './shared'

type NoteModel =
	| 'Basic'
	| 'Basic (and reversed card)'
	| 'Basic (type in the answer)'
	| 'Cloze'
	| (string & {}) // Allow arbitrary strings too

type NoteMedia = {
	data?: string // First priority, must have one of these three
	fields: string[]
	path?: string // Second priority, must have one of these three
	skipHash?: false
	url?: string // Third priority, must have one of these three
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
	| Request<'addNotes', 6, { notes: NoteWithCreationOptions[] }, Array<null | string>>
	| Request<
			'addTags',
			6,
			{
				notes: number[]
				tags: string // Array allowed?
			}
	  >
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
	| Request<'clearUnusedTags', 6, never, string[]>
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
			{
				notes: number[]
			},
			Array<{
				cards: number[]
				fields: Record<
					string,
					{
						order: number
						value: string
					}
				>
				mod: number
				modelName: string
				noteId: number
				profile: string
				tags: string[]
			}>
	  >
	| Request<
			'notesModTime',
			6,
			{
				notes: number[]
			},
			Array<{
				mod: number
				noteId: number
			}>
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
