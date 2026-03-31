import { eslintConfig } from '@kitschpatrol/eslint-config'

export default eslintConfig(
	{
		ignores: ['test/fixtures/anki-data-folder/**/*'],
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
				// Support minimum version 1.5.0 of Obsidian
				'unicorn/no-array-sort': 'off',
			},
		},
	},
	{
		files: ['readme.md/**/*.ts'],
		rules: {
			'import/no-unresolved': ['error', { ignore: ['vite', '^https?://.+'] }],
		},
	},
)
