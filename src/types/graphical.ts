import type { CardBrowserColumns, CardInfo } from './card'
import type { Note } from './note'
import type { Request } from './shared'

type GuiCurrentCard = Pick<
	CardInfo,
	'answer' | 'cardId' | 'css' | 'deckName' | 'fieldOrder' | 'fields' | 'modelName' | 'question'
> & {
	buttons: number[]
	nextReviews: string[]
	template: string
}

export type GraphicalRequests =
	| Request<
			'guiAddCards',
			6,
			{
				/** Omitted, the dialog opens without presets. */
				note?: Note
			},
			number
	  >
	| Request<
			'guiAddNoteSetData',
			6,
			{
				/** Concatenate field text and union tags instead of replacing them. */
				append?: boolean
				note: Partial<Note>
			},
			| true
			| {
					/** `1` when the _Add Cards_ dialog is not open. */
					code: number
					error: string
			  }
	  >
	| Request<'guiAnswerCard', 6, { ease: number }, boolean>
	| Request<
			'guiBrowse',
			6,
			{
				query: string
				/** Requires AnkiConnect 24.1.21.0 on Anki 2.1.45 or later. */
				reorderCards?: {
					columnId: CardBrowserColumns
					order: 'ascending' | 'descending'
				}
			},
			number[]
	  > // Query syntax: https://docs.ankiweb.net/searching.html
	| Request<'guiCheckDatabase', 6, never, true> // True even if errors detected
	| Request<'guiCurrentCard', 6, never, GuiCurrentCard>
	| Request<'guiDeckBrowser', 6>
	| Request<'guiDeckOverview', 6, { name: string }, boolean>
	| Request<'guiDeckReview', 6, { name: string }, boolean>
	| Request<'guiEditNote', 6, { note: number }>
	| Request<'guiExitAnki', 6> // Returns before it actually closes
	| Request<
			'guiImportFile',
			6,
			{
				/** Omitted, Anki prompts for a file. */
				path?: string
			}
	  >
	| Request<'guiPlayAudio', 6, never, boolean>
	| Request<'guiReviewActive', 6, never, boolean>
	| Request<'guiSelectCard', 6, { card: number }, boolean>
	| Request<'guiSelectedNotes', 6, never, number[]>
	| Request<'guiSelectNote', 6, { note: number }, boolean>
	| Request<'guiShowAnswer', 6, never, boolean>
	| Request<'guiShowQuestion', 6, never, boolean>
	| Request<'guiStartCardTimer', 6, never, boolean>
	| Request<'guiUndo', 6, never, boolean> // Or null?
