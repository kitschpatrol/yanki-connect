import { defineConfig } from 'tsdown'

export default defineConfig([
	{
		attw: {
			profile: 'esm-only',
		},
		fixedExtension: false,
		minify: true,
		platform: 'neutral',
		target: ['node18.15.0', 'chrome100', 'safari18', 'firefox110'],
		tsconfig: 'tsconfig.build.json',
	},
])
