import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		coverage: {
			include: ['src/**/*.ts'],
			provider: 'v8',
		},
		isolate: false,
		maxWorkers: 1,
		pool: 'forks',
		// Define separate projects for browser and node tests
		projects: [
			{
				// Browser project
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
						provider: playwright(),
						screenshotFailures: false,
					},
					exclude: ['test/**/*.node.test.ts'],
					include: ['test/**/*.test.ts'],
					name: 'browser',
				},
			},
			{
				// Node project
				test: {
					environment: 'node',
					exclude: ['test/**/*.browser.test.ts'],
					include: ['test/**/*.test.ts'],
					name: 'node',
				},
			},
		],
		silent: 'passed-only', // Suppress console output during tests
	},
})
