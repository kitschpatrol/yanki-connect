# Compatibility survey

The compatibility workflow attempts every selected Anki × AnkiConnect pairing.
Incompatibility is an expected finding when old and new releases are mixed.

- Probes record action results and add-on load failures without failing the job.
  Installation failures, Anki launch failures, unexplained add-on timeouts, and
  probe errors fail the job after writing its results. Other pairings continue.
- The report shows observed add-on loading ranges and per-action minimums.
  A missing artifact, failed launch, or skipped action does not demonstrate that
  a documented minimum is wrong. Such minimums are inconclusive. Documentation
  mismatches are findings to review, not a reason to fail an exploratory run.
- With an accepted baseline, a previously supported action on the same Anki and
  AnkiConnect versions becoming unsupported fails the report. Losing coverage
  of a previously supported observation also fails, with a separate diagnosis.
  Newly discovered pairings do not fail solely because they are incompatible.

Results and reports are uploaded even when collection or regression checks fail.
The selected matrix is passed separately to the report so missing artifacts
cannot silently remove a release from the survey. Filtered runs compare only
their selected versions and report how many baseline observations were excluded.

Probes use Ubuntu 24.04 so older bundled Qt libraries are not rejected by the
newer loader in Ubuntu 26.04. OS package downloads retry transient failures, and
incomplete package index updates fail before installation.
For the Anki 2.1.15–2.1.49 Linux bundles, the runner sets
`QTWEBENGINE_DISABLE_SANDBOX=1` only in each disposable Anki process environment.
This works around their older QtWebEngine sandbox crashing on the host's
`clone3` syscall. Preflight and every pairing use the same setting, with normal
focus handling and readiness assertions. Other releases keep their existing
runtime settings. The results JSON records `runtimeNotes`, and both the summary
and reconciliation prompt list the adjusted releases under **Runtime workarounds**.
These observations describe compatibility with that runtime adjustment.

The runner also installs `mpv` and verifies playback of the short MP3 and MP4
fixtures before launching Anki. Every disposable base folder receives
`mpv.conf` with `ao=null` and `vo=null`: media decoding runs without requiring
audio hardware or opening a separate video window. The survey checks API
behavior, not audible output or video presentation. Media-bearing notes use
valid files; the text-file fixtures used by storage probes keep their original
contents.

Anki release archives retry transient HTTP errors, connection failures, and
interrupted transfers up to three attempts, with delays of 5 and 10 seconds.
Each attempt has a three-minute deadline including the response body. Partial
archives are discarded; permanent errors such as HTTP 404 are not retried.

The diagnostic add-on records the loader's HTML and native error messages before
dismissing their dialogs, including non-modal loader notifications. It flushes
Python output so tracebacks omitted from the visible dialog survive shutdown.
Other non-modal windows remain available for GUI probes.

Xvfb runs with Openbox so Qt has a window manager to deliver focus events. The
diagnostic add-on keeps the disposable main window focused during reviewer
probes, and releases it before browser/editor probes. This lets Anki handle its
normal pending refreshes without calling reviewer internals or replacing API
handlers.

GUI probes wait for fresh idle observations, the expected card side, and both
reviewer webviews to finish loading their JavaScript. Pending reviewer refreshes
also prevent readiness. The action under test is called once, so an API failure
is still reported. A failed postcondition is a behavior failure; an unavailable
prerequisite skips the dependent action. A failed `guiDeckReview` skips the
question/answer sequence immediately. In particular, a failed `guiShowAnswer`
does not produce a second API failure for an uncalled `guiAnswerCard`. Skipped
baseline observations still fail the report as unverified coverage. Unexplained
startup timeouts still fail collection.

A terminated web renderer, stopped media server, stale diagnostic heartbeat, or inability to focus the
main window is an `infrastructure` outcome, not action incompatibility. These
failures prevent subsequent GUI probes, including `guiExitAnki`, from running in
the same process. Shutdown remains an API probe; the runner handles process
cleanup separately, so a dead host cannot become a shutdown regression.
These explicit host failures retry the pairing once in a fresh profile. Both attempts
are retained and recoveries appear in the report. If the second attempt also
fails, collection fails. API errors, assertion failures, and live reviewer
postcondition timeouts are never retried to obtain a passing result.
If a host retry is needed, any independently observed API or behavior failure
from the first attempt remains a failure even if its second attempt passes.

