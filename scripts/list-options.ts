import { Project, SyntaxKind } from 'ts-morph'

const PARAGRAPH_BREAK = /\n\s*\n/v

/**
 * Convert one JSDoc paragraph into HTML, unwrapping lines and turning `- `
 * bullets into a list.
 */
function paragraphToHtml(paragraph: string): string {
	const items: string[] = []
	for (const line of paragraph.split('\n')) {
		const trimmedLine = line.trim()
		if (trimmedLine.startsWith('- ') || items.length === 0) {
			items.push(trimmedLine)
		} else {
			items[items.length - 1] += ` ${trimmedLine}`
		}
	}

	return items.every((item) => item.startsWith('- '))
		? `<ul>${items.map((item) => `<li>${item.slice(2)}</li>`).join('')}</ul>`
		: items.join(' ')
}

/**
 * Convert a JSDoc description into HTML that renders inside a Markdown table
 * cell, preserving paragraphs and bullet lists.
 */
function descriptionToTableCell(description: string): string {
	let html = ''
	for (const paragraph of description.trim().split(PARAGRAPH_BREAK)) {
		const paragraphHtml = paragraphToHtml(paragraph)
		const isAdjacentToList = paragraphHtml.startsWith('<ul>') || html.endsWith('</ul>')
		html += html === '' || isAdjacentToList ? paragraphHtml : `<br><br>${paragraphHtml}`
	}

	return html.replaceAll('|', String.raw`\|`)
}

/**
 * Generate a Markdown table documenting each `YankiConnectOptions` property
 * from its type and JSDoc comment.
 */
export function getYankiConnectOptionsTable(): string {
	const project = new Project({
		tsConfigFilePath: 'tsconfig.json',
	})

	const optionsType = project
		.getSourceFileOrThrow('src/client.ts')
		.getTypeAliasOrThrow('YankiConnectOptions')

	const rows = optionsType
		.getTypeNodeOrThrow()
		.getChildrenOfKind(SyntaxKind.PropertySignature)
		.map((property) => {
			const name = property.getName()
			const documentation = property.getJsDocs().at(0)
			if (documentation === undefined) {
				throw new Error(`YankiConnectOptions.${name} is missing a JSDoc comment`)
			}

			const defaultValue = documentation
				.getTags()
				.find((tag) => tag.getTagName() === 'default')
				?.getCommentText()
				?.trim()
			if (defaultValue === undefined) {
				throw new Error(`YankiConnectOptions.${name} is missing a @default tag`)
			}

			const typeText = property
				.getTypeNodeOrThrow()
				.getText()
				.replaceAll('|', String.raw`\|`)
			const description = descriptionToTableCell(documentation.getDescription())

			return `| \`${name}\` | \`${typeText}\` | ${description} | \`${defaultValue}\` |`
		})

	return ['| Key | Type | Description | Default |', '| --- | --- | --- | --- |', ...rows].join('\n')
}
