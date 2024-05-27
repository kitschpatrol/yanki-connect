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
	| Request<'guiCheckDatabase', undefined, true> // True even if errors detected
	| Request<'guiCurrentCard', undefined, CardInfo | null>
	| Request<'guiDeckBrowser', undefined, null>
	| Request<'guiDeckOverview', { name: string }, boolean>
	| Request<'guiDeckReview', { name: string }, boolean>
	| Request<'guiEditNote', { note: number }, null>
	| Request<'guiExitAnki', undefined, null> // Returns before it actually closes
	| Request<'guiImportFile', { path: string }, null>
	| Request<'guiSelectNote', { note: number }, boolean>
	| Request<'guiSelectNotes', undefined, number[]>
	| Request<'guiShowAnswer', undefined, boolean>
	| Request<'guiShowQuestion', undefined, boolean>
	| Request<'guiStartCardTimer', undefined, true> // Or null?
	| Request<'guiUndo', undefined, boolean> // Or null?