Each per-release artifact includes full startup and dialog logs under
`logs/<Anki version>/<AnkiConnect version>/attempt-1/` (and `attempt-2/` when
needed), plus `preflight/` for the initial
Anki startup. These files survive deletion of the disposable profiles. The JSON
contains a shorter diagnostic summary.
`gui-state.log` records state transitions, and `gui-state.json` contains the last
observation, including reviewer webview readiness, focus, and media-server
health. Each attempt also retains its full action results in `result.json`.
`process.json` records the process ID, start and exit times, exit code or signal,
and launch errors, plus the effective `QTWEBENGINE_DISABLE_SANDBOX` override.
It records runner cleanup separately, including whether the
process was still alive and whether the runner sent `SIGKILL`. Python's fault
handler is enabled so native crashes can also leave tracebacks in `anki.log`.
`mpv.conf` preserves the disposable profile's playback configuration.
The helper observes Qt's renderer-termination signal before the reviewer opens.
`rendererFailures` in the GUI-state logs retains the page, Qt termination status,
exit code, and event time even if the main Python process stays alive. A fresh
readiness observation of an abnormal renderer exit fails GUI collection and
permits the existing single retry. A live page that does not reach the required state remains a behavior
failure; a readiness timeout alone does not prove that a renderer crashed.

## Diagnosing the older-Anki GUI crash

Run the **Compatibility** workflow with **diagnose-gui-crash** enabled. This
uses the selected version filters, defaulting to Anki 2.1.49 and AnkiConnect
23.10.29.0 when they are empty. Each selected Anki release runs two jobs:
QtWebEngine sandbox enabled and disabled. Keep diagnostic selections small.
Leave the
baseline input empty; diagnostic mode skips the compatibility report and its
baseline comparison. Normal runs keep the diagnostic switch disabled.

Both jobs keep focus handling and readiness assertions enabled. The control
removes `QTWEBENGINE_DISABLE_SANDBOX`; the other job sets it to `1` only in the
disposable Anki process environment, including preflight and every probe attempt.
The diagnostic control bypasses the normal legacy-bundle workaround so it can
still reproduce the original crash. Neither job changes the parent environment.

