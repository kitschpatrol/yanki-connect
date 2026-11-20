import { eslintConfig } from '@kitschpatrol/eslint-config'

export default eslintConfig(
	{
		ts: {
			overrides: {
				'depend/ban-dependencies': [
					'error',
					{
						allowed: ['execa'],
					},
				],
				'ts/naming-convention': [
					'error',
					{
						format: ['UPPER_CASE'],
						modifiers: ['const', 'exported'],
						selector: 'variable',
						// Not objects...
						types: ['boolean', 'string', 'number', 'array'],
					},
				],
			},
		},
		type: 'lib',
	},
	{
		files: ['src/**/*.ts'],
		rules: {
			// Array#toSorted is unavailable in the Chrome 100 and Firefox 110 build targets.
			'unicorn/no-array-sort': 'off',
		},
	},
	{
		files: ['src/client.ts'],
		rules: {
			'jsdoc/check-tag-names': [
				'error',
				{ definedTags: ['public', 'maximumAnkiConnect', 'minimumAnki', 'minimumAnkiConnect'] },
			],
		},
	},
)
