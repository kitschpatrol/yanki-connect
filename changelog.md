# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

(Node.js support requirements have sometimes increased in minor or patch releases.)

## [5.2.1] - 2026-11-01

### Maintenance

- Move unused Node.js type declarations to development dependencies so consumers no longer install them.
- Refresh build, test, and shared-config dependencies and workflow actions; build before linting and replace the separate skill-sync setup with pnpm permissions.
- Fix Windows CI with matching Qt and WebEngine constraints, and fix macOS CI by using Node.js 26.
- Remove integration-test timing races by polling until asynchronous answer, undo, and navigation operations settle.

## [5.2.0] - 2026-10-16

### Added

- Export `AnkiConnectUnreachableError`, a `TypeError` subclass thrown by convenience methods and `invoke` when fetch fails, preserving the underlying message and cause.

### Fixed

- Stop auto-launch retries after the session launch limit, allowing the final launch its full interval.
- Avoid auto-launch retries for HTTP errors, undefined responses, and JSON parsing failures.

### Documentation

- Add connection-error handling examples and explain how auto-launch exhaustion is reported.

### Maintenance

- Add connection-error and bounded-retry tests, remove unused fixture backups, and ignore disposable Anki data.

## [5.1.0] - 2026-10-16

### Added

- Support array tags in `addTags` and `removeTags`, and expose `addTags.add` for removing tags through the same action.
- Expose `deleteExisting` on note-media attachments to control replacement of existing files.

### Fixed

- Make `updateNoteModel.tags` optional to match accepted upstream requests.

### Documentation

- Refresh references for AnkiConnect 26.10.14.0 and document version-specific tag, media, model-conversion, and filtered-deck behavior.

### Maintenance

- Update the newer integration fixture to AnkiConnect 26.10.14.0, expand note-parameter tests, and set the automated dependency-update PR title.

## [5.0.0] - 2026-10-14

### Added

- Expose `deck.deckNameFromId` and `model.modelNameFromId` for resolving numeric IDs to names.
- Expose `note.canAddNote` and `note.canAddNoteWithErrorDetail` for validating individual candidate notes.
- Expose `graphical.guiAddNoteSetData` to replace or append data in the open Add Cards draft.
- Expose `graphical.guiReviewActive` to check whether the reviewer is active.
- Support `cardsInfo.fields` with convenience-method result types narrowed to the selected properties.
- Allow `notesInfo` to select notes using a search query.
- Support `storeMediaFile.skipHash` and infer a nullable result when hash-based skipping is requested.

### Changed

- **Breaking:** Drop Node.js 20 support and require `^22.12.0 || ^24.0.0 || >=26.0.0`.

### Fixed

- Route `note.notesModTime` to its own action instead of `notesInfo`.
- **Breaking:** Correct card information and modification-time results, including arrays, empty records for missing cards, and version-dependent `flags` and `nextReviews` fields.
- **Breaking:** Correct `setSpecificValueOfCard` to accept numeric values and `warning_check`, model its success and failure results, and allow nullable `unsuspend` results.
- **Breaking:** Model regular, filtered, and missing-deck results from `getDeckConfig`, with optional legacy configuration fields.
- **Breaking:** Correct model-editing signatures: flatten `findAndReplaceInModels` parameters and use `findText`, repair field-description APIs, and require template `Name`.
- **Breaking:** Correct model schemas for nullable IDs and deck assignments, optional stock metadata, and template requirement modes.
- **Breaking:** Give `guiCurrentCard` its actual reviewer-specific result shape and allow boolean results from `guiPlayAudio`, `guiStartCardTimer`, and `loadProfile`.
- **Breaking:** Correct permission responses to expose `requireApikey` and a numeric `version`, and make reflected action lists optional.
- **Breaking:** Represent recursive `multi` results, including nested responses and unwrapped action results.
- **Breaking:** Correct `addNotes` to return numeric IDs and `clearUnusedTags` to return `null`; account for missing notes and optional historical metadata in note-information results.
- **Breaking:** Require numeric card IDs in `statistic.getReviewsOfCards`.
- Honor upstream defaults by making deck-config cloning sources, model-field insertion positions, GUI presets and import paths, and media filename patterns optional.

