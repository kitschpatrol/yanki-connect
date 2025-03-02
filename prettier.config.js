import { prettierConfig } from '@kitschpatrol/prettier-config'

export default prettierConfig({
	overrides: [
		{
			files: 'src/sync/anki-connect/types/*.ts',
			options: {
				printWidth: 120,
			},
		},
	],
})
