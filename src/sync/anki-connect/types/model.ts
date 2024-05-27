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
			{ description: string; fieldName: string; modelName: string },
			boolean
	  > // Only ancient versions return false
	| Request<
			'modelFieldFonts',
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
			{ modelName: string; newFieldName: string; oldFieldName: string },
			null
	  >
	| Request<
			'modelFieldSetDescription',
			{ fieldName: string; index: number; modelName: string },
			null
	  >
	| Request<
			'modelFieldSetFontSize',
			{ fieldName: string; fontSize: number; modelName: string },
			null
	  >
	| Request<
			'modelTemplateAdd',
			{
				modelName: string
				template: {
					Back: string
					Front: string
					Name: string
				}
			},
			null
	  >
	| Request<
			'modelTemplateRemove',
			{
				modelName: string
				templateName: string
			},
			null
	  >
	| Request<
			'modelTemplateRename',
			{ modelName: string; newTemplateName: string; oldTemplateName: string },
			null
	  >
	| Request<
			'modelTemplateReposition',
			{ index: number; modelName: string; templateName: string },
			null
	  >
	| Request<
			'modelTemplates',
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
			{
				model: {
					css: string
					name: string
				}
			},
			null
	  >
	| Request<
			'updateModelTemplates',
			{
				model: {
					name: string
					templates: Record<string, { Back?: string; Front?: string }>
				}
			},
			null
	  >
	| Request<'findModelsById', { modelNames: string[] }, Model[]>
	| Request<'findModelsByName', { modelIds: number[] }, Model[]>
	| Request<'modelFieldAdd', { fieldName: string; index: number; modelName: string }, null>
	| Request<'modelFieldNames', { modelName: string }, string[]>
	| Request<'modelFieldRemove', { fieldName: string; modelName: string }, null>
	| Request<'modelFieldReposition', { fieldName: string; index: number; modelName: string }, null>
	| Request<'modelFieldSetFont', { fieldName: string; font: string; modelName: string }, null>
	| Request<'modelFieldsOnTemplates', { modelName: string }, Record<string, [string[], string[]]>> // Note tuple
	| Request<'modelNames', undefined, string[]>
	| Request<'modelNamesAndIds', undefined, Record<string, number>>
	| Request<'modelStyling', { modelName: string }, { css: string }>
