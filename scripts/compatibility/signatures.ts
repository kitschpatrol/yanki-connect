import type { DiagnosticMessageChain, Node, Type, TypeChecker } from 'ts-morph'
import { Project } from 'ts-morph'
import type { ActionOutcome } from './shared.ts'
import { truncate } from './shared.ts'

/** A successful AnkiConnect response captured while probing. */
export type ProbeRecord = {
	action: string
	result: unknown
}

/**
 * Arrays longer than this become `Array<union>` rather than tuple types, to
 * stay clear of the compiler's tuple length limit.
 */
const TUPLE_LIMIT = 64

/**
 * Render a JSON value as the narrowest TypeScript type literal describing it,
 * so the compiler can decide whether the value is assignable to a declared
 * result type.
 */
function typeLiteral(value: unknown): string {
	if (value === null) {
		return 'null'
	}

	if (typeof value === 'boolean' || typeof value === 'number') {
		return String(value)
	}

	if (typeof value === 'string') {
		return JSON.stringify(value)
	}

	if (Array.isArray(value)) {
		const elements = value.map((element) => typeLiteral(element))
		return elements.length <= TUPLE_LIMIT
			? `[${elements.join(', ')}]`
			: `Array<${[...new Set(elements)].join(' | ')}>`
	}

	if (typeof value === 'object') {
		const members = Object.entries(value).map(
			([key, member]) => `${JSON.stringify(key)}: ${typeLiteral(member)}`,
		)
		return `{ ${members.join('; ')} }`
	}

	throw new TypeError(`Cannot describe ${typeof value} as a type`)
}

/**
 * Flatten a diagnostic chain with the most specific message first, since the
 * outer messages quote whole types.
 */
function flattenMessage(message: DiagnosticMessageChain | string): string {
	if (typeof message === 'string') {
		return message
	}

	const messages: string[] = []
	let chains: DiagnosticMessageChain[] = [message]
	while (chains.length > 0) {
		messages.push(...chains.map((chain) => chain.getMessageText()))
		chains = chains.flatMap((chain) => chain.getNext() ?? [])
	}

	return messages.toReversed().join(' ')
}

const DEPTH_LIMIT = 4

function describeType(type: Type): string {
	return truncate(type.getText(), 80)
}

function problemCount(explanation: string): number {
	return explanation.split('; ').length
}

function explainObject(
	checker: TypeChecker,
	value: Type,
	declared: Type,
	node: Node,
	depth: number,
): string | undefined {
	const problems: string[] = []
	for (const property of declared.getProperties()) {
		const name = property.getName()
		const actual = value.getProperty(name)
		if (actual === undefined) {
			if (!property.isOptional()) {
				problems.push(`missing ${name}`)
			}

			continue
		}

		const why = explain(
			checker,
			actual.getTypeAtLocation(node),
			property.getTypeAtLocation(node),
			node,
			depth + 1,
		)
		if (why !== undefined) {
			problems.push(`${name}: ${why}`)
		}
	}

	const indexType = declared.getStringIndexType()
	if (indexType !== undefined) {
		for (const actual of value.getProperties()) {
			if (declared.getProperty(actual.getName()) !== undefined) {
				continue
			}

			const why = explain(checker, actual.getTypeAtLocation(node), indexType, node, depth + 1)
			if (why !== undefined) {
				problems.push(`${actual.getName()}: ${why}`)
			}
		}
	}

	return problems.length > 0 ? problems.join('; ') : undefined
}

/**
 * Explain why a value's type is not assignable to the declared type in terms of
 * missing and mismatched properties, which is more useful than the compiler's
 * own message once unions or long type literals are involved.
 */
function explain(
	checker: TypeChecker,
	value: Type,
	declared: Type,
	node: Node,
	depth: number,
): string | undefined {
	if (checker.isTypeAssignableTo(value, declared)) {
		return undefined
	}

	const fallback = `${describeType(value)} is not assignable to ${describeType(declared)}`
	if (depth > DEPTH_LIMIT || declared.isBoolean()) {
		return fallback
	}

	if (declared.isUnion()) {
		const explanations = declared
			.getUnionTypes()
			.map((member) => explain(checker, value, member, node, depth))
			.filter((explanation) => explanation !== undefined)
		return explanations.toSorted((a, b) => {
			const difference = problemCount(a) - problemCount(b)
			return difference === 0 ? a.length - b.length : difference
		})[0]
	}

	if (declared.isTuple() || declared.isArray()) {
		const expected = declared.isTuple()
			? declared.getTupleElements()
			: [declared.getArrayElementType()].filter((element) => element !== undefined)
		const actual = value.isTuple()
			? value.getTupleElements()
			: [value.getArrayElementType()].filter((element) => element !== undefined)
		if (declared.isTuple() && actual.length !== expected.length) {
			return `${String(actual.length)} elements where ${String(expected.length)} are declared`
		}

		for (const [index, element] of actual.entries()) {
			const target = declared.isTuple() ? expected[index] : expected[0]
			const why =
				target === undefined ? undefined : explain(checker, element, target, node, depth + 1)
			if (why !== undefined) {
				return `[${String(index)}]: ${why}`
			}
		}

		return fallback
	}

	return declared.isObject() && value.isObject()
		? (explainObject(checker, value, declared, node, depth) ?? fallback)
		: fallback
}

/**
 * Type-check captured results against the client's declared `ResultForAction`
 * types. Returns an explanation for each record that fails.
 */
export function checkSignatures(records: ProbeRecord[]): Map<number, string> {
	const header = [`import type { ResultForAction } from '../../src/types/shared'`, '']
	const lines = [...header]
	for (const [index, record] of records.entries()) {
		lines.push(
			`declare const result${String(index)}: ${typeLiteral(record.result)}`,
			`type Declared${String(index)} = ResultForAction<'${record.action}'>`,
			`export const check${String(index)}: Declared${String(index)} = result${String(index)}`,
		)
	}

	const project = new Project({
		skipAddingFilesFromTsConfig: true,
		tsConfigFilePath: 'tsconfig.json',
	})
	const sourceFile = project.createSourceFile(
		'scripts/compatibility/signature-check.generated.ts',
		lines.join('\n'),
	)
	const checker = project.getTypeChecker()

	const failures = new Map<number, string>()
	for (const diagnostic of sourceFile.getPreEmitDiagnostics()) {
		const line = diagnostic.getLineNumber()
		if (line === undefined) {
			continue
		}

		const index = Math.floor((line - 1 - header.length) / 3)
		if (failures.has(index)) {
			continue
		}

		const node = sourceFile.getVariableDeclarationOrThrow(`result${String(index)}`)
		const declared = sourceFile.getTypeAliasOrThrow(`Declared${String(index)}`).getType()
		failures.set(
			index,
			explain(checker, node.getType(), declared, node, 0) ??
				flattenMessage(diagnostic.getMessageText()),
		)
	}

	return failures
}

/**
 * Downgrade `ok` outcomes whose responses did not match the declared result
 * type, and note mismatches on outcomes that already failed for other reasons.
 */
export function applySignatureChecks(
	outcomes: Record<string, ActionOutcome>,
	records: ProbeRecord[],
): Record<string, ActionOutcome> {
	const updated = { ...outcomes }
	for (const [index, message] of checkSignatures(records)) {
		const { action } = records[index]!
		const outcome = updated[action]
		if (outcome === undefined) {
			continue
		}

		const detail = truncate(`Response does not match declared type: ${message}`)
		updated[action] =
			outcome.status === 'ok'
				? { detail, status: 'signature' }
				: { ...outcome, detail: `${outcome.detail ?? ''} (${detail})` }
	}

	return updated
}
