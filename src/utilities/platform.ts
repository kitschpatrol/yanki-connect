/* eslint-disable node/no-unsupported-features/node-builtins */
/* eslint-disable require-unicode-regexp -- The `v` flag cannot be transpiled and throws at import time in the Chrome 100 and Firefox 110 build targets */

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
