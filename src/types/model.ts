/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/ban-types */

import { type Request } from './shared'

export type ModelField = {
	collapsed: boolean
	description: string
	excludeFromSearch: boolean
	font: string
	id: number
	name: string
	ord: number
	plainText: boolean
	preventDeletion: boolean
	rtl: boolean
	size: number
	sticky: boolean
	tag: null // Always?
}

export type ModelTemplate = {
	afmt: string
	bafmt: string
	bfont: string
	bqfmt: string
	bsize: number
	did: null // Always?
	id: number
	name: string
	ord: number
	qfmt: string
}

export type Model = {
	css: string
	did: null // Always?
	flds: ModelField[]
	id: number
	latexPost: string
	latexPre: string
	latexsvg: boolean
	mod: number
	name: string
	originalStockKind: number
	req: Array<[number, string, number[]]> // Hmm?
	sortf: number
	tmpls: ModelTemplate[]
	type: number
	usn: number
}

export type ModelRequests =
	| Request<
			'createModel',
			6,
			{
				cardTemplates: Array<{
					Back: string
					Front: string
					Name?: string // Default is 'Card 1', 'Card 2', etc.
				}>
				css?: string
				inOrderFields: string[]
				isCloze?: boolean
				modelName: string
			},
			Model
	  >
	| Request<
			'findAndReplaceInModels',
			6,
			{
				model: {
					back: boolean
					css: boolean
					fieldText: string
					front: boolean
					modelName: string
					replaceText: string
				}
			},
			number
	  >
	| Request<
			'modelFieldDescriptions',
			6,
			{ description: string; fieldName: string; modelName: string },
			boolean
	  > // Only ancient versions return false
	| Request<
			'modelFieldFonts',
			6,
			{ modelName: string },
			Record<
				string,
				{
					font: string
					size: number
				}
			>
	  >
	| Request<
			'modelFieldRename',
			6,
			{ modelName: string; newFieldName: string; oldFieldName: string }
	  >
	| Request<
			'modelFieldsOnTemplates',
			6,
			{ modelName: string },
			Record<string, [string[], string[]]>
	  > // Note tuple
	| Request<
			'modelTemplateAdd',
			6,
			{
				modelName: string
				template: {
					Back: string
					Front: string
					Name: string
				}
			}
	  >
	| Request<
			'modelTemplateRemove',
			6,
			{
				modelName: string
				templateName: string
			}
	  >
	| Request<
			'modelTemplateRename',
			6,
			{ modelName: string; newTemplateName: string; oldTemplateName: string }
	  >
	| Request<
			'modelTemplateReposition',
			6,
			{ index: number; modelName: string; templateName: string }
	  >
	| Request<
			'modelTemplates',
			6,
			{ modelName: string },
			Record<
				string,
				{
					// More fields?
					Back: string
					Front: string
				}
			>
	  >
	| Request<
			'updateModelStyling',
			6,
			{
				model: {
					css: string
					name: string
				}
			}
	  >
	| Request<
			'updateModelTemplates',
			6,
			{
				model: {
					name: string
					templates: Record<string, { Back?: string; Front?: string }>
				}
			}
	  >
	| Request<'findModelsById', 6, { modelNames: string[] }, Model[]>
	| Request<'findModelsByName', 6, { modelIds: number[] }, Model[]>
	| Request<'modelFieldAdd', 6, { fieldName: string; index: number; modelName: string }>
	| Request<'modelFieldNames', 6, { modelName: string }, string[]>
	| Request<'modelFieldRemove', 6, { fieldName: string; modelName: string }>
	| Request<'modelFieldReposition', 6, { fieldName: string; index: number; modelName: string }>
	| Request<'modelFieldSetDescription', 6, { fieldName: string; index: number; modelName: string }>
	| Request<'modelFieldSetFont', 6, { fieldName: string; font: string; modelName: string }>
	| Request<'modelFieldSetFontSize', 6, { fieldName: string; fontSize: number; modelName: string }>
	| Request<'modelNames', 6, never, string[]>
	| Request<'modelNamesAndIds', 6, never, Record<string, number>>
	| Request<'modelStyling', 6, { modelName: string }, { css: string }>
