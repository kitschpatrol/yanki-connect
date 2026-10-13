<!-- title -->

# yanki-connect

<!-- /title -->

<!-- badges({ npmDownloads: true }) -->

[![NPM Package yanki-connect](https://img.shields.io/npm/v/yanki-connect.svg)](https://www.npmjs.com/package/yanki-connect)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/license/mit)
[![CI](https://github.com/kitschpatrol/yanki-connect/actions/workflows/ci.yml/badge.svg)](https://github.com/kitschpatrol/yanki-connect/actions/workflows/ci.yml)
[![NPM Downloads yanki-connect](https://img.shields.io/npm/dm/yanki-connect)](https://www.npmjs.com/package/yanki-connect)

<!-- /badges -->

<!-- short-description -->

**Fully-typed AnkiConnect API client.**

<!-- /short-description -->

> [!IMPORTANT]
> The latest 26.x versions of Anki-Connect introduce a new [APIv1](https://git.sr.ht/~foosoft/anki-connect/tree/master/API_V1.md) which includes a typed JSON-RPC 2.0 API and other improvements.
>
> A future major version bump to Yanki Connect will introduce support for this new API, but for now Yanki Connect only exposes the "Legacy" (formerly "version 6") API.

## Overview

Yanki Connect exists to streamline development of JavaScript and TypeScript applications that use Alex Yatskov's [AnkiConnect](https://ankiweb.net/shared/info/2055492159) add-on to interface with the [Anki](https://apps.ankiweb.net) spaced repetition flashcard software. The library provides extensive type annotations for the AnkiConnect API, and includes a turn-key client implementation.

The "Y" prefix in "Yanki" is in the "Yet another" naming tradition; a nod to Anki's robust and occasionally duplicative ecosystem of third-party tools. (Also, appropriately, Yankī are a variety of [truant youth](https://commons.wikimedia.org/wiki/File:ヤンキー.jpg).)

This library is used in the [`yanki`](https://github.com/kitschpatrol/yanki) CLI tool, which in turn powers the [`yanki-obsidian`](https://github.com/kitschpatrol/yanki-obsidian) [Obsidian](https://obsidian.md/) plugin.

## Features

- **Action method organization + convenience methods**\
  Instead of putting all <!-- actionCount -->116<!-- /actionCount --> methods in a single namespace, action convenience methods are organized into the same groups used in the [AnkiConnect documentation](https://git.sr.ht/~foosoft/anki-connect/tree/25.11.9.0/item/README.md#supported-actions), to simplify auto-complete discoverability.

- **Low-level access through the provided `invoke` method**\
  If you don't want to use the convenience methods, an `invoke(action, params)` method is also exposed on the YankiConnect class for direct interaction with the AnkiConnect API.

- **Inline documentation and full type annotations**\
  The action method types are annotated with JSDoc-style comments to provide documentation and links in your IDE's auto-complete pop-over.

- **Errors from the API are thrown**\
  Instead of returning an object with `result` and `error` keys, Yanki Connect's convenience methods checks for errors in responses from the AnkiConnect API, and throws them as errors. This gives more convenient access to the result, but means you'll need to do your own error handling.

  _Note that this only applies to the convenience methods (`client.card.*`, etc.) the `invoke(action, params)` method returns the AnkiConnect API's raw `{"result": ..., "error": null}` responses._

- **Anki desktop app auto-launch**\
  Perhaps the most precarious aspect of the AnkiConnect add-on is that the Anki desktop application _must_ be running for any of the API calls to work. Yanki Connect tries to sand down this rough edge by (optionally) automatically launching the Anki desktop app if it's not running already.

  You can enable this behavior by passing a configuration option when the class is instantiated:

  ```ts
  const client = new YankiConnect({ autoLaunch: true })
  ```

  _Warning: This feature is experimental, and is currently only supported in a Node environment on macOS._

## Getting started

### Dependencies

Yanki Connect is universal / isomorphic: it runs in the browser and in Node.js. The exported APIs are ESM-only. It's implemented in TypeScript and bundles extensive type definitions.

- [Node.js](https://nodejs.org/) 20.19.0+
- [Anki desktop app](https://apps.ankiweb.net/) 23.10.0+ (many methods will with 2.1.45+)
- [AnkiConnect add-on](https://ankiweb.net/shared/info/2055492159) 25.11.9.0+ (many methods work with 22.2.19.0+)

The action table below lists the minimum versions for individual actions.

The API calls and types are written against AnkiConnect version [25.11.9.0](https://git.sr.ht/~foosoft/anki-connect/tree/25.11.9.0/item/README.md), released 2025-11-09.

This release requires Anki >=23.10.0. Older AnkiConnect releases can be used when they meet an action's minimum versions in the table below. Each minimum covers the full documented type signature, including every optional parameter and required response field. The chosen AnkiConnect release's own Anki requirement also applies.

### Installation

Add the library to your project:

```sh
npm install yanki-connect
```

Or, a bundled and minified ES module is available on CDNs:

```ts
import { YankiConnect } from 'https://cdn.jsdelivr.net/npm/yanki-connect'
```

or

```ts
import { YankiConnect } from 'https://unpkg.com/yanki-connect'
```

## Usage

Yanki Connect aims to be discoverable and self-documenting when used in an environment with a robust autocompletion / language service implementation. (VS Code, for example.)

The library exports the `YankiConnect` class, which groups methods into the same structure of "supported actions" used in the official [AnkiConnect documentation](https://git.sr.ht/~foosoft/anki-connect/tree/25.11.9.0/item/README.md#supported-actions).

Here's a simple example:

```ts
import { YankiConnect } from 'yanki-connect'

const client = new YankiConnect()

const decks = await client.deck.deckNames()

console.log(decks) // ["Your", "Deck", "Names", "Here"]
```

All <!-- actionCount -->116<!-- /actionCount --> AnkiConnect actions are exposed under their respective groups, with type data for both parameters and return types.

AnkiConnect has accumulated additional methods over the years, some of which require specific minimum versions of Anki for compatibility.

The table below shows all AnkiConnect methods exposed in a YankiConnect client, with the minimum Anki and AnkiConnect versions required to support their full documented type signatures. An action may have existed earlier; its minimum includes later additions to its parameters, response fields, and shared types. AnkiConnect minimums refer to tagged releases, with 22.2.19.0 as the oldest audited tag.

<!-- actionList -->

| Action                                      | Minimum Anki | Minimum Anki-Connect |
| ------------------------------------------- | ------------ | -------------------- |
| `client.card.answerCards`                   | 2.1.45       | 23.10.29.0           |
| `client.card.areDue`                        | 2.1.45       | 22.2.19.0            |
| `client.card.areSuspended`                  | 2.1.45       | 22.2.19.0            |
| `client.card.cardsInfo`                     | 2.1.55       | 24.6.17.0            |
| `client.card.cardsModTime`                  | 2.1.45       | 22.2.19.0            |
| `client.card.cardsToNotes`                  | 2.1.45       | 22.2.19.0            |
| `client.card.findCards`                     | 2.1.45       | 22.2.19.0            |
| `client.card.forgetCards`                   | 2.1.45       | 22.2.19.0            |
| `client.card.getEaseFactors`                | 2.1.45       | 22.2.19.0            |
| `client.card.getIntervals`                  | 2.1.45       | 22.2.19.0            |
| `client.card.relearnCards`                  | 2.1.45       | 22.2.19.0            |
| `client.card.setDueDate`                    | 23.10.0      | 25.2.24.0            |
| `client.card.setEaseFactors`                | 2.1.45       | 22.2.19.0            |
| `client.card.setSpecificValueOfCard`        | 2.1.45       | 22.4.26.0            |
| `client.card.suspend`                       | 2.1.45       | 22.2.19.0            |
| `client.card.suspended`                     | 2.1.45       | 22.2.19.0            |
| `client.card.unsuspend`                     | 2.1.45       | 22.2.19.0            |
| `client.deck.changeDeck`                    | 2.1.45       | 22.2.19.0            |
| `client.deck.cloneDeckConfigId`             | 2.1.45       | 22.2.19.0            |
| `client.deck.createDeck`                    | 2.1.45       | 22.2.19.0            |
| `client.deck.deckNames`                     | 2.1.45       | 22.2.19.0            |
| `client.deck.deckNamesAndIds`               | 2.1.45       | 22.2.19.0            |
| `client.deck.deleteDecks`                   | 2.1.45       | 22.4.26.0            |
| `client.deck.getDeckConfig`                 | 2.1.45       | 22.2.19.0            |
| `client.deck.getDecks`                      | 2.1.45       | 22.2.19.0            |
| `client.deck.getDeckStats`                  | 2.1.47       | 22.7.14.0            |
| `client.deck.removeDeckConfigId`            | 2.1.45       | 22.2.19.0            |
| `client.deck.saveDeckConfig`                | 2.1.45       | 22.2.19.0            |
| `client.deck.setDeckConfigId`               | 2.1.45       | 22.2.19.0            |
| `client.graphical.guiAddCards`              | 23.10.0      | 25.11.5.0            |
| `client.graphical.guiAnswerCard`            | 2.1.45       | 22.2.19.0            |
| `client.graphical.guiBrowse`                | 2.1.45       | 24.1.21.0            |
| `client.graphical.guiCheckDatabase`         | 2.1.45       | 22.2.19.0            |
| `client.graphical.guiCurrentCard`           | 2.1.45       | 22.2.19.0            |
| `client.graphical.guiDeckBrowser`           | 2.1.45       | 22.2.19.0            |
| `client.graphical.guiDeckOverview`          | 2.1.45       | 22.2.19.0            |
| `client.graphical.guiDeckReview`            | 2.1.45       | 22.2.19.0            |
| `client.graphical.guiEditNote`              | 2.1.45       | 22.4.26.0            |
| `client.graphical.guiExitAnki`              | 2.1.45       | 22.2.19.0            |
| `client.graphical.guiImportFile`            | 2.1.52       | 23.10.29.0           |
| `client.graphical.guiPlayAudio`             | 23.10.0      | 25.11.9.0            |
| `client.graphical.guiSelectCard`            | 23.10.0      | 25.2.24.0            |
| `client.graphical.guiSelectedNotes`         | 2.1.45       | 22.2.19.0            |
| `client.graphical.guiSelectNote`            | 2.1.45       | 24.1.21.0            |
| `client.graphical.guiShowAnswer`            | 2.1.45       | 22.2.19.0            |
| `client.graphical.guiShowQuestion`          | 2.1.45       | 22.2.19.0            |
| `client.graphical.guiStartCardTimer`        | 2.1.45       | 22.2.19.0            |
| `client.graphical.guiUndo`                  | 2.1.45       | 23.10.29.0           |
| `client.media.deleteMediaFile`              | 2.1.45       | 22.2.19.0            |
| `client.media.getMediaDirPath`              | 2.1.45       | 23.4.11.0            |
| `client.media.getMediaFilesNames`           | 2.1.45       | 22.2.19.0            |
| `client.media.retrieveMediaFile`            | 2.1.45       | 22.2.19.0            |
| `client.media.storeMediaFile`               | 2.1.45       | 22.2.19.0            |
| `client.miscellaneous.apiReflect`           | 2.1.45       | 22.7.14.0            |
| `client.miscellaneous.exportPackage`        | 2.1.45       | 22.2.19.0            |
| `client.miscellaneous.getActiveProfile`     | 2.1.45       | 24.7.25.0            |
| `client.miscellaneous.getProfiles`          | 2.1.45       | 22.2.19.0            |
| `client.miscellaneous.importPackage`        | 2.1.45       | 22.2.19.0            |
| `client.miscellaneous.loadProfile`          | 2.1.45       | 22.2.19.0            |
| `client.miscellaneous.multi`                | 23.10.0      | 25.11.9.0            |
| `client.miscellaneous.reloadCollection`     | 2.1.45       | 22.2.19.0            |
| `client.miscellaneous.requestPermission`    | 2.1.45       | 22.2.19.0            |
| `client.miscellaneous.sync`                 | 2.1.45       | 22.2.19.0            |
| `client.miscellaneous.version`              | 2.1.45       | 22.2.19.0            |
| `client.model.createModel`                  | 23.10.0      | 22.4.26.0            |
| `client.model.findAndReplaceInModels`       | 2.1.45       | 22.4.26.0            |
| `client.model.findModelsById`               | 23.10.0      | 24.1.21.0            |
| `client.model.findModelsByName`             | 23.10.0      | 24.1.21.0            |
| `client.model.modelFieldAdd`                | 2.1.45       | 22.9.18.0            |
| `client.model.modelFieldDescriptions`       | 2.1.50       | 23.2.5.0             |
| `client.model.modelFieldFonts`              | 2.1.45       | 23.2.5.0             |
| `client.model.modelFieldNames`              | 2.1.45       | 22.2.19.0            |
| `client.model.modelFieldRemove`             | 2.1.45       | 22.9.18.0            |
| `client.model.modelFieldRename`             | 2.1.45       | 22.9.18.0            |
| `client.model.modelFieldReposition`         | 2.1.45       | 22.9.18.0            |
| `client.model.modelFieldSetDescription`     | 2.1.50       | 23.2.5.0             |
| `client.model.modelFieldSetFont`            | 2.1.45       | 23.2.5.0             |
| `client.model.modelFieldSetFontSize`        | 2.1.45       | 23.2.5.0             |
| `client.model.modelFieldsOnTemplates`       | 2.1.45       | 22.2.19.0            |
| `client.model.modelNames`                   | 2.1.45       | 22.2.19.0            |
| `client.model.modelNamesAndIds`             | 2.1.45       | 22.2.19.0            |
| `client.model.modelStyling`                 | 2.1.45       | 22.2.19.0            |
| `client.model.modelTemplateAdd`             | 2.1.45       | 23.10.29.0           |
| `client.model.modelTemplateRemove`          | 2.1.45       | 23.10.29.0           |
| `client.model.modelTemplateRename`          | 2.1.45       | 23.10.29.0           |
| `client.model.modelTemplateReposition`      | 2.1.45       | 23.10.29.0           |
| `client.model.modelTemplates`               | 2.1.45       | 22.2.19.0            |
| `client.model.updateModelStyling`           | 2.1.45       | 22.2.19.0            |
| `client.model.updateModelTemplates`         | 2.1.45       | 22.2.19.0            |
| `client.note.addNote`                       | 23.10.0      | 25.11.5.0            |
| `client.note.addNotes`                      | 23.10.0      | 25.11.5.0            |
| `client.note.addTags`                       | 2.1.45       | 22.2.19.0            |
| `client.note.canAddNotes`                   | 23.10.0      | 25.11.5.0            |
| `client.note.canAddNotesWithErrorDetail`    | 23.10.0      | 25.11.5.0            |
| `client.note.clearUnusedTags`               | 2.1.45       | 22.2.19.0            |
| `client.note.deleteNotes`                   | 2.1.45       | 22.2.19.0            |
| `client.note.findNotes`                     | 2.1.45       | 22.2.19.0            |
| `client.note.getNoteTags`                   | 2.1.45       | 23.4.11.0            |
| `client.note.getTags`                       | 2.1.45       | 22.2.19.0            |
| `client.note.notesInfo`                     | 2.1.45       | 24.7.25.0            |
| `client.note.notesModTime`                  | 2.1.45       | 24.7.25.0            |
| `client.note.removeEmptyNotes`              | 2.1.45       | 22.2.19.0            |
| `client.note.removeTags`                    | 2.1.45       | 22.2.19.0            |
| `client.note.replaceTags`                   | 2.1.45       | 22.2.19.0            |
| `client.note.replaceTagsInAllNotes`         | 2.1.45       | 22.2.19.0            |
| `client.note.updateNote`                    | 23.10.0      | 25.11.5.0            |
| `client.note.updateNoteFields`              | 23.10.0      | 25.11.5.0            |
| `client.note.updateNoteModel`               | 2.1.45       | 24.6.17.0            |
| `client.note.updateNoteTags`                | 2.1.45       | 23.4.11.0            |
| `client.statistic.cardReviews`              | 2.1.45       | 22.2.19.0            |
| `client.statistic.getCollectionStatsHTML`   | 2.1.45       | 22.2.19.0            |
| `client.statistic.getLatestReviewID`        | 2.1.45       | 22.2.19.0            |
| `client.statistic.getNumCardsReviewedByDay` | 2.1.45       | 22.2.19.0            |
| `client.statistic.getNumCardsReviewedToday` | 2.1.45       | 22.2.19.0            |
| `client.statistic.getReviewsOfCards`        | 2.1.45       | 23.2.5.0             |
| `client.statistic.insertReviews`            | 2.1.45       | 22.2.19.0            |

<!-- /actionList -->

Only the "legacy" AnkiConnect API version 6 is supported. The minimums include `guiBrowse.reorderCards`, optional note-media `fields`, the complete model schema, and all required card, note, and deck-statistics response fields. `multi` inherits the minimums needed for every action allowed by its nested request types. AnkiConnect 25.11.9.0 with Anki >=23.10.0 provides all documented signatures; newer AnkiConnect releases can require a newer Anki version. These minimums are based on upstream source and schema history; the integration tests currently cover AnkiConnect 25.11.9.0 and 26.10.12.0.

### API

#### Configuration

The `YankiConnect` class features sensible defaults that should work fine for most configurations of AnkiConnect, but if you'd like to customize the client, you can pass an argument of type `YankiConnectOptions` with any of the following:

<!-- optionsTable -->

| Key            | Type                             | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Default              |
| -------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `autoLaunch`   | `'immediately' \| boolean`       | Attempt to open the desktop Anki.app if it's not already running.<ul><li>`true` will always attempt to open Anki _when a request is made_. This might introduce significant latency on the first launch.</li><li>`false` will never attempt to open Anki. Requests will fail until something or someone else opens the Anki app.</li><li>`immediately` is a special option that will open Anki when the client is instantiated.</li></ul>The Anki desktop app must be running for the client and the underlying AnkiConnect service to work.<br><br>Currently supported on macOS only.<br><br>The client does not attempt to close the app. | `false`              |
| `fetchAdapter` | `undefined \| YankiFetchAdapter` | Advanced option to customize the resource fetch implementation used to make requests to AnkiConnect.<br><br>Note that the signature reflects the subset of the built-in Fetch interface that's actually used by yanki-connect.<br><br>The exact signature of this option is subject to change in the future.                                                                                                                                                                                                                                                                                                                                | `fetch`              |
| `host`         | `string`                         | Host where the AnkiConnect service is running.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `'http://127.0.0.1'` |
| `key`          | `string \| undefined`            | AnkiConnect security key (optional)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `undefined`          |
| `port`         | `number`                         | Port where the AnkiConnect service is running.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `8765`               |
| `version`      | `AnkiConnectVersion`             | AnkiConnect API version.<br><br>Only API version 6 is supported for now.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `6`                  |

<!-- /optionsTable -->

### Bundling for the browser

If you're using a build tool like [Vite](https://vite.dev/) to include Yanki Connect in your browser-based project, you'll need to externalize Node-specific dependencies.

Add the following to your Vite config:

```ts
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    minify: false,
    rollupOptions: {
      external: ['open'],
    },
  },
})
```

### Examples

#### Creating a note

```ts
import { YankiConnect } from 'yanki-connect'

const client = new YankiConnect()

// Assumes 'Default' deck and 'Basic' model exist!
const note = {
  note: {
    deckName: 'Default',
    fields: {
      Back: "<p>I'm the back of the card</p>\n",
      Front: "<p>I'm the front of the card</p>\n",
    },
    modelName: 'Basic',
    tags: ['yanki'],
  },
}

const noteId = await client.note.addNote(note)

console.log(noteId) // E.g. 1716968687679
```

#### Listing decks

```ts
import { YankiConnect } from 'yanki-connect'

const client = new YankiConnect()
const decks = await client.deck.deckNames()
console.log(decks) // ["Your", "Deck", "Names", "Here"]
```

#### Direct invocation

```ts
import { YankiConnect } from 'yanki-connect'

const client = new YankiConnect()
const decks = await client.invoke('deckNames')
console.log(decks) // ["Your", "Deck", "Names", "Here"]
```

## Background

### Similar projects

Chen Lijun's [autoanki](https://github.com/chenlijun99/autoanki) also implements a nicely typed AnkiConnect wrapper.

## Maintainers

[kitschpatrol](https://github.com/kitschpatrol)

## Acknowledgments

Thanks to [Alex Yatskov](https://foosoft.net/) for creating [AnkiConnect](https://ankiweb.net/shared/info/2055492159).

All of the embedded action descriptions in Yanki Connect are taken directly from the [AnkiConnect project readme](https://git.sr.ht/~foosoft/anki-connect/tree/25.11.9.0/item/README.md).

<!-- contributing -->

## Contributing

[Issues](https://github.com/kitschpatrol/yanki-connect/issues) are welcome and appreciated.

Please open an issue to discuss changes before submitting a pull request. Unsolicited PRs (especially AI-generated ones) are unlikely to be merged.

This repository uses [@kitschpatrol/shared-config](https://github.com/kitschpatrol/shared-config) (via its `ksc` CLI) for linting and formatting, plus [MDAT](https://github.com/kitschpatrol/mdat) for readme placeholder expansion.

<!-- /contributing -->

### Testing

With Anki installed, `pnpm test` runs the Node and Chromium tests against both bundled AnkiConnect fixtures, one version at a time. Set `ANKI_CONNECT_VERSION` to `25.11.9.0` or `26.10.12.0` to test a single version, for example `ANKI_CONNECT_VERSION=26.10.12.0 pnpm test`. Vitest arguments can be passed through, such as `pnpm test --project node`.

Each convenience action in `src/client.ts` documents its requirements with `@minimumAnki` and `@minimumAnkiConnect` JSDoc tags, plus an `@see` link to the upstream release source. The `actionList` mdat rule reads these tags to generate the table above. When adding or changing an action's types, verify full support for every parameter, optional feature, required response field, and referenced shared type against upstream history, then update both tags. A shared type change can raise the minimums of multiple actions. Missing, duplicate, or malformed minimum-version tags fail generation.

`pnpm coverage` also tests both versions and writes separate reports to `coverage/<version>/`. CI tests each fixture on Linux, macOS, and Windows.

The [Compatibility workflow](https://github.com/kitschpatrol/yanki-connect/actions/workflows/compatibility.yml) verifies the minimum-version tags empirically. Run it manually from the Actions tab. It installs every Anki release with a Linux build (2.1.15 onward), launches each one with every AnkiConnect release since 22.2.19.0 in a fresh profile, and runs every action end-to-end with its full documented parameters, type-checking each response against the declared result type. An action counts as supported in a combination only when all of that succeeds. The `report` job uploads a `compatibility` artifact containing `compatibility.json` (the full per-action, per-combination table), `summary.md`, and `compatibility-prompt.md`, a prompt that describes each mismatch for an LLM or a person to reconcile the source with the results. The job fails when any documented minimum differs from the empirical one. The workflow inputs accept comma-separated Anki and AnkiConnect versions to test a subset. The scripts live in `scripts/compatibility/` and exercise the built package, so run `pnpm build` first; `node scripts/compatibility/probe.ts` then probes whatever AnkiConnect is listening locally.

<!-- license -->

## License

[MIT](license.txt) © [Eric Mika](https://ericmika.com)

<!-- /license -->
