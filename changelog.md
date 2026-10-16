# Changelog

## 5.0.1

Documentation update for AnkiConnect 26.10.14.0. Runtime behavior and types are unchanged.

- Upstream documentation links point to the AnkiConnect 26.10.14.0 legacy API reference, and the readme recommends AnkiConnect 26.10.14.0 or later.
- Action documentation describes upstream fixes in AnkiConnect 26.10.13.0 and 26.10.14.0:
  - `updateNote` and `updateNoteFields`: media entries can target note fields that `fields` leaves out. AnkiConnect 26.10.11.0 through 26.10.13.0 store the file without adding it to those fields. Field names match case-insensitively from 26.10.14.0.
  - `guiAddCards`: on Anki 26.08 and later, AnkiConnect 26.10.11.0 through 26.10.13.0 do not save preset tags with the added note.
  - `updateNoteModel`: when the note's only card template has no namesake in the new model, AnkiConnect 26.10.11.0 through 26.10.12.2 replace the card and lose its review history.
- AnkiConnect 26.10.14.0 also accepts looser legacy input, such as decimal-string IDs, `"true"` and `0`/`1` booleans, single values for list parameters, whitespace-separated tag strings, and `null` optional values. The client types keep the strict forms, which every supported release accepts.
- Integration tests run against the AnkiConnect 26.10.14.0 fixture instead of 26.10.13.0, and cover media attached to a field that an update's `fields` leaves out.

## 5.0.0

Breaking release. The type definitions were audited against every AnkiConnect release from 22.2.19.0 to 26.10.13.0 with a new end-to-end compatibility suite, and many signatures changed to match what the add-on actually accepts and returns. Runtime behavior is unchanged except where noted under Fixed.

### Breaking changes

#### Runtime requirements

- Dropped Node.js 20 support. The minimum Node.js version is now 22.12.0, with supported ranges of `^22.12.0 || ^24.0.0 || >=26.0.0`. Node.js 22 is the oldest release line still supported upstream.

#### Parameters

- `findAndReplaceInModels` takes `{ modelName, findText, replaceText, front?, back?, css? }` directly. The old `{ model: { ..., fieldText } }` wrapper never matched the API.
- `modelFieldDescriptions` takes `{ modelName }` and returns `string[]`. `modelFieldSetDescription` takes `{ modelName, fieldName, description }` and returns `boolean`. The two had each other's signatures.
- `modelTemplateAdd` requires `template.Name`.
- `setSpecificValueOfCard` accepts `newValues: Array<number | string>` and an optional `warning_check`, and returns `[true]`, `[[false, message]]`, or `false` instead of `boolean[]`.
- `getReviewsOfCards` takes `cards: number[]` instead of `string[]`.

#### Results

- `cardsInfo`: `CardInfo` no longer carries `buttons` or `template`, which belong to `guiCurrentCard`. `nextReviews` and the new `flags` are optional because older releases omit them, and unknown card IDs produce `{}` entries. The `invoke` result type is `Array<Partial<CardInfo>>`; the convenience method still returns complete records, or `Pick<CardInfo, ...>` when the new `fields` parameter is used.
- `guiCurrentCard` returns a dedicated `GuiCurrentCard` type (`buttons`, `nextReviews`, and `template` plus the card fields) instead of `CardInfo | null`.
- `notesInfo`, `notesModTime`, and `cardsModTime` include `{}` entries for unknown IDs. `notesInfo` `mod` and `profile` are optional.
- `getDeckConfig` returns `DeckConfig | FilteredDeckConfig | false`. `DeckConfig.dyn` is `false`, and `new.separate`, `rev.fuzz`, and `rev.minSpace` are optional.
- `storeMediaFile` returns `null | string` through `invoke`. The convenience method returns `string`, or `null | string` when `skipHash` is passed.
- `unsuspend` returns `boolean | null`. `guiPlayAudio`, `guiStartCardTimer`, and `loadProfile` return `boolean` instead of the literal `true`.
- `addNotes` returns `number[]`. `clearUnusedTags` returns `null`.
- `requestPermission` granted results use `requireApikey` (the add-on's spelling) and `version: number`.
- `apiReflect` results have an optional `actions`. `multi` results are typed as nested `MultiResult[]`.
- Model types: `Model.did`, `ModelField.id`, `ModelField.tag`, `ModelTemplate.id`, and `ModelTemplate.did` are `null | number`. `Model.originalStockKind` is optional. `Model.req` entries are `[number, 'all' | 'any' | 'none', number[]]`.
- The exported `YankiParamsForAction` and `YankiResponseForAction` types reflect all of the above.

### Added

- Six legacy actions that AnkiConnect documents but the client lacked:

  - `client.deck.deckNameFromId`
  - `client.model.modelNameFromId`
  - `client.note.canAddNote`
  - `client.note.canAddNoteWithErrorDetail`
  - `client.graphical.guiReviewActive`
  - `client.graphical.guiAddNoteSetData` (new in AnkiConnect 26.10.11.0, requires Anki 26.08).

- `cardsInfo` `fields` selects which card properties to return (AnkiConnect 26.10.12.2 or later). The convenience method narrows its result type to the requested keys.
- `notesInfo` accepts `{ query }` as an alternative to `{ notes }` (AnkiConnect 25.2.24.0 or later).
- `storeMediaFile` `skipHash` skips storing when the MD5 digest matches the incoming data.
- Parameters that were wrongly required are now optional: `guiAddCards.note`, `guiImportFile.path`, `getMediaFilesNames.pattern`, `cloneDeckConfigId.cloneFrom`, and `modelFieldAdd.index`.
- Parameters and response fields carry JSDoc that names the AnkiConnect release that introduced them, visible on hover.

### Fixed

- `client.note.notesModTime` invoked `notesInfo` instead of `notesModTime`.

### Changed

- Types and documentation target the legacy API of AnkiConnect 26.10.12.2, documented upstream in `API_LEGACY.md`, and all upstream links point there. The client still speaks only the legacy (version 6) API; API v1 is not supported yet.
- `removeEmptyNotes` is documented as removed in AnkiConnect 26.10.11.0 and later. It works through 25.11.9.0; newer releases return an error.
- Version requirements are per action. Each action's `@minimumAnki` and `@minimumAnkiConnect` tags, and the readme table generated from them, give the oldest releases that support the action with its required parameters and non-optional response fields. Parameters and response fields added later are optional in the types and name their release in their documentation. The baseline is Anki 2.1.15 with AnkiConnect 22.2.19.0; AnkiConnect 26.10.12.2 or later on Anki 26.08 supports every typed parameter and field.
- Every row of that table is verified empirically by the new Compatibility workflow, which probes all 122 actions against 79 Anki releases and 30 AnkiConnect releases.

### Internal

- Integration tests run against two bundled AnkiConnect fixtures (25.11.9.0 and 26.10.12.2) in Node and Chromium, on Linux, macOS, and Windows in CI.
- Added `scripts/compatibility/` and the manual Compatibility workflow.
- Development dependency updates. Runtime dependencies are unchanged.
