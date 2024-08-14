// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference types="vitest" />
import { name } from './package.json'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), name))

export default defineConfig({
	build: {
		outDir: tempDirectory,
		rollupOptions: {
			external: ['open'],
			// ShimMissingExports: true,
		},
		target: 'esnext',
	},
	root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'test-browser'),
	server: {
		open: true,
	},
	test: {
		root: path.resolve(path.dirname(fileURLToPath(import.meta.url))),
		// Enable serial mode
		sequence: {
			concurrent: false,
		},
	},
})
