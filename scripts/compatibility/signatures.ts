import type { DiagnosticMessageChain } from 'ts-morph'
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

function flattenMessage(message: DiagnosticMessageChain | string): string {
	if (typeof message === 'string') {
		return message
	}

	const next = message.getNext() ?? []
	return [message.getMessageText(), ...next.map((chain) => flattenMessage(chain))].join(' ')
}

/**
 * Type-check captured results against the client's declared `ResultForAction`
 * types. Returns the first compiler diagnostic for each record that fails.
 */
export function checkSignatures(records: ProbeRecord[]): Map<number, string> {
	const header = [`import type { ResultForAction } from '../../src/types/shared'`, '']
	const lines = [...header]
	for (const [index, record] of records.entries()) {
		lines.push(
			`declare const result${String(index)}: ${typeLiteral(record.result)}`,
			`export const check${String(index)}: ResultForAction<'${record.action}'> = result${String(index)}`,
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

	const failures = new Map<number, string>()
	for (const diagnostic of sourceFile.getPreEmitDiagnostics()) {
		const line = diagnostic.getLineNumber()
		if (line === undefined) {
			continue
		}

		const index = Math.floor((line - 1 - header.length) / 2)
		if (!failures.has(index)) {
			failures.set(index, flattenMessage(diagnostic.getMessageText()))
		}
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
