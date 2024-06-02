import esbuild from 'esbuild'

await esbuild.build({
	bundle: true,
	entryPoints: ['src/index.ts'],
	external: ['open'],
	format: 'esm',
	minify: true,
	outfile: 'dist/index.js',
	platform: 'neutral',
	target: 'es2020',
})