The [focus experiment](https://github.com/kitschpatrol/yanki-connect/actions/runs/44017235906)
captured `QtWebEngineProcess` crashes in `clone3`
with `SIGSYS`, even during startup without AnkiConnect. Disabling focus avoided
the main-process crash but left the renderer broken. The subsequent
[sandbox comparison](https://github.com/kitschpatrol/yanki-connect/actions/runs/44019866641)
restored GUI coverage with no renderer or application cores when the sandbox was
disabled. All 21 GUI actions ran: 16 passed and five returned explicit unsupported
action/version errors. The control still crashed on both attempts. The subsequent
[full survey](https://github.com/kitschpatrol/yanki-connect/actions/runs/44046503349)
confirmed collection across all five adjusted releases: each tested nine loadable
AnkiConnect releases and recorded 23 add-on incompatibilities, with no infrastructure
failures or retries. Diagnostic results are never a baseline.

That full survey compared 105,321 baseline observations without regressions or
unverified coverage. Its revised reviewer probes still recorded 730
`guiDeckReview` behavior failures and left dependent reviewer checks inconclusive.
These revised probes were excluded from the old baseline comparison. A green
comparison therefore does not establish support for those pairings.

The [older-release sandbox comparison](https://github.com/kitschpatrol/yanki-connect/actions/runs/44119199188)
tested Anki 2.1.15 and 2.1.44 with AnkiConnect 22.2.19.0. Both controls captured
`QtWebEngineProcess` crashes in `clone3` with `SIGSYS`, during preflight and both
probe attempts. The helper detected the renderer failures while Anki stayed alive,
classified all 21 GUI actions as infrastructure failures, and failed collection
after one retry. With the sandbox disabled, both releases ran all 21 GUI probes:
14 passed and seven returned explicit unsupported-action errors. Neither needed a
retry or recorded an application or renderer core.

The [full-range survey](https://github.com/kitschpatrol/yanki-connect/actions/runs/44122605332)
then exercised all 28 surveyed releases in Anki 2.1.15–2.1.49 with the workaround.
Twenty-seven probe jobs completed successfully. Anki 2.1.20 retained responsive
webviews but lost main-window focus on both attempts after a missing media player
raised an exception. Its logs show fallback from missing `mpv` to missing
`mplayer`, motivating the playback setup described above.

That report compared 104,307 baseline observations with zero regressions, ten
unverified observations, and one collection failure, all lost coverage belonging
to Anki 2.1.20. Anki 2.1.53 also needed one fresh-profile retry after its media
server stopped; the retry recovered GUI coverage. The revised reviewer probes
still recorded 707 `guiDeckReview` behavior failures. These remain compatibility
findings, separate from the infrastructure failure. `modelNamesAndIds` passed all
1,044 loadable pairings, confirming its documented Anki minimum of 2.1.15.

The unresolved collection failure prevents accepting that report as a baseline.
The subsequent [playback validation survey](https://github.com/kitschpatrol/yanki-connect/actions/runs/44130540851)
passed all 80 probe jobs and the report. It compared 104,307 observations against
`43912502931` with no regressions, unverified observations, or collection failures.
All action outcomes matched the preceding survey except Anki 2.1.20's 21 recovered
GUI observations: 14 passed and seven returned explicit unsupported-action errors,
without a retry or media-player exception. One pairing on Anki 2.1.51 needed a
fresh-profile retry after its media-server thread stopped; that retry recovered
all GUI coverage.

Run `44130540851` was accepted as the baseline on 2026-11-17. It includes the
current probe revisions and the existing 707 `guiDeckReview` behavior failures;
the three dependent reviewer actions remain inconclusive for those pairings.
Those compatibility boundaries are not evidence of complete cross-version support.
[Accepting a baseline](#accepting-a-baseline) names the current baseline. Do not
use a diagnostic run as the baseline.

The runner first verifies core capture using a small process that raises
`SIGTRAP`. After each Anki attempt, GDB reads the core dumps and records thread
backtraces, shared libraries, registers, and instructions around the crash.
The application runs without a debugger attached. Child-process cores are
analyzed using their own executables. Raw cores are deleted after analysis to
limit disk usage; the text traces remain in the artifacts.

Download `compatibility-debug-<Anki version>-sandbox-enabled` and
`compatibility-debug-<Anki version>-sandbox-disabled` for each selected release.
Each attempt includes:

- `process.json`: process exit, runner cleanup, and the sandbox environment override.
- `focus.log`: the last focus operation reached before the crash.
- `native-crash.json` and `native-backtrace-<pid>.log`: capture status and native stacks.
- `gui-state.log` and `result.json`: UI observations and probe outcomes.

The job summary lists preflight and each attempt's signal, sandbox override,
native capture status, renderer core count, and action outcome counts. The
`native-capture-check/` directory retains the initial verification results.
Diagnostic results are rejected by the compatibility report builder and must
never be promoted to a baseline.

## Accepting a baseline

Review a run's `compatibility` artifact, including its coverage gaps, before
accepting it. Set the repository Actions variable `COMPATIBILITY_BASELINE_RUN_ID`
to that run's numeric ID. The workflow also accepts a `baseline-run-id` input to
override the variable for a single run. The baseline is never advanced
automatically, including after a failed or partial run.

Without an accepted run ID, the report explicitly identifies the run as
discovery only. A configured baseline that cannot be downloaded or parsed fails
the job; it never silently falls back to discovery. Artifacts expire after 90
days, so review and accept a newer report before the baseline expires. Keep an
external copy of accepted reports for longer-term comparisons.

The current baseline is the
[AnkiConnect 26.11.19.1 survey](https://github.com/kitschpatrol/yanki-connect/actions/runs/44802360641),
run `44802360641`, accepted on 2026-11-20. It covers 80 Anki releases and 35
AnkiConnect releases through 26.11.19.1. Compared against `44130540851`, it had no
regressions, unverified observations, collection failures, or infrastructure
retries. It still records the 707 `guiDeckReview` behavior failures, so the three
dependent reviewer actions remain inconclusive for those pairings. Its artifacts
expire on 2027-02-18.

The comparison uses only the baseline's successful action observations with
matching probe revisions. Older artifacts default to revision 1. Changed
assertions are listed as **changed probes**, with the number of observations
requiring a new baseline; they do not masquerade as compatibility regressions.
Unchanged actions continue to be checked against the old baseline. Current
failures remain visible in the action results and documentation findings.

The four reviewer probes (`guiDeckReview`, `guiShowQuestion`, `guiShowAnswer`,
`guiAnswerCard`) now use revision 2. `modelNamesAndIds` also uses revision 2:
it compares model identity without blaming a valid numeric ID for a string ID
returned by an older `createModel`. Both original responses are still checked
against their declared types, so signature failures remain attached to the
action that produced them. Every baseline since `44130540851` captures these
revised assertions, so they have regression coverage. A green report with
changed probes does not give the revised assertions regression coverage until a
run that includes them is accepted. Review its GUI findings and any
infrastructure retries before accepting it. Never promote a partial run. Reports
with unresolved collection failures are rejected as baselines. When changing an
assertion's meaning, bump its entry in `probe-revisions.ts`.

## Local use

Download and extract the per-release artifacts into a directory of JSON files.
The report can also compare against an archived, accepted report:

```sh
node scripts/compatibility/report.ts --results merged --output compatibility \
  --baseline accepted/compatibility.json
```

Pass `--anki-releases` and `--anki-connect-versions` as JSON arrays to specify
the complete intended matrix, as CI does. Without these options, local reports
infer the scope from the supplied results and cannot detect entirely missing
release artifacts.

The output contains `compatibility.json`, `summary.md`, and
`compatibility-prompt.md`. The JSON retains every action outcome, regression,
and coverage failure; the Markdown limits long regression lists for readability.
Run `pnpm build` before `pnpm test:compatibility`; the probe tests load the built
client from `dist/`. These isolated regression tests do not launch Anki or contact
external services; the media-fixture test uses a temporary loopback server.
