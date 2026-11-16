import { execa } from 'execa'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const CORE_SIGNALS = new Set([
	'SIGABRT',
	'SIGBUS',
	'SIGFPE',
	'SIGILL',
	'SIGQUIT',
	'SIGSEGV',
	'SIGSYS',
	'SIGTRAP',
])
const CORE_FILE = /^core\.(\d+)\.(!.+)$/v

type NativeCrash = {
	coreBytes: number
	detail?: string
	executable: string
	pid: number
	status: 'captured' | 'failed'
	trace: string
}

type NativeCrashReport = {
	crashes: NativeCrash[]
	detail?: string
	status: 'captured' | 'failed' | 'missing' | 'not-crashed'
}

/** Analyze this attempt's core dumps before deleting its disposable profile. */
export async function captureNativeCrashes(
	coreDirectory: string,
	destination: string,
): Promise<NativeCrashReport> {
	const report: NativeCrashReport = { crashes: [], status: 'not-crashed' }
	const childProcess = JSON.parse(
		await fs.readFile(path.join(destination, 'process.json'), 'utf8'),
	) as {
		signal?: string
	}
	const files = await fs.readdir(coreDirectory)
	for (const file of files) {
		// Linux core_pattern is core.%p.%E; %E replaces executable path separators with !.
		const match = CORE_FILE.exec(file)
		if (match === null) {
			continue
		}

		const pid = Number(match[1])
		const executable = match[2]!.replaceAll('!', '/')
		const core = path.join(coreDirectory, file)
		const trace = `native-backtrace-${String(pid)}.log`
		const stat = await fs.stat(core)
		const crash: NativeCrash = {
			coreBytes: stat.size,
			executable,
			pid,
			status: 'failed',
			trace,
		}
		try {
			const result = await execa(
				'gdb',
				[
					'--batch',
					'--nx',
					'--quiet',
					'--init-eval-command',
					'set auto-load off',
					'--init-eval-command',
					'set debuginfod enabled off',
					'--se',
					executable,
					'--core',
					core,
					'--eval-command',
					'set print elements 100',
					'--eval-command',
					'info files',
					'--eval-command',
					'info sharedlibrary',
					'--eval-command',
					'info registers',
					'--eval-command',
					'thread apply all bt full 80',
					'--eval-command',
					'x/16i $pc-16',
				],
				{ all: true, reject: false, timeout: 60_000 },
			)
			await fs.writeFile(path.join(destination, trace), result.all)
			crash.status = result.failed || !result.all.includes('#0') ? 'failed' : 'captured'
			if (result.failed) {
				crash.detail = result.shortMessage
			} else if (crash.status === 'failed') {
				crash.detail = 'GDB produced no native stack frames'
			}
		} catch (error) {
			crash.detail = error instanceof Error ? error.message : String(error)
			await fs.writeFile(path.join(destination, trace), crash.detail)
		} finally {
			report.crashes.push(crash)
			// Raw cores can be large. Preserve text traces and release disk space per attempt.
			await fs.rm(core, { force: true })
		}
	}

	if (report.crashes.length > 0) {
		report.status = report.crashes.some((crash) => crash.status === 'failed')
			? 'failed'
			: 'captured'
	} else if (childProcess.signal !== undefined && CORE_SIGNALS.has(childProcess.signal)) {
		report.status = 'missing'
		report.detail = `Anki exited with ${childProcess.signal}, but no core dump was found`
	}

	await fs.writeFile(
		path.join(destination, 'native-crash.json'),
		JSON.stringify(report, undefined, '\t'),
	)
	return report
}

/** Fail early if this Linux runner cannot capture and symbolize a native crash. */
export async function verifyNativeCrashCapture(
	coreDirectory: string,
	destination: string,
): Promise<void> {
	await fs.mkdir(destination, { recursive: true })
	const child = execa('/bin/sh', ['-c', 'kill -TRAP $$'], { reject: false })
	const result = await child
	await fs.writeFile(
		path.join(destination, 'process.json'),
		JSON.stringify({
			exitCode: result.exitCode,
			pid: child.pid,
			signal: result.signal,
		}),
	)
	const report = await captureNativeCrashes(coreDirectory, destination)
	const trace = report.crashes[0]?.trace
	const text = trace === undefined ? '' : await fs.readFile(path.join(destination, trace), 'utf8')
	if (report.status !== 'captured' || !text.includes('SIGTRAP') || !text.includes('#0')) {
		throw new Error(`Native crash capture check failed; see ${destination}`)
	}
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const { values } = parseArgs({
		options: {
			'core-directory': { type: 'string' },
			output: { type: 'string' },
		},
	})
	if (values['core-directory'] === undefined || values.output === undefined) {
		throw new Error('Native crash check requires --core-directory and --output')
	}

	await verifyNativeCrashCapture(values['core-directory'], values.output)
}
