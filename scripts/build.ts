import esbuild from 'esbuild'

await esbuild.build({
	bundle: true,
	entryPoints: ['src/index.ts'],
	format: 'esm',
	minify: true,
	outfile: 'dist/index.js',
	platform: 'node',
	target: 'node18',
})
