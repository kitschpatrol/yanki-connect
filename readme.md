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
> The latest 26.x versions of Anki-Connect introduce a new [APIv1](https://git.sr.ht/~foosoft/anki-connect/tree/26.11.22.0/item/API_V1.md), which is meant to supersede the "version 6" API Yanki Connect currently supports.
>
> A future version of Yanki Connect might introduce support for this new API, but for now please note that Yanki Connect only exposes the now "Legacy" version 6 API.

## Overview

Yanki Connect exists to streamline development of JavaScript and TypeScript applications that use Alex Yatskov's [AnkiConnect](https://ankiweb.net/shared/info/2055492159) add-on to interface with the [Anki](https://apps.ankiweb.net) spaced repetition flashcard software.

The library provides extensive type annotations for the AnkiConnect API, and includes a turn-key client implementation.

This library is used in the [`yanki`](https://github.com/kitschpatrol/yanki) CLI tool, which in turn powers the [`yanki-obsidian`](https://github.com/kitschpatrol/yanki-obsidian) [Obsidian](https://obsidian.md/) plugin. It's also used by a number of Anki MCP server projects.

The "Y" prefix in "Yanki" is in the "Yet another" naming tradition; a nod to Anki's robust and occasionally duplicative ecosystem of third-party tools. (Also, appropriately, Yankī are a variety of [truant youth](https://commons.wikimedia.org/wiki/File:ヤンキー.jpg).)

## Features

- **Action method organization + convenience methods**\
  Instead of putting all <!-- actionCount -->122<!-- /actionCount --> methods in a single namespace, action convenience methods are organized into the same groups used in the [AnkiConnect documentation](https://git.sr.ht/~foosoft/anki-connect/tree/26.11.22.0/item/API_LEGACY.md#action-reference), to simplify auto-complete discoverability.

- **Low-level access through the provided `invoke` method**\
  If you don't want to use the convenience methods, an `invoke(action, params)` method is also exposed on the YankiConnect class for direct interaction with the AnkiConnect API.

- **Inline documentation and full type annotations**\
  The action method types are annotated with JSDoc-style comments to provide documentation and links in your IDE's auto-complete pop-over.

- **Errors from the API are thrown**\
  Instead of returning an object with `result` and `error` keys, Yanki Connect's convenience methods checks for errors in responses from the AnkiConnect API, and throws them as errors. This gives more convenient access to the result, but means you'll need to do your own error handling.

  _Note that this only applies to the convenience methods (`client.card.*`, etc.) the `invoke(action, params)` method returns the AnkiConnect API's raw `{"result": ..., "error": null}` responses._

- **Distinct error when Anki can't be reached**\
  If a request can't reach AnkiConnect at all, for example because the Anki app isn't running, both the convenience methods and `invoke` throw an `AnkiConnectUnreachableError`. It extends `TypeError` and keeps the `message` and `cause` of the underlying fetch error, so you can check for it without matching platform-specific error messages:

  ```ts
  import { AnkiConnectUnreachableError, YankiConnect } from 'yanki-connect'

  const client = new YankiConnect()

  try {
    await client.deck.deckNames()
  } catch (error) {
    if (error instanceof AnkiConnectUnreachableError) {
      console.error('Is Anki running?')
    }
  }
  ```

- **Anki desktop app auto-launch**\
  Perhaps the most precarious aspect of the AnkiConnect add-on is that the Anki desktop application _must_ be running for any of the API calls to work. Yanki Connect tries to sand down this rough edge by (optionally) automatically launching the Anki desktop app if it's not running already.

  You can enable this behavior by passing a configuration option when the class is instantiated:

  ```ts
  const client = new YankiConnect({ autoLaunch: true })
  ```

  _Warning: This feature is experimental, and is currently only supported in a Node environment on macOS._

## Getting started

### Dependencies

Yanki Connect runs in either Node.js or a browser and provides ESM exports with TypeScript definitions.

- [Anki desktop app](https://apps.ankiweb.net/) 2.1.15+\
  _23.10.0+ recommended for full API support_
- [AnkiConnect add-on](https://ankiweb.net/shared/info/2055492159) 22.2.19.0+\
  _26.11.22.0+ recommended for full API support_
- **Browsers:** builds target Chrome 100+, Firefox 110+, and Safari 18+\
  _Older versions may work but are not verified_

<!-- dependencies({ heading: false }) -->

- [Node.js](https://nodejs.org/) 22.12.0 or newer (specifically `^22.12.0 || ^24.0.0 || >=26.0.0`)

<!-- /dependencies -->

The exact version / API compatibility story across different versions of the Anki desktop app and AnkiConnect is complex and honestly a bit of a mess. Test-driven derivations of version compatibility are shown in the action table below.

<!-- install -->

### Installation

Add it to your project:

```sh
npm install yanki-connect
```

<!-- /install -->

## Usage

Yanki Connect aims to be discoverable and self-documenting when used in an environment with a robust autocompletion / language service implementation. (VS Code, for example.)

The library exports the `YankiConnect` class, which groups methods into the same structure of "supported actions" used in the official [AnkiConnect documentation](https://git.sr.ht/~foosoft/anki-connect/tree/26.11.22.0/item/API_LEGACY.md#action-reference).

Here's a simple example:

```ts
import { YankiConnect } from 'yanki-connect'

const client = new YankiConnect()

const decks = await client.deck.deckNames()

console.log(decks) // ["Your", "Deck", "Names", "Here"]
```

### Actions

All <!-- actionCount -->122<!-- /actionCount --> AnkiConnect actions are exposed under their respective groups, with type data for both parameters and return types.

AnkiConnect has accumulated additional methods over the years, some of which require specific minimum versions of Anki for compatibility.

The table below shows all AnkiConnect methods exposed in a YankiConnect client, with the minimum Anki and AnkiConnect versions that support each action. Parameters and response fields added in later releases are optional in the types and name their release in their documentation, so they do not raise an action's minimum, but check the JSDoc annotation for version-specific caveats.

A range in the AnkiConnect column marks an action that a later release either broke or removed.

AnkiConnect 26.11.22.0 loads on every Anki release from 2.1.15, while releases from 22.4.26.0 through 26.11.19.1 need Anki 2.1.45 or later. With 26.11.22.0, most actions also work on Anki 2.1.20 and later where the table lists a later minimum Anki, because the table pairs each minimum Anki with the oldest AnkiConnect release that supports the action. On the Linux build of Anki 2.1.15, 26.11.22.0 fails nearly every action, because that build lacks Python's `concurrent` package.

<!-- actionList -->

| Action                                      | Minimum Anki | Minimum Anki-Connect   |
| ------------------------------------------- | ------------ | ---------------------- |
| `client.card.answerCards`                   | 2.1.45       | 23.10.29.0             |
| `client.card.areDue`                        | 2.1.15       | 22.2.19.0              |
| `client.card.areSuspended`                  | 2.1.15       | 22.2.19.0              |
| `client.card.cardsInfo`                     | 2.1.55       | 23.2.5.0               |
| `client.card.cardsModTime`                  | 2.1.45       | 23.2.5.0               |
| `client.card.cardsToNotes`                  | 2.1.15       | 22.2.19.0              |
| `client.card.findCards`                     | 2.1.15       | 22.2.19.0              |
| `client.card.forgetCards`                   | 2.1.15       | 22.2.19.0              |
| `client.card.getEaseFactors`                | 2.1.15       | 22.2.19.0              |
| `client.card.getIntervals`                  | 2.1.15       | 22.2.19.0              |
| `client.card.relearnCards`                  | 2.1.45       | 22.2.19.0              |
| `client.card.setDueDate`                    | 23.10.0      | 25.2.24.0              |
| `client.card.setEaseFactors`                | 2.1.15       | 22.2.19.0              |
| `client.card.setSpecificValueOfCard`        | 2.1.45       | 22.4.26.0              |
| `client.card.suspend`                       | 2.1.15       | 22.2.19.0              |
| `client.card.suspended`                     | 2.1.15       | 22.2.19.0              |
| `client.card.unsuspend`                     | 2.1.15       | 22.2.19.0              |
| `client.deck.changeDeck`                    | 2.1.15       | 22.2.19.0              |
| `client.deck.cloneDeckConfigId`             | 2.1.24       | 22.2.19.0              |
| `client.deck.createDeck`                    | 2.1.20       | 22.2.19.0              |
| `client.deck.deckNameFromId`                | 2.1.15       | 22.2.19.0              |
| `client.deck.deckNames`                     | 2.1.20       | 22.2.19.0              |
| `client.deck.deckNamesAndIds`               | 2.1.20       | 22.2.19.0              |
| `client.deck.deleteDecks`                   | 2.1.45       | 22.4.26.0              |
| `client.deck.getDeckConfig`                 | 2.1.28       | 22.2.19.0              |
| `client.deck.getDecks`                      | 2.1.15       | 22.2.19.0              |
| `client.deck.getDeckStats`                  | 2.1.47       | 22.7.14.0              |
| `client.deck.removeDeckConfigId`            | 2.1.24       | 22.2.19.0              |
| `client.deck.saveDeckConfig`                | 2.1.28       | 22.2.19.0              |
| `client.deck.setDeckConfigId`               | 2.1.24       | 22.2.19.0              |
| `client.graphical.guiAddCards`              | 2.1.20       | 22.2.19.0              |
| `client.graphical.guiAddNoteSetData`        | 26.08.0      | 26.10.11.0             |
| `client.graphical.guiAnswerCard`            | 2.1.15       | 22.2.19.0              |
| `client.graphical.guiBrowse`                | 2.1.15       | 22.2.19.0              |
| `client.graphical.guiCheckDatabase`         | 2.1.20       | 22.2.19.0              |
| `client.graphical.guiCurrentCard`           | 2.1.15       | 22.2.19.0              |
| `client.graphical.guiDeckBrowser`           | 2.1.20       | 22.2.19.0              |
| `client.graphical.guiDeckOverview`          | 2.1.20       | 22.2.19.0              |
| `client.graphical.guiDeckReview`            | 2.1.15       | 22.2.19.0              |
| `client.graphical.guiEditNote`              | 26.08.0      | 26.10.11.0             |
| `client.graphical.guiExitAnki`              | 2.1.15       | 22.2.19.0              |
| `client.graphical.guiImportFile`            | 23.10.0      | 23.10.29.0             |
| `client.graphical.guiPlayAudio`             | 23.10.0      | 25.11.9.0              |
| `client.graphical.guiReviewActive`          | 2.1.20       | 22.2.19.0              |
| `client.graphical.guiSelectCard`            | 23.10.0      | 25.2.24.0              |
| `client.graphical.guiSelectedNotes`         | 2.1.15       | 22.2.19.0              |
| `client.graphical.guiSelectNote`            | 2.1.45       | 24.1.21.0              |
| `client.graphical.guiShowAnswer`            | 2.1.15       | 22.2.19.0              |
| `client.graphical.guiShowQuestion`          | 2.1.15       | 22.2.19.0              |
| `client.graphical.guiStartCardTimer`        | 2.1.20       | 22.2.19.0              |
| `client.graphical.guiUndo`                  | 2.1.45       | 23.10.29.0             |
| `client.media.deleteMediaFile`              | 2.1.20       | 22.2.19.0              |
| `client.media.getMediaDirPath`              | 2.1.45       | 23.4.11.0              |
| `client.media.getMediaFilesNames`           | 2.1.20       | 22.2.19.0              |
| `client.media.retrieveMediaFile`            | 2.1.20       | 22.2.19.0              |
| `client.media.storeMediaFile`               | 2.1.20       | 22.2.19.0              |
| `client.miscellaneous.apiReflect`           | 2.1.45       | 22.7.14.0              |
| `client.miscellaneous.exportPackage`        | 2.1.20       | 22.2.19.0              |
| `client.miscellaneous.getActiveProfile`     | 2.1.50       | 24.7.25.0              |
| `client.miscellaneous.getProfiles`          | 2.1.15       | 22.2.19.0              |
| `client.miscellaneous.importPackage`        | 2.1.15       | 22.2.19.0              |
| `client.miscellaneous.loadProfile`          | 2.1.15       | 22.2.19.0              |
| `client.miscellaneous.multi`                | 2.1.15       | 22.2.19.0              |
| `client.miscellaneous.reloadCollection`     | 2.1.20       | 22.2.19.0              |
| `client.miscellaneous.requestPermission`    | 2.1.15       | 22.2.19.0              |
| `client.miscellaneous.sync`                 | 2.1.45       | 22.2.19.0              |
| `client.miscellaneous.version`              | 2.1.15       | 22.2.19.0              |
| `client.model.createModel`                  | 23.10.0      | 22.4.26.0              |
| `client.model.findAndReplaceInModels`       | 2.1.45       | 22.4.26.0              |
| `client.model.findModelsById`               | 23.10.0      | 24.1.21.0              |
| `client.model.findModelsByName`             | 23.10.0      | 24.1.21.0              |
| `client.model.modelFieldAdd`                | 2.1.45       | 22.9.18.0              |
| `client.model.modelFieldDescriptions`       | 2.1.50       | 23.2.5.0               |
| `client.model.modelFieldFonts`              | 2.1.45       | 23.2.5.0               |
| `client.model.modelFieldNames`              | 2.1.20       | 22.2.19.0              |
| `client.model.modelFieldRemove`             | 2.1.45       | 22.9.18.0              |
| `client.model.modelFieldRename`             | 2.1.45       | 22.9.18.0              |
| `client.model.modelFieldReposition`         | 2.1.45       | 22.9.18.0              |
| `client.model.modelFieldSetDescription`     | 2.1.50       | 23.2.5.0               |
| `client.model.modelFieldSetFont`            | 2.1.45       | 23.2.5.0               |
| `client.model.modelFieldSetFontSize`        | 2.1.45       | 23.2.5.0               |
| `client.model.modelFieldsOnTemplates`       | 2.1.20       | 22.2.19.0              |
| `client.model.modelNameFromId`              | 2.1.15       | 22.2.19.0              |
| `client.model.modelNames`                   | 2.1.20       | 22.2.19.0              |
| `client.model.modelNamesAndIds`             | 2.1.20       | 22.2.19.0              |
| `client.model.modelStyling`                 | 2.1.20       | 22.2.19.0              |
| `client.model.modelTemplateAdd`             | 2.1.45       | 23.10.29.0             |
| `client.model.modelTemplateRemove`          | 2.1.45       | 23.10.29.0             |
| `client.model.modelTemplateRename`          | 2.1.45       | 23.10.29.0             |
| `client.model.modelTemplateReposition`      | 2.1.45       | 23.10.29.0             |
| `client.model.modelTemplates`               | 2.1.20       | 22.2.19.0              |
| `client.model.updateModelStyling`           | 2.1.20       | 22.2.19.0              |
| `client.model.updateModelTemplates`         | 2.1.20       | 22.2.19.0              |
| `client.note.addNote`                       | 2.1.20       | 22.2.19.0              |
| `client.note.addNotes`                      | 2.1.20       | 22.2.19.0              |
| `client.note.addTags`                       | 2.1.15       | 22.2.19.0              |
| `client.note.canAddNote`                    | 2.1.20       | 22.2.19.0              |
| `client.note.canAddNotes`                   | 2.1.20       | 22.2.19.0              |
| `client.note.canAddNotesWithErrorDetail`    | 2.1.50       | 24.2.26.0              |
| `client.note.canAddNoteWithErrorDetail`     | 2.1.50       | 24.2.26.0              |
| `client.note.clearUnusedTags`               | 2.1.20       | 22.2.19.0              |
| `client.note.deleteNotes`                   | 2.1.20       | 22.2.19.0              |
| `client.note.findNotes`                     | 2.1.15       | 22.2.19.0              |
| `client.note.getNoteTags`                   | 2.1.45       | 23.4.11.0              |
| `client.note.getTags`                       | 2.1.20       | 22.2.19.0              |
| `client.note.notesInfo`                     | 2.1.45       | 23.2.5.0               |
| `client.note.notesModTime`                  | 2.1.50       | 24.7.25.0              |
| `client.note.removeEmptyNotes`              | 2.1.15       | 22.2.19.0 to 25.11.9.0 |
| `client.note.removeTags`                    | 2.1.15       | 22.2.19.0              |
| `client.note.replaceTags`                   | 2.1.15       | 22.2.19.0              |
| `client.note.replaceTagsInAllNotes`         | 2.1.15       | 22.2.19.0              |
| `client.note.updateNote`                    | 2.1.45       | 23.4.11.0              |
| `client.note.updateNoteFields`              | 2.1.15       | 22.2.19.0              |
| `client.note.updateNoteModel`               | 2.1.50       | 24.6.17.0              |
| `client.note.updateNoteTags`                | 2.1.45       | 23.4.11.0              |
| `client.statistic.cardReviews`              | 2.1.15       | 22.2.19.0              |
| `client.statistic.getCollectionStatsHTML`   | 2.1.20       | 22.2.19.0              |
| `client.statistic.getLatestReviewID`        | 2.1.20       | 22.2.19.0              |
| `client.statistic.getNumCardsReviewedByDay` | 2.1.15       | 22.2.19.0              |
| `client.statistic.getNumCardsReviewedToday` | 2.1.15       | 22.2.19.0              |
| `client.statistic.getReviewsOfCards`        | 2.1.45       | 23.2.5.0               |
| `client.statistic.insertReviews`            | 2.1.15       | 22.2.19.0              |

<!-- /actionList -->

Only the "legacy" AnkiConnect API version 6 is currently supported.

### Options

The `YankiConnect` class features sensible defaults that should work fine for most configurations of AnkiConnect, but if you'd like to customize the client, you can pass an argument of type `YankiConnectOptions` with any of the following:

<!-- optionsTable -->

| Key            | Type                             | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Default              |
| -------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `autoLaunch`   | `'immediately' \| boolean`       | Attempt to open the desktop Anki.app if it's not already running.<ul><li>`true` will always attempt to open Anki _when a request is made_. This might introduce significant latency on the first launch. If Anki still can't be reached after repeated launch attempts, the request throws an `AnkiConnectUnreachableError`.</li><li>`false` will never attempt to open Anki. Requests will fail until something or someone else opens the Anki app.</li><li>`immediately` is a special option that will open Anki when the client is instantiated.</li></ul>The Anki desktop app must be running for the client and the underlying AnkiConnect service to work.<br><br>Currently supported on macOS only.<br><br>The client does not attempt to close the app. | `false`              |
| `fetchAdapter` | `undefined \| YankiFetchAdapter` | Advanced option to customize the resource fetch implementation used to make requests to AnkiConnect.<br><br>Note that the signature reflects the subset of the built-in Fetch interface that's actually used by yanki-connect.<br><br>The exact signature of this option is subject to change in the future.                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `fetch`              |
| `host`         | `string`                         | Host where the AnkiConnect service is running.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `'http://127.0.0.1'` |
| `key`          | `string \| undefined`            | AnkiConnect security key (optional)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `undefined`          |
| `port`         | `number`                         | Port where the AnkiConnect service is running.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `8765`               |
| `version`      | `AnkiConnectVersion`             | AnkiConnect API version.<br><br>Only API version 6 is supported for now.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `6`                  |

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

Most of the embedded action descriptions in Yanki Connect are taken from the [AnkiConnect legacy API reference](https://git.sr.ht/~foosoft/anki-connect/tree/26.11.22.0/item/API_LEGACY.md) and its predecessor, the [AnkiConnect 25.11.9.0 readme](https://git.sr.ht/~foosoft/anki-connect/tree/25.11.9.0/item/README.md). Notes on version-specific behavior are Yanki Connect's own.

## Testing

`pnpm test` runs the Node.js and Chromium suites against pinned AnkiConnect `25.11.9.0`, `26.10.14.0`, and `26.11.22.0` fixtures. The tests launch Anki with temporary copies of the test profiles and exercise every legacy action, including the version-specific behavior. Anki must be installed; the test runner closes running Anki instances. CI runs each fixture on Linux, macOS, and Windows, using Anki `25.9.2`, `26.8`, and `26.9.4`, respectively.

To run only the November release:

```sh
ANKI_CONNECT_VERSION=26.11.22.0 pnpm test
```

The broader compatibility workflow runs monthly and on demand, discovering upstream release tags automatically.

<!-- contributing -->

## Contributing

[Issues](https://github.com/kitschpatrol/yanki-connect/issues) are welcome and appreciated.

Please open an issue to discuss changes before submitting a pull request. Unsolicited PRs are unlikely to be merged.

This repository uses [ksc](https://github.com/kitschpatrol/shared-config) to handle linting and formatting with the usual tools, plus [mdat](https://github.com/kitschpatrol/mdat) for readme placeholder expansion, and [chagent](https://github.com/kitschpatrol/chagent) to maintain the [changelog](changelog.md).

<!-- /contributing -->

<!-- license -->

## License

[MIT](license.txt) © [Eric Mika](https://ericmika.com)

<!-- /license -->
