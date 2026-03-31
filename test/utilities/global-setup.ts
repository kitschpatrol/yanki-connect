import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { closeAnki, openAnki } from './anki-process'

let ankiBasePath: string | undefined

/**
 * Ensure Anki is running before tests run, using the preconfigured fixture.
 */
export async function setup() {
	await closeAnki()

	await new Promise((resolve) => {
		setTimeout(resolve, 1000)
	})

	// Copy the fixture to a temp directory so Anki's writes don't mutate it
	ankiBasePath = await fs.mkdtemp(path.join(os.tmpdir(), 'yanki-connect-test-'))
	// eslint-disable-next-line node/no-unsupported-features/node-builtins
	await fs.cp(path.resolve('test/fixtures/anki-data-folder'), ankiBasePath, { recursive: true })

	await new Promise((resolve) => {
		setTimeout(resolve, 1000)
	})

	await openAnki(ankiBasePath)
}

/**
 * Clean up.
 */
export async function teardown() {
	await closeAnki()

	if (ankiBasePath) {
		await fs.rm(ankiBasePath, { force: true, recursive: true })
	}
}
