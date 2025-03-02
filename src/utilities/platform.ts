/* eslint-disable node/no-unsupported-features/node-builtins */
/* eslint-disable unicorn/prefer-global-this */

export const ENVIRONMENT =
	typeof window === 'undefined' ? (typeof process === 'undefined' ? 'other' : 'node') : 'browser'

export const PLATFORM =
	ENVIRONMENT === 'browser'
		? /windows/i.test(navigator.userAgent)
			? 'windows'
			: /mac/i.test(navigator.userAgent)
				? 'mac'
				: 'other'
		: ENVIRONMENT === 'node'
			? process.platform === 'win32'
				? 'windows'
				: process.platform === 'darwin'
					? 'mac'
					: 'other'
			: 'other'