### Documentation

- Document all 122 exposed legacy actions with compatibility ranges, version-specific parameters and fields, browser targets, and the distinction from upstream APIv1.
- Explain multi-version integration testing, separate coverage reports, and manual compatibility verification.

### Maintenance

- Expand integration tests to exercise every exposed endpoint against multiple AnkiConnect fixtures across Node, Chromium, and three operating systems.
- Add an on-demand compatibility matrix that probes historical Anki and AnkiConnect combinations, checks response types, and reports documentation mismatches.
- Refresh development dependencies, package-manager requirements, and workflow actions.

## [4.0.12] - 2026-10-06

### Changed

- **Breaking:** Declare supported Node.js versions as `^20.19.0 || ^22.12.0 || ^24.0.0 || >=26.0.0`, excluding Node 23 and 25.

### Fixed

- Restore imports in supported older browsers by removing the unsupported `v` regular-expression flag from platform detection.

### Documentation

- Document `fetchAdapter`, show exact runtime requirements, and correct the upstream release date.

### Maintenance

- Generate the README options table from TypeScript and JSDoc.
- Add scheduled dependency-update pull requests and contributor skill synchronization.
- Update `open`, refresh development dependencies, and correct link-checker error capture.

## [4.0.11] - 2026-09-15

### Maintenance

- Update the `open` runtime dependency.
- Upgrade to Vitest 5 and pnpm 12, refresh development dependencies and workflow actions, and let browser test servers select available ports.
- Simplify npm publishing authentication and rename the deep-clean script to `clean-deep`.

## [4.0.10] - 2026-08-28

### Maintenance

- Correct the contributor Node.js requirement from 26.7+ to 24.16+.

## [4.0.9] - 2026-08-28

### Maintenance

- Update the `open` runtime dependency.
- Refresh development dependencies and publishing authentication, improve sitemap discovery, and validate release tags against the default branch.

## [4.0.8] - 2026-08-02

### Documentation

- Correct npm, license, and project-background links.

### Maintenance

- Add automated repository and website link checking.
- Refresh development dependencies and workflow actions, update test-process handling for Execa 10, and add editor tasks for linting and fixes.

## [4.0.7] - 2026-07-16

### Maintenance

- Refresh development dependencies and CI actions, simplify TypeScript project configuration, and guard action-list generation against missing declarations.

## [4.0.6] - 2026-07-08

### Changed

- **Breaking:** Restrict supported Node.js versions to `^20.19.0 || >=22.12.0` and raise the Node.js build target to 20.19.

### Documentation

- Update the documented minimum Node.js version to 20.19.

### Maintenance

- Update Node.js type declarations.
- Adopt TypeScript 6 and shared-config 8, refresh build and test tooling and workflow actions, and update contributor Node.js requirements.

## [4.0.5] - 2026-05-16

### Maintenance

- Upgrade to pnpm 11, migrate dependency-build permissions, refresh workflow actions, and correct token passing in the publish command.

## [4.0.4] - 2026-05-12

### Documentation

- Standardize AnkiConnect branding throughout the README and API documentation.

### Maintenance

- Refresh build, test, lint, release, and package-manager dependencies.

## [4.0.3] - 2026-05-01

### Documentation

- Explain contribution expectations and the repository's linting, formatting, and README-generation tools.

### Maintenance

- Refresh development dependencies, make cleanup portable, and support release tags with or without a `v` prefix.

## [4.0.2] - 2026-04-06

### Maintenance

