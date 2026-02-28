import { defineConfig } from 'tsdown'

export default defineConfig([
	// For bundlers
	{
		dts: true,
		fixedExtension: false,
		minify: false,
		platform: 'neutral',
		target: ['node20.11.0', 'chrome100', 'safari18', 'firefox110'],
		tsconfig: 'tsconfig.build.json',
	},
	// Standalone build for CDNs
	{
		dts: true,
		fixedExtension: false,
		minify: true,
		outDir: 'dist/standalone',
		platform: 'browser',
		target: ['chrome100', 'safari18', 'firefox110'],
		tsconfig: 'tsconfig.build.json',
	},
])
