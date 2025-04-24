import type { Type } from 'ts-morph'
import { Project } from 'ts-morph'

/**
 * Generate a tree structure of methods for the YankiConnect client
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
	const methodTree: Record<string, string[]> = {}

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
		const methods = extractMethodsFromType(propertyType)

		// Add to the tree
		if (methods.length > 0) {
			methodTree[propertyName] = methods
		}
	}

	return methodTree
}

/**
 * Extract method names from a type
 * @param type The TypeScript type
 * @returns Array of method names
 */
function extractMethodsFromType(type: Type): string[] {
	const methods: string[] = []

	try {
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
			const propertyType = property.getDeclarations()[0]?.getType()

			if (propertyType.getCallSignatures().length > 0) {
				methods.push(propertyName)
			}
		}
	} catch {}

	return methods.sort()
}

/**
 * Main function to generate and return the method tree
 */
export function getYankiConnectMethodTree(): Record<string, string[]> {
	try {
		return generateMethodTree()
	} catch (error) {
		console.error('Error generating method tree:', error)
		throw error
	}
}
