import type { AnkiRelease, GuiDiagnosticOptions } from './shared.ts'
import { compareVersions } from './shared.ts'

const PYTHON_VARIABLES = new Set(['LD_LIBRARY_PATH', 'PYTHONHOME', 'PYTHONPATH'])

/** Prepare only the disposable Linux Anki process environment. */
export function prepareAnkiRuntime(
	release: AnkiRelease,
	parentEnvironment: NodeJS.ProcessEnv,
	diagnostic?: GuiDiagnosticOptions,
): { environment: NodeJS.ProcessEnv; notes: string[] } {
	// Bundles ship their own Python; the Python used for pip installs must not leak into them.
	const environment: NodeJS.ProcessEnv = Object.fromEntries(
		Object.entries(parentEnvironment).filter(
			([name]) => release.source !== 'github' || !PYTHON_VARIABLES.has(name),
		),
	)
	const notes: string[] = []
	if (
		diagnostic === undefined &&
		release.source === 'github' &&
		compareVersions(release.version, '2.1.15') >= 0 &&
		compareVersions(release.version, '2.1.50') < 0
	) {
		// These bundled renderers reject glibc's clone3 syscall on Ubuntu 24.04.
		// Keep diagnostics independent so the sandbox-enabled control still reproduces it.
		// https://github.com/kitschpatrol/yanki-connect/actions/runs/44019866641
		// https://github.com/kitschpatrol/yanki-connect/actions/runs/44119199188
		environment.QTWEBENGINE_DISABLE_SANDBOX = '1'
		notes.push(
			'QTWEBENGINE_DISABLE_SANDBOX=1: legacy QtWebEngine sandbox workaround for clone3 crashes on Ubuntu 24.04.',
		)
	}

	return { environment, notes }
}
// cspell:ignore PYTHONHOME
