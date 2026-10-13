import type { PropertyAssignment, Type } from 'ts-morph'
import { Node, Project, SyntaxKind } from 'ts-morph'

type YankiConnectAction = {
	minimumAnki: string
	minimumAnkiConnect: string
	name: string
}

const VERSION = /^\d+(?:\.\d+){2,3}$/v

/**
 * Generate a tree structure of methods for the YankiConnect client
 *
 * @returns A hierarchical JSON object with all YankiConnect methods
 */
function generateMethodTree() {
	// Initialize the project
	const project = new Project({
		tsConfigFilePath: 'tsconfig.json',
	})

	// Find the client file
	const sourceFile = project.getSourceFile('src/client.ts')
	if (!sourceFile) {
		throw new Error('Could not find client.ts file')
	}

	// Get the YankiConnect class
	const yankiConnectClass = sourceFile.getClasses().find((c) => c.getName() === 'YankiConnect')
	if (!yankiConnectClass) {
		throw new Error('Could not find YankiConnect class')
	}

	// Get the properties (card, deck, etc.)
	const properties = yankiConnectClass.getProperties()

	// Initialize the tree structure
	const methodTree: Record<string, YankiConnectAction[]> = {}

	// Process each main property of YankiConnect class
	for (const property of properties) {
		const propertyName = property.getName()

		if (['autoLaunch', 'host', 'port', 'version'].includes(propertyName)) {
			continue
		}

		// Skip internal properties
		if (propertyName.startsWith('_')) {
			continue
		}

		// Get the property type
		const propertyType = property.getType()

		// Get methods from the type
		const methods = extractMethodsFromType(propertyType, propertyName)

		// Add to the tree
		if (methods.length > 0) {
			methodTree[propertyName] = methods
		}
	}

	return methodTree
}

/**
 * Read a required minimum-version tag from an action's JSDoc.
 */
function getMinimumVersion(
	declaration: PropertyAssignment,
	tagName: 'minimumAnki' | 'minimumAnkiConnect',
	actionName: string,
): string {
	const tags = declaration
		.getChildrenOfKind(SyntaxKind.JSDoc)
		.flatMap((documentation) => documentation.getTags())
		.filter((tag) => tag.getTagName() === tagName)
	const version = tags.at(0)?.getCommentText()?.trim()
	if (version === undefined || tags.length !== 1 || !VERSION.test(version)) {
		throw new Error(`${actionName} must have exactly one @${tagName} tag with a numeric version`)
	}

	return version
}

/**
 * Extract methods and minimum versions from a type's declarations.
 *
 * @param type The TypeScript type
 *
 * @returns Array of methods and their minimum versions
 */
function extractMethodsFromType(type: Type, group: string): YankiConnectAction[] {
	const methods: YankiConnectAction[] = []

	// Get all properties of the type
	const properties = type.getProperties()

	// Check each property to see if it's a method
	for (const property of properties) {
		const propertyName = property.getName()

		// Skip internal methods
		if (propertyName.startsWith('_')) {
			continue
		}

		// Check if this property is a method (has call signatures)
		const declaration = property.getDeclarations()[0]
		const propertyType = declaration?.getType()

		if (propertyType === undefined || propertyType.getCallSignatures().length === 0) {
			continue
		}

		const actionName = `client.${group}.${propertyName}`
		if (declaration === undefined || !Node.isPropertyAssignment(declaration)) {
			throw new Error(`${actionName} must be declared as a documented property assignment`)
		}

		methods.push({
			minimumAnki: getMinimumVersion(declaration, 'minimumAnki', actionName),
			minimumAnkiConnect: getMinimumVersion(declaration, 'minimumAnkiConnect', actionName),
			name: propertyName,
		})
	}

	return methods.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Main function to generate and return the method tree
 */
export function getYankiConnectMethodTree(): Record<string, YankiConnectAction[]> {
	try {
		return generateMethodTree()
	} catch (error) {
		console.error('Error generating method tree:', error)
		throw error
	}
}
