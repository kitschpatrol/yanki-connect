import { execa } from 'execa'
import { fileURLToPath } from 'node:url'
import type { AnkiRelease } from './shared.ts'
import { compareVersions, formatAnkiVersion } from './shared.ts'

/** The oldest AnkiConnect tag whose actions are documented in the client. */
export const OLDEST_ANKI_CONNECT = '22.2.19.0'

/** From this Anki release on, Linux users install from PyPI via the launcher. */
const LAUNCHER_ERA = '25.07'

const STABLE_VERSION = /^\d+(?:\.\d+)+$/v
const ANKI_CONNECT_TAG = /^\d+\.\d+\.\d+\.\d+$/v

/** Linux bundle assets, in order of preference when a release offers several. */
const LINUX_ASSETS = [
	/-linux-qt6\.tar\.zst$/v,
	/-linux-x86_64\.tar\.zst$/v,
	/-linux\.tar\.bz2$/v,
	/-linux-amd64\.tar\.bz2$/v,
]

type GitHubRelease = {
	assets: Array<{ browser_download_url: string; name: string }>
	prerelease: boolean
	tag_name: string
}

async function fetchJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
	const response = await fetch(url, { headers })
	if (!response.ok) {
		throw new Error(`${url} responded with status ${String(response.status)}`)
	}

	return (await response.json()) as T
}

async function getGitHubReleases(): Promise<GitHubRelease[]> {
	const token = process.env.GITHUB_TOKEN
	const headers: Record<string, string> =
		token === undefined ? {} : { authorization: `Bearer ${token}` }
	const releases: GitHubRelease[] = []
	for (let page = 1; ; page++) {
		const batch = await fetchJson<GitHubRelease[]>(
			`https://api.github.com/repos/ankitects/anki/releases?per_page=100&page=${String(page)}`,
			headers,
		)
		releases.push(...batch)
		if (batch.length < 100) {
			return releases
		}
	}
}

function linuxAsset(release: GitHubRelease): string | undefined {
	for (const pattern of LINUX_ASSETS) {
		const asset = release.assets.find((candidate) => pattern.test(candidate.name))
		if (asset !== undefined) {
			return asset.browser_download_url
		}
	}

	return undefined
}

/**
 * Every stable Anki release with an official Linux build: GitHub release
 * bundles where they exist, and PyPI packages (what the Anki launcher installs)
 * for releases since the launcher replaced the bundles.
 */
export async function getAnkiReleases(): Promise<AnkiRelease[]> {
	const releases: AnkiRelease[] = []
	const gitHubReleases = await getGitHubReleases()
	for (const release of gitHubReleases) {
		const url = linuxAsset(release)
		if (url === undefined || release.prerelease || !STABLE_VERSION.test(release.tag_name)) {
			continue
		}

		releases.push({ source: 'github', url, version: release.tag_name })
	}

	const pypi = await fetchJson<{ releases: Record<string, unknown[]> }>(
		'https://pypi.org/pypi/aqt/json',
	)
	for (const [pypiVersion, files] of Object.entries(pypi.releases)) {
		const version = formatAnkiVersion(pypiVersion)
		if (
			files.length === 0 ||
			!STABLE_VERSION.test(pypiVersion) ||
			compareVersions(version, LAUNCHER_ERA) < 0 ||
			releases.some((release) => compareVersions(release.version, version) === 0)
		) {
			continue
		}

		releases.push({ source: 'pypi', spec: `aqt[qt]==${pypiVersion}`, version })
	}

	return releases.sort((a, b) => compareVersions(a.version, b.version))
}

/** Every AnkiConnect release tag from the oldest documented tag onward. */
export async function getAnkiConnectVersions(): Promise<string[]> {
	const { stdout } = await execa('git', [
		'ls-remote',
		'--tags',
		'https://git.sr.ht/~foosoft/anki-connect',
	])
	return stdout
		.split('\n')
		.map((line) => line.split('refs/tags/', 2).at(1) ?? '')
		.filter((tag) => ANKI_CONNECT_TAG.test(tag) && compareVersions(tag, OLDEST_ANKI_CONNECT) >= 0)
		.sort(compareVersions)
}

/**
 * Restrict versions to a comma-separated selection, failing on unknown entries
 * so that typos in a workflow input surface immediately.
 */
export function selectVersions<T>(items: T[], version: (item: T) => string, selection = ''): T[] {
	const requested = selection
		.split(',')
		.map((entry) => entry.trim())
		.filter((entry) => entry !== '')
	if (requested.length === 0) {
		return items
	}

	const available = items.map((item) => version(item))
	const unknown = requested.filter((entry) => !available.includes(entry))
	if (unknown.length > 0) {
		throw new Error(`Unknown version(s) ${unknown.join(', ')}. Available: ${available.join(', ')}`)
	}

	return items.filter((item) => requested.includes(version(item)))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const anki = selectVersions(
		await getAnkiReleases(),
		(release) => release.version,
		process.env.ANKI_VERSIONS,
	)
	const ankiConnect = selectVersions(
		await getAnkiConnectVersions(),
		(tag) => tag,
		process.env.ANKI_CONNECT_VERSIONS,
	)
	console.log(`anki=${JSON.stringify(anki)}`)
	console.log(`anki-connect=${JSON.stringify(ankiConnect)}`)
}
