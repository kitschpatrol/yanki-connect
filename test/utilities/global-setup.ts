import type { TestProject } from 'vitest/node'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getAnkiConnectVersions } from './anki-connect-versions'
import { closeAnki, openAnki } from './anki-process'

let ankiBasePath: string | undefined

declare module 'vitest' {
	// eslint-disable-next-line ts/consistent-type-definitions -- Vitest requires an interface for context augmentation.
	export interface ProvidedContext {
		ankiConnectVersion: string
		ankiVersion: string
	}
}

/**
 * Ensure Anki is running before tests run, using the preconfigured fixture.
 */
export async function setup(project: TestProject) {
	const version = getAnkiConnectVersions()[0]!
	const fixturePath = path.resolve(`test/fixtures/anki-data-folder-${version}`)
	await fs.access(fixturePath)

	await closeAnki()

	await new Promise((resolve) => {
		setTimeout(resolve, 1000)
	})

	// Copy the fixture to a temp directory so Anki's writes don't mutate it
	ankiBasePath = await fs.mkdtemp(path.join(os.tmpdir(), 'yanki-connect-test-'))
	// eslint-disable-next-line node/no-unsupported-features/node-builtins
	await fs.cp(fixturePath, ankiBasePath, { recursive: true })
	const dialogsAddonPath = path.join(ankiBasePath, 'addons21', 'yanki_e2e_dialogs')
	await fs.mkdir(dialogsAddonPath)
	await fs.copyFile('test/utilities/anki-dialogs.py', path.join(dialogsAddonPath, '__init__.py'))

	await new Promise((resolve) => {
		setTimeout(resolve, 1000)
	})

	await openAnki(ankiBasePath)
	project.provide('ankiConnectVersion', version)
	project.provide(
		'ankiVersion',
		await fs.readFile(path.join(dialogsAddonPath, 'anki-version.txt'), 'utf8'),
	)
}

/**
 * Clean up.
 */
export async function teardown() {
	await closeAnki()

	if (ankiBasePath !== undefined) {
		await fs.rm(ankiBasePath, { force: true, recursive: true })
	}
}
