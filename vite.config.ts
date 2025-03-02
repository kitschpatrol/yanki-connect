// eslint-disable-next-line ts/triple-slash-reference
/// <reference types="vitest" />
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
	},
})
