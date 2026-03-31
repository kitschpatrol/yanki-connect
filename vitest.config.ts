import { playwright } from '@vitest/browser-playwright'
import os from 'node:os'
import { defineConfig } from 'vitest/config'

const isCI = Boolean(process.env.CI)
const isWindows = os.platform() === 'win32'
const isSlow = isCI || isWindows

export default defineConfig({
	test: {
		coverage: {
			include: ['src/**/*.ts'],
			provider: 'v8',
		},
		globalSetup: './test/utilities/global-setup.ts',
		isolate: false,
		maxWorkers: 1,
		pool: 'forks',
		projects: [
			// Browser project
			{
				test: {
					browser: {
						// Conflicts between VS Code extension and vitest CLI command...
						api: {
							port: 5180,
							strictPort: true,
						},
						enabled: true,
						headless: true,
						instances: [{ browser: 'chromium' as const }],
						provider: playwright(),
						screenshotFailures: false,
					},
					exclude: ['test/**/*.node.test.ts'],
					include: ['test/**/*.test.ts'],
					name: 'browser',
					testTimeout: isSlow ? 30_000 : 5000,
				},
			},
			// Node project
			{
				test: {
					environment: 'node',
					exclude: ['test/**/*.browser.test.ts'],
					include: ['test/**/*.test.ts'],
					name: 'node',
					testTimeout: isSlow ? 30_000 : 5000,
				},
			},
		],
		silent: 'passed-only',
	},
})
