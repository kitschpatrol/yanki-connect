/* eslint-disable ts/no-restricted-types */

import type { Request } from './shared'

type NoteModel =
	'Basic' | 'Basic (and reversed card)' | 'Basic (type in the answer)' | 'Cloze' | (string & {}) // Allow arbitrary strings too

type NoteMedia = {
	data?: string // First priority, must have one of these three
	fields?: string[] // Optional as of AnkiConnect 25.11.9.0
	filename: string
	path?: string // Second priority, must have one of these three
	skipHash?: string
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
		duplicateScope?: 'collection' | 'deck' // Defaults to collection, other values are rejected
		duplicateScopeOptions?: {
			checkAllModels?: boolean
			checkChildren?: boolean
			deckName?: null | string
		}
	}
}

type NoteEligibility =
	| {
			canAdd: false
			error: string
	  }
	| { canAdd: true }

export type NoteRequests =
	| Request<'addNote', 6, { note: NoteWithCreationOptions }, number>
	| Request<'addNotes', 6, { notes: NoteWithCreationOptions[] }, number[]>
	| Request<
			'addTags',
			6,
			{
				add?: boolean // Defaults to true, false removes the tags instead
				notes: number[]
				tags: string | string[] // Space-separated string or array
			}
	  >
	| Request<'canAddNote', 6, { note: NoteWithCreationOptions }, boolean>
	| Request<'canAddNotes', 6, { notes: NoteWithCreationOptions[] }, boolean[]>
	| Request<
			'canAddNotesWithErrorDetail',
			6,
			{ notes: NoteWithCreationOptions[] },
			NoteEligibility[]
	  >
	| Request<'canAddNoteWithErrorDetail', 6, { note: NoteWithCreationOptions }, NoteEligibility>
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
			// Either a list of note IDs or a search query
			// https://docs.ankiweb.net/searching.html
			| {
					notes: number[]
			  }
			| {
					query: string
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
	| Request<'removeEmptyNotes', 6> // Always fails with a compatibility error as of AnkiConnect 26.10.11.0
	| Request<
			'removeTags',
			6,
			{
				notes: number[]
				tags: string | string[] // Space-separated string or array
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