- Add automated Node and Chromium integration tests against disposable Anki fixtures on Linux, macOS, and Windows ([#5](https://github.com/kitschpatrol/yanki-connect/pull/5)).
- Refresh development dependencies and contributor settings, run tests without watch mode, and tighten release and metadata workflow permissions.

## [4.0.1] - 2026-02-28

### Added

- Provide a standalone browser ESM bundle through `yanki-connect/standalone`, jsDelivr, and unpkg.

### Documentation

- Add direct CDN import examples.

### Maintenance

- Refresh shared configuration and workflow actions, mark the package as side-effect-free, and validate packaged exports after building.

## [4.0.0] - 2026-02-19

### Changed

- **Breaking:** Drop Node.js 18 support and require Node.js 20.11+, updating the build target and `open` dependency accordingly.

### Documentation

- Update the documented Node.js runtime requirement.

### Maintenance

- Move build settings into a tsdown configuration file and add package and declaration validation.

## [3.2.4] - 2026-02-18

### Maintenance

- Refresh development dependencies, migrate formatter and spell-check configurations to TypeScript, and preserve `.js` build output filenames.

## [3.2.3] - 2026-01-20

### Maintenance

- Add a nightly workflow that detects newer AnkiConnect releases and opens a tracking issue.
- Refresh development dependencies and pnpm to address tooling security alerts, and update contributor configuration.

## [3.2.2] - 2025-12-08

### Maintenance

- Refresh development dependencies and fix pnpm hoisting by moving its configuration into `pnpm-workspace.yaml`.

## [3.2.1] - 2025-11-25

### Documentation

- Correct the matching upstream release to AnkiConnect 25.11.9.0 and link API documentation to release tags.

### Maintenance

- Refresh development dependencies, test configuration, and pnpm.

## [3.2.0] - 2025-11-07

### Added

- Expose `graphical.guiPlayAudio` to play audio for the current side of the reviewed card.

### Documentation

- Update action listings and compatibility references for AnkiConnect 25.11.5.0.

### Maintenance

- Migrate to Vitest 4, its Playwright browser provider, and V8 coverage, and refresh build and lint tooling.

## [3.1.0] - 2025-11-03

### Changed

- Allow note-media uploads to omit `fields`, matching AnkiConnect 25.11.2.0.

### Documentation

- Update upstream references and explain optional media target fields.

### Maintenance

- Refresh shared configuration, jsdom, tsdown, Vite, and pnpm.

## [3.0.10] - 2025-10-21

### Maintenance

- Update tsdown and Vite, addressing CVE-2025-62522 in development tooling.

## [3.0.9] - 2025-10-18

### Fixed

- Roll back broken declaration maps and remove the accompanying source files from the published package.

### Maintenance

- Update tsdown.

## [3.0.8] - 2025-10-18

### Added

- Include TypeScript sources in the npm package so declaration maps can reference the original files.

## [3.0.7] - 2025-10-18

### Maintenance

- Configure token-based authentication for automated local npm publishing.

## [3.0.6] - 2025-10-18

### Documentation

- Clarify browser and Node.js compatibility in the requirements overview.

### Maintenance

- Update Node.js type declarations.
- Replace pkgroll with tsdown, enable declaration-map generation, and refresh development dependencies.
- Update npm publishing authentication for security-key use.

## [3.0.5] - 2025-09-29

### Fixed

- **Breaking:** Correct `getDeckConfig().dyn` to `1 | false` instead of `boolean`.

### Maintenance

- Update Node.js type declarations.
- Refresh development dependencies and migrate lint commands from `kpi` to `ksc`.

## [3.0.4] - 2025-09-01

### Maintenance

- Refresh shared configuration, Playwright, Vite, and pnpm, and move dependency-build permissions into `pnpm-workspace.yaml`.

## [3.0.3] - 2025-08-20

### Maintenance

- Update Node.js type declarations.
- Refresh build, test, release, TypeScript, and package-manager dependencies, including Vite 7.

## [3.0.2] - 2025-07-17

### Fixed

- **Breaking:** Correct `deck.createDeck` to return a numeric deck ID instead of a record.

### Maintenance

- Update `open`, Node.js type declarations, and pkgroll.

## [3.0.1] - 2025-07-12

### Documentation

- Update AnkiConnect author attribution links and clarify the source of embedded action descriptions.

### Maintenance

- Update Node.js type declarations.
- Refresh development dependencies, consolidate Vitest projects into the main configuration, and upgrade the GitHub metadata action.

## [3.0.0] - 2025-05-27

### Fixed

- **Breaking:** Require `filename` on note-media attachments to match the upstream API ([#3](https://github.com/kitschpatrol/yanki-connect/pull/3)).
- **Breaking:** Correct note-media `skipHash` from the literal `false` to an MD5 hash string.

### Maintenance

- Update Node.js type declarations.
- Refresh development dependencies and pnpm and accommodate stricter lint checks.

## [2.2.3] - 2025-05-08

### Maintenance

- Update runtime dependencies, including `open` and Node.js type declarations.
- Refresh Vitest, Vite, and pnpm.

## [2.2.2] - 2025-04-24

### Maintenance

- Update runtime dependencies, including `open` and Node.js type declarations.
- Refresh development dependencies and pnpm to resolve tooling security alerts, and standardize type-only imports.

## [2.2.1] - 2025-03-26

### Documentation

- Expand the README into a complete list of 115 exposed actions.

### Maintenance

- Generate action counts and listings from TypeScript through mdat, and update Node.js types and Vite.

## [2.2.0] - 2025-03-22

### Added

- Expose `card.setDueDate` for scheduling cards using Anki's due-date syntax.
- Expose `graphical.guiSelectCard` for selecting a card in the browser.

### Deprecated

- Deprecate `graphical.guiSelectNote`, which actually selects a card ID, in favor of `guiSelectCard`.

### Fixed

- **Breaking:** Include a top-level `null` in the `addNotes` result type for failures affecting the entire request.

### Documentation

- Move upstream links to SourceHut, pin API references to the implemented release, and clarify Anki and AnkiConnect prerequisites.

### Maintenance

- Update Node.js type declarations.
- Refresh development dependencies and pnpm.

## [2.1.12] - 2025-03-04

### Changed

- Allow Node.js 18.15+ within the Node 18 release line and remove the pnpm engine restriction.

### Maintenance

- Update Node.js type declarations and shared configuration, and correct the npm repository URL.

## [2.1.11] - 2025-03-02

### Changed

- **Breaking:** Raise the minimum supported Node.js 20 version from 20.5 to 20.11 while retaining Node 18.19 support.

### Maintenance

- Migrate to shared-config 5 and flat ESLint configuration, add Knip checks, refresh build and test dependencies, and adopt pnpm 10.
- Make implementation-only types internal without changing package-root exports.

## [2.1.10] - 2025-01-22

### Maintenance

- Update development tooling, including Vite to address CVE-2025-24010, and satisfy type-ordering lint rules.

## [2.1.9] - 2024-12-22

### Maintenance

- Refresh development dependencies and editor settings, and rename the GitHub metadata workflow.

## [2.1.8] - 2024-11-19

### Documentation

- Add Vite browser-bundling guidance for externalizing `open` and clarify the library's relationship to Anki.

### Maintenance

- Refresh pnpm and build, test, lint, and release dependencies.

## [2.1.7] - 2024-09-15

### Maintenance

- Update `@kitschpatrol/shared-config`.

## [2.1.6] - 2024-09-14

### Maintenance

- Refresh build, test, lint, release, and package-manager dependencies and simplify package metadata and maintenance scripts.

## [2.1.5] - 2024-09-07

### Maintenance

- Update shared configuration and simplify the CSpell configuration.

## [2.1.4] - 2024-09-07

### Maintenance

- Update shared lint configuration, Playwright, and Vite, and apply revised import ordering.

## [2.1.3] - 2024-08-29

### Documentation

- Refresh upstream documentation links and clarify API-key and auto-launch options.

### Maintenance

- Remove the obsolete browser test fixture and refresh pnpm, release, and browser-test dependencies.

## [2.1.2] - 2024-08-14

### Changed

- **Breaking:** Declare supported Node.js versions as `^18.19.0 || >=20.5.0`.

### Documentation

- Clarify Node.js requirements and correct descriptions of convenience-method error handling.

### Maintenance

- Align distributed Node.js type declarations with Node 18.19.0.
- Migrate browser testing to Vitest and Playwright, add coverage reporting, and refresh development dependencies and cleanup tooling.

## [2.1.1] - 2024-08-03

### Documentation

- Correct deck-listing examples to use `client.deck` and update the documented action count to 113.

### Maintenance

- Update Node.js type declarations.
- Refresh release, build, and test tooling.

## [2.1.0] - 2024-07-26

### Added

- Expose `miscellaneous.getActiveProfile` and include the profile name in `notesInfo` results.
- Expose `note.notesModTime` and add modification timestamps to the `notesInfo` result type.

### Documentation

- Update compatibility guidance for AnkiConnect 24.7.25.0 and describe aggregated errors from `addNotes`.

## [2.0.6] - 2024-07-26

### Maintenance

- Update Node.js type declarations.
- Refresh pnpm, pkgroll, TypeScript, Vite, and Vitest.

## [2.0.5] - 2024-07-09

### Maintenance

- Update Node.js type declarations.
- Upgrade to Vitest 2, refresh TypeScript and Vite, and require pnpm 9 for repository tooling.

## [2.0.4] - 2024-06-23

### Fixed

- Correct launcher imports to reference the renamed platform constants.

## [2.0.3] - 2024-06-23

### Maintenance

- Enforce uppercase naming for exported primitive constants and rename internal platform constants accordingly.

## [2.0.2] - 2024-06-23

### Changed

- **Breaking:** Require fetch-adapter responses to expose `headers` as a `Headers` instance or string record.

## [2.0.1] - 2024-06-23

### Fixed

- **Breaking:** Make fetch-adapter request options and their fields optional to match native fetch; custom adapters must accept omitted options.

### Maintenance

- Update Node.js type declarations.

## [2.0.0] - 2024-06-21

### Changed

- **Breaking:** Rename the `customFetch` option to `fetchAdapter` and the exported `YankiFetch` type to `YankiFetchAdapter`.

### Maintenance

- Update Node.js type declarations and replace collection-specific test snapshots with repeatable assertions and cleanup.

## [1.0.7] - 2024-06-20

### Removed

- **Breaking:** Remove `filename` from the declared note-media attachment type.

### Fixed

- Allow media uploads to use alternative `data`, `path`, or `url` sources, and make `storeMediaFile.deleteExisting` optional.

### Maintenance

- Update Node.js type declarations and TypeScript.

## [1.0.6] - 2024-06-19

### Documentation

- Document AnkiConnect 24.6.17.0 as the compatibility baseline for the available features.

### Maintenance

- Update Node.js type declarations and pnpm.

## [1.0.5] - 2024-06-14

### Maintenance

- Update shared lint configuration and Vite, and exercise a custom fetch implementation in the browser fixture.

## [1.0.4] - 2024-06-13

### Documentation

- Clarify the `'immediately'` value in the auto-launch configuration reference.

### Maintenance

- Refresh pnpm, lint and browser tooling, update release and metadata actions, and catch errors in the browser test fixture.

## [1.0.3] - 2024-06-07

### Documentation

- Link to the released Yanki Obsidian plugin.

### Maintenance

- Build after updating the package version and upgrade the GitHub release action.

## [1.0.2] - 2024-06-06

### Documentation

- Update the related CLI project's name and link from `yanki-md` to `yanki`.

## [1.0.1] - 2024-06-06

### Changed

- Report connection retries and auto-launch attempts through `console.warn`.

### Documentation

- Clarify that the Yanki Obsidian plugin is forthcoming.

## [1.0.0] - 2024-06-06

### Added

- Introduce `YankiConnect`, a typed AnkiConnect API version 6 client covering 111 actions across card, deck, graphical, media, miscellaneous, model, note, and statistic groups.
- Provide convenience methods that return action results and throw API errors, plus typed `invoke(action, params)` access to raw responses.
- Support configurable host, port, API key, and fetch implementation, defaulting to the local AnkiConnect service at port 8765.
- Export client options, fetch types, default options, and the `YankiParamsForAction` and `YankiResponseForAction` type helpers.
- Offer experimental macOS auto-launch in Node.js, either immediately on client creation or when requests cannot connect to Anki.
- Distribute an ESM-only npm package for browsers and Node.js 18+, with bundled TypeScript declarations and an MIT license.

### Documentation

- Add installation and configuration guidance, note-creation and deck-listing examples, direct-invocation examples, and inline action documentation.

### Maintenance

- Establish the build, lint, Node and browser testing, package publishing, and GitHub release tooling.

[1.0.0]: https://github.com/kitschpatrol/yanki-connect/releases/tag/v1.0.0
[1.0.1]: https://github.com/kitschpatrol/yanki-connect/compare/v1.0.0...v1.0.1
[1.0.2]: https://github.com/kitschpatrol/yanki-connect/compare/v1.0.1...v1.0.2
[1.0.3]: https://github.com/kitschpatrol/yanki-connect/compare/v1.0.2...v1.0.3
[1.0.4]: https://github.com/kitschpatrol/yanki-connect/compare/v1.0.3...v1.0.4
[1.0.5]: https://github.com/kitschpatrol/yanki-connect/compare/v1.0.4...v1.0.5
[1.0.6]: https://github.com/kitschpatrol/yanki-connect/compare/v1.0.5...v1.0.6
[1.0.7]: https://github.com/kitschpatrol/yanki-connect/compare/v1.0.6...v1.0.7
[2.0.0]: https://github.com/kitschpatrol/yanki-connect/compare/v1.0.7...v2.0.0
[2.0.1]: https://github.com/kitschpatrol/yanki-connect/compare/v2.0.0...v2.0.1
[2.0.2]: https://github.com/kitschpatrol/yanki-connect/compare/v2.0.1...v2.0.2
[2.0.3]: https://github.com/kitschpatrol/yanki-connect/compare/v2.0.2...v2.0.3
[2.0.4]: https://github.com/kitschpatrol/yanki-connect/compare/v2.0.3...v2.0.4
[2.0.5]: https://github.com/kitschpatrol/yanki-connect/compare/v2.0.4...v2.0.5
[2.0.6]: https://github.com/kitschpatrol/yanki-connect/compare/v2.0.5...v2.0.6
[2.1.0]: https://github.com/kitschpatrol/yanki-connect/compare/v2.0.6...v2.1.0
[2.1.1]: https://github.com/kitschpatrol/yanki-connect/compare/v2.1.0...v2.1.1
[2.1.2]: https://github.com/kitschpatrol/yanki-connect/compare/v2.1.1...v2.1.2
[2.1.3]: https://github.com/kitschpatrol/yanki-connect/compare/v2.1.2...v2.1.3
[2.1.4]: https://github.com/kitschpatrol/yanki-connect/compare/v2.1.3...v2.1.4
[2.1.5]: https://github.com/kitschpatrol/yanki-connect/compare/v2.1.4...v2.1.5
[2.1.6]: https://github.com/kitschpatrol/yanki-connect/compare/v2.1.5...v2.1.6
[2.1.7]: https://github.com/kitschpatrol/yanki-connect/compare/v2.1.6...v2.1.7
[2.1.8]: https://github.com/kitschpatrol/yanki-connect/compare/v2.1.7...v2.1.8
[2.1.9]: https://github.com/kitschpatrol/yanki-connect/compare/v2.1.8...v2.1.9
[2.1.10]: https://github.com/kitschpatrol/yanki-connect/compare/v2.1.9...v2.1.10
[2.1.11]: https://github.com/kitschpatrol/yanki-connect/compare/v2.1.10...v2.1.11
[2.1.12]: https://github.com/kitschpatrol/yanki-connect/compare/v2.1.11...v2.1.12
[2.2.0]: https://github.com/kitschpatrol/yanki-connect/compare/v2.1.12...v2.2.0
[2.2.1]: https://github.com/kitschpatrol/yanki-connect/compare/v2.2.0...v2.2.1
[2.2.2]: https://github.com/kitschpatrol/yanki-connect/compare/v2.2.1...v2.2.2
[2.2.3]: https://github.com/kitschpatrol/yanki-connect/compare/v2.2.2...v2.2.3
[3.0.0]: https://github.com/kitschpatrol/yanki-connect/compare/v2.2.3...v3.0.0
[3.0.1]: https://github.com/kitschpatrol/yanki-connect/compare/v3.0.0...v3.0.1
[3.0.2]: https://github.com/kitschpatrol/yanki-connect/compare/v3.0.1...v3.0.2
[3.0.3]: https://github.com/kitschpatrol/yanki-connect/compare/v3.0.2...v3.0.3
[3.0.4]: https://github.com/kitschpatrol/yanki-connect/compare/v3.0.3...v3.0.4
[3.0.5]: https://github.com/kitschpatrol/yanki-connect/compare/v3.0.4...v3.0.5
[3.0.6]: https://github.com/kitschpatrol/yanki-connect/compare/v3.0.5...v3.0.6
[3.0.7]: https://github.com/kitschpatrol/yanki-connect/compare/v3.0.6...v3.0.7
[3.0.8]: https://github.com/kitschpatrol/yanki-connect/compare/v3.0.7...v3.0.8
[3.0.9]: https://github.com/kitschpatrol/yanki-connect/compare/v3.0.8...v3.0.9
[3.0.10]: https://github.com/kitschpatrol/yanki-connect/compare/v3.0.9...v3.0.10
[3.1.0]: https://github.com/kitschpatrol/yanki-connect/compare/v3.0.10...v3.1.0
[3.2.0]: https://github.com/kitschpatrol/yanki-connect/compare/v3.1.0...v3.2.0
[3.2.1]: https://github.com/kitschpatrol/yanki-connect/compare/v3.2.0...v3.2.1
[3.2.2]: https://github.com/kitschpatrol/yanki-connect/compare/v3.2.1...v3.2.2
[3.2.3]: https://github.com/kitschpatrol/yanki-connect/compare/v3.2.2...v3.2.3
[3.2.4]: https://github.com/kitschpatrol/yanki-connect/compare/v3.2.3...v3.2.4
[4.0.0]: https://github.com/kitschpatrol/yanki-connect/compare/v3.2.4...v4.0.0
[4.0.1]: https://github.com/kitschpatrol/yanki-connect/compare/v4.0.0...v4.0.1
[4.0.2]: https://github.com/kitschpatrol/yanki-connect/compare/v4.0.1...v4.0.2
[4.0.3]: https://github.com/kitschpatrol/yanki-connect/compare/v4.0.2...v4.0.3
[4.0.4]: https://github.com/kitschpatrol/yanki-connect/compare/v4.0.3...v4.0.4
[4.0.5]: https://github.com/kitschpatrol/yanki-connect/compare/v4.0.4...v4.0.5
[4.0.6]: https://github.com/kitschpatrol/yanki-connect/compare/v4.0.5...v4.0.6
[4.0.7]: https://github.com/kitschpatrol/yanki-connect/compare/v4.0.6...v4.0.7
[4.0.8]: https://github.com/kitschpatrol/yanki-connect/compare/v4.0.7...v4.0.8
[4.0.9]: https://github.com/kitschpatrol/yanki-connect/compare/v4.0.8...v4.0.9
[4.0.10]: https://github.com/kitschpatrol/yanki-connect/compare/v4.0.9...v4.0.10
[4.0.11]: https://github.com/kitschpatrol/yanki-connect/compare/v4.0.10...v4.0.11
[4.0.12]: https://github.com/kitschpatrol/yanki-connect/compare/v4.0.11...v4.0.12
[5.0.0]: https://github.com/kitschpatrol/yanki-connect/compare/v4.0.12...v5.0.0
[5.1.0]: https://github.com/kitschpatrol/yanki-connect/compare/v5.0.0...v5.1.0
[5.2.0]: https://github.com/kitschpatrol/yanki-connect/compare/v5.1.0...v5.2.0
[5.2.1]: https://github.com/kitschpatrol/yanki-connect/compare/v5.2.0...v5.2.1
