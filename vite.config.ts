// eslint-disable-next-line ts/triple-slash-reference
/// <reference types="vitest" />
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
	// See vitest.workspace.ts for additional configuration
	test: {
		coverage: {
			all: false,
			include: ['src/**/*.ts'],
			provider: 'istanbul',
		},
		// Disable concurrent test execution across files out of an abundance of
		// caution
		maxConcurrency: 1,
		poolOptions: {
			forks: {
				singleFork: true,
			},
		},
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					browser: {
						// Conflicts between VS Code extension and vitest CLI command...
						api: {
							port: 5180,
							strictPort: true,
						},
						enabled: true,
						headless: true,
						instances: [{ browser: 'chromium' }],
						provider: 'playwright',
					},
					exclude: ['test/**/*.node.test.ts'],
					include: ['test/**/*.test.ts'],
					name: 'browser',
				},
			},
			{
				extends: './vite.config.ts',
				test: {
					environment: 'node',
					exclude: ['test/**/*.browser.test.ts'],
					include: ['test/**/*.test.ts'],
					name: 'node',
					root: path.resolve(path.dirname(fileURLToPath(import.meta.url))),
				},
			},
		],
	},
})
