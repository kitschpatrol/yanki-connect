// cspell:ignore shutil
import { execa } from 'execa'
import fs from 'node:fs/promises'
import path from 'node:path'
import { setTimeout } from 'node:timers/promises'
import type { AnkiRelease } from './shared.ts'

const DOWNLOAD_ATTEMPTS = 3
const DOWNLOAD_TIMEOUT = 180_000
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504])

class DownloadResponseError extends Error {
	retryable: boolean

	constructor(url: string, status: number) {
		super(`Download of ${url} failed with status ${String(status)}`)
		this.retryable = RETRYABLE_STATUS.has(status)
	}
}

function retryableDownload(error: unknown): boolean {
	return (
		(error instanceof DownloadResponseError && error.retryable) ||
		error instanceof TypeError ||
		(error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name))
	)
}

async function download(url: string, destination: string): Promise<void> {
	const partial = `${destination}.part`
	for (let attempt = 1; ; attempt++) {
		try {
			// The deadline includes receiving the body, not just the response headers.
			const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT) })
			if (!response.ok || response.body === null) {
				await response.body?.cancel()
				throw new DownloadResponseError(url, response.status)
			}

			await fs.writeFile(partial, response.body)
			await fs.rename(partial, destination)
			return
		} catch (error) {
			if (!retryableDownload(error)) {
				throw error
			}

			const message = error instanceof Error ? error.message : String(error)
			if (attempt === DOWNLOAD_ATTEMPTS) {
				throw new Error(`Download failed after ${String(attempt)} attempts: ${message}`, {
					cause: error,
				})
			}

			const delay = 5000 * attempt
			console.warn(
				`Download attempt ${String(attempt)} failed: ${message}. Retrying in ${String(delay / 1000)}s.`,
			)
			await setTimeout(delay)
		} finally {
			await fs.rm(partial, { force: true })
		}
	}
}

/**
 * Find the Anki executable in an extracted bundle. Bundles have placed it at
 * `bin/anki`, `bin/Anki`, and `anki` over the years, so search breadth-first
 * for the shallowest executable with that name.
 */
async function findExecutable(directory: string): Promise<string> {
	const queue = [directory]
	while (queue.length > 0) {
		const current = queue.shift()!
		const entries = await fs.readdir(current, { withFileTypes: true })
		for (const entry of entries) {
			const entryPath = path.join(current, entry.name)
			if (entry.isDirectory()) {
				queue.push(entryPath)
			} else if (entry.isFile() && entry.name.toLowerCase() === 'anki') {
				try {
					await fs.access(entryPath, fs.constants.X_OK)
					return entryPath
				} catch {
					// Not executable, keep looking
				}
			}
		}
	}

	throw new Error(`No anki executable found under ${directory}`)
}

/**
 * Install an Anki release on Linux and return the path of its executable.
 * GitHub releases are extracted from their official bundle; launcher-era
 * releases are installed from PyPI into the active Python environment.
 */
export async function installAnki(release: AnkiRelease, directory: string): Promise<string> {
	if (release.source === 'pypi') {
		await execa('python', ['-m', 'pip', 'install', '--quiet', release.spec], { stdio: 'inherit' })
		const { stdout } = await execa('python', [
			'-c',
			'import shutil; print(shutil.which("anki") or "")',
		])
		if (stdout.trim() === '') {
			throw new Error(`${release.spec} installed, but no anki executable is on the PATH`)
		}

		return stdout.trim()
	}

	await fs.mkdir(directory, { recursive: true })
	const archive = path.join(directory, path.basename(new URL(release.url).pathname))
	await download(release.url, archive)
	await execa('tar', ['-xf', archive, '-C', directory])
	await fs.rm(archive)
	return findExecutable(directory)
}
