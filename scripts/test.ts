import { execa } from 'execa'
import { getAnkiConnectVersions } from '../test/utilities/anki-connect-versions.ts'

const arguments_ = process.argv.slice(2)
const projects = arguments_.some(
	(argument) => argument === '--project' || argument.startsWith('--project='),
)
	? [undefined]
	: ['browser', 'node']

// GUI and collection state are shared, so isolate both versions and environments.
for (const version of getAnkiConnectVersions()) {
	for (const project of projects) {
		console.log(`Testing AnkiConnect ${version}${project === undefined ? '' : ` (${project})`}`)
		const result = await execa(
			'vitest',
			['run', ...arguments_, ...(project === undefined ? [] : ['--project', project])],
			{
				env: { ANKI_CONNECT_VERSION: version },
				preferLocal: true,
				reject: false,
				stdio: 'inherit',
			},
		)
		if (result.failed) {
			process.exitCode = 1
		}
	}
}
