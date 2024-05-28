import sharedConfig from '@kitschpatrol/prettier-config'

/** @type {import("prettier").Config} */
const localConfig = {
	// Config overrides
	overrides: [
		...sharedConfig.overrides,
		{
			files: 'src/sync/anki-connect/types/*.ts',
			options: {
				printWidth: 120,
			},
			// Per-file overrides overrides
		},
	],
}
export default {
	...sharedConfig,
	...localConfig,
}
