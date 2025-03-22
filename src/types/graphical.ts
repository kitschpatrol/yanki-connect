/* eslint-disable ts/no-restricted-types */

import type { CardBrowserColumns, CardInfo } from './card'
import { type Note } from './note'
import { type Request } from './shared'

export type GraphicalRequests =
	| Request<'guiAddCards', 6, { note: Note }, number>
	| Request<'guiAnswerCard', 6, { ease: number }, boolean>
	| Request<
			'guiBrowse',
			6,
			{
				query: string
				reorderCards?: {
					columnId: CardBrowserColumns
					order: 'ascending' | 'descending'
				}
			},
			number[]
	  > // Query syntax: https://docs.ankiweb.net/searching.html
	| Request<'guiCheckDatabase', 6, never, true> // True even if errors detected
	| Request<'guiCurrentCard', 6, never, CardInfo | null>
	| Request<'guiDeckBrowser', 6>
	| Request<'guiDeckOverview', 6, { name: string }, boolean>
	| Request<'guiDeckReview', 6, { name: string }, boolean>
	| Request<'guiEditNote', 6, { note: number }>
	| Request<'guiExitAnki', 6> // Returns before it actually closes
	| Request<'guiImportFile', 6, { path: string }>
	| Request<'guiSelectCard', 6, { card: number }, boolean>
	| Request<'guiSelectedNotes', 6, never, number[]>
	| Request<'guiSelectNote', 6, { note: number }, boolean>
	| Request<'guiShowAnswer', 6, never, boolean>
	| Request<'guiShowQuestion', 6, never, boolean>
	| Request<'guiStartCardTimer', 6, never, true> // Or null?
	| Request<'guiUndo', 6, never, boolean> // Or null?
