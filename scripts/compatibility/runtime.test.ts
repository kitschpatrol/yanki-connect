import { expect, it } from 'vitest'
import type { AnkiRelease, GuiDiagnosticOptions } from './shared.ts'
import { prepareAnkiRuntime } from './runtime.ts'

function bundle(version: string): AnkiRelease {
	return { source: 'github', url: `https://example.test/anki-${version}-linux.tar.bz2`, version }
}

it.each(['2.1.15', '2.1.30', '2.1.44', '2.1.45', '2.1.46', '2.1.47', '2.1.48', '2.1.49'])(
	'disables the broken bundled sandbox for Anki %s without changing the parent environment',
	(version) => {
		const parent = Object.freeze({ QTWEBENGINE_DISABLE_SANDBOX: '0', DISPLAY: ':99' })
		const runtime = prepareAnkiRuntime(bundle(version), parent)
		expect(runtime.environment).toEqual({ QTWEBENGINE_DISABLE_SANDBOX: '1', DISPLAY: ':99' })
		expect(runtime.notes).toEqual([expect.stringContaining('QTWEBENGINE_DISABLE_SANDBOX=1')])
		expect(parent.QTWEBENGINE_DISABLE_SANDBOX).toBe('0')
	},
)

it.each(['2.1.9', '2.1.14', '2.1.50', '24.06.1'])(
	'keeps the existing sandbox environment outside the affected bundle range: %s',
	(version) => {
		const runtime = prepareAnkiRuntime(bundle(version), { DISPLAY: ':99' })
		expect(runtime.environment).toEqual({ DISPLAY: ':99' })
		expect(runtime.notes).toEqual([])
	},
)

it.each(['2.1.15', '2.1.44', '2.1.49'])(
	'does not apply the bundle workaround to PyPI Anki %s',
	(version) => {
		const runtime = prepareAnkiRuntime(
			{ source: 'pypi', spec: `aqt[qt]==${version}`, version },
			{ DISPLAY: ':99' },
		)
		expect(runtime.environment).toEqual({ DISPLAY: ':99' })
		expect(runtime.notes).toEqual([])
	},
)

it('removes the host Python overrides only from bundled releases', () => {
	const parent = Object.freeze({
		DISPLAY: ':99',
		LD_LIBRARY_PATH: '/host/lib',
		PYTHONHOME: '/host/python',
		PYTHONPATH: '/host/python/lib',
	})
	const bundled = prepareAnkiRuntime(bundle('2.1.50'), parent)
	expect(bundled.environment).toEqual({ DISPLAY: ':99' })
	const pypi = prepareAnkiRuntime(
		{ source: 'pypi', spec: 'aqt[qt]==2.1.49', version: '2.1.49' },
		parent,
	)
	expect(pypi.environment).toEqual(parent)
	expect(pypi.notes).toEqual([])
})

it.each([
	{ coreDirectory: '/tmp/cores', focus: 'enabled', sandbox: 'enabled' },
	{ coreDirectory: '/tmp/cores', focus: 'enabled', sandbox: 'disabled' },
	{ coreDirectory: '/tmp/cores', focus: 'disabled' },
] satisfies GuiDiagnosticOptions[])(
	'does not apply survey workarounds to diagnostics with focus $focus and sandbox $sandbox',
	(diagnostic) => {
		for (const version of ['2.1.15', '2.1.44', '2.1.49']) {
			const runtime = prepareAnkiRuntime(bundle(version), { DISPLAY: ':99' }, diagnostic)
			expect(runtime.environment).toEqual({ DISPLAY: ':99' })
			expect(runtime.notes).toEqual([])
		}
	},
)
// cspell:ignore PYTHONHOME
