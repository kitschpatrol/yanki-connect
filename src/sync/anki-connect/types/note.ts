/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/ban-types */

import { type Request } from './shared'

export type NoteModel = 'Basic (and reversed card)' | 'Basic (type in the answer)' | 'Basic' | 'Cloze' | ({} & string) // Allow arbitrary strings too

export type NoteMedia = {
	fields: string[]
	filename: string
	skipHash?: false
	url: string
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

export type NoteWithCreationOptions = {
	options?: {
		allowDuplicate?: boolean
		duplicateScope: 'deck' | ({} & string) // Only deck is official, any other value represents the entire collection
		duplicateScopeOptions: {
			checkAllModels?: boolean
			checkChildren?: boolean
			deckName?: null | string
		}
	}
} & Note

export type NoteRequests =
	| Request<
			'addTags',
			{
				notes: number[]
				tags: string // Array allowed?
			}
	  >
	| Request<
			'canAddNotesWithErrorDetail',
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
			'findNotes',
			{
				// https://docs.ankiweb.net/searching.html
				query: string
			},
			number[]
	  >
	| Request<
			'getNoteTags',
			{
				note: number
			},
			string[]
	  >
	| Request<
			'notesInfo',
			{
				notes: number[]
			},
			Array<{
				fields: Record<string, string>
				modelName: string
				noteId: number
				tags: string[]
			}>
	  >
	| Request<
			'removeTags',
			{
				notes: number[]
				tags: string // Array allowed?
			}
	  >
	| Request<
			'replaceTags',
			{
				notes: number[]
				replace_with_tag: string
				tag_to_replace: string
			}
	  >
	| Request<
			'replaceTagsInAllNotes',
			{
				replace_with_tag: string
				tag_to_replace: string
			}
	  >
	| Request<
			'updateNote',
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
			{
				note: number
				tags: string[]
			}
	  >
	| Request<'addNote', { note: NoteWithCreationOptions }, number>
	| Request<'addNotes', { notes: NoteWithCreationOptions[] }, Array<null | string>>
	| Request<'canAddNotes', { notes: NoteWithCreationOptions[] }, boolean[]>
	| Request<'clearUnusedTags', never, string[]>
	| Request<'deleteNotes', { notes: number[] }, number>
	| Request<'getTags', never, string[]>
	| Request<'removeEmptyNotes'>
