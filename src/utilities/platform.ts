/* eslint-disable node/no-unsupported-features/node-builtins */

export const ENVIRONMENT =
	typeof window === 'undefined' ? (typeof process === 'undefined' ? 'other' : 'node') : 'browser'

export const PLATFORM =
	ENVIRONMENT === 'browser'
		? /windows/iv.test(navigator.userAgent)
			? 'windows'
			: /mac/iv.test(navigator.userAgent)
				? 'mac'
				: 'other'
		: ENVIRONMENT === 'node'
			? process.platform === 'win32'
				? 'windows'
				: process.platform === 'darwin'
					? 'mac'
					: 'other'
			: 'other'
