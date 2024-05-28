/* eslint-disable @typescript-eslint/ban-types */

import type { CardBrowserColumns, CardInfo } from './card'
import { type Note } from './note'
import { type Request } from './shared'

export type GraphicalRequests =
	| Request<
			'guiBrowse',
			{
				query: string
				reorderCards?: {
					columnId: CardBrowserColumns
					order: 'ascending' | 'descending'
				}
			},
			number[]
	  > // Query syntax: https://docs.ankiweb.net/searching.html
	| Request<'guiAddCards', { note: Note }, number>
	| Request<'guiAnswerCard', { ease: number }, boolean>
	| Request<'guiCheckDatabase', never, true> // True even if errors detected
	| Request<'guiCurrentCard', never, CardInfo | null>
	| Request<'guiDeckBrowser'>
	| Request<'guiDeckOverview', { name: string }, boolean>
	| Request<'guiDeckReview', { name: string }, boolean>
	| Request<'guiEditNote', { note: number }>
	| Request<'guiExitAnki'> // Returns before it actually closes
	| Request<'guiImportFile', { path: string }>
	| Request<'guiSelectNote', { note: number }, boolean>
	| Request<'guiSelectNotes', never, number[]>
	| Request<'guiShowAnswer', never, boolean>
	| Request<'guiShowQuestion', never, boolean>
	| Request<'guiStartCardTimer', never, true> // Or null?
	| Request<'guiUndo', never, boolean> // Or null?
