<!--+ Warning: Content inside HTML comment blocks was generated by mdat and may be overwritten. +-->

<!-- title -->

# yanki-connect

<!-- /title -->

<!-- badges -->

[![NPM Package yanki-connect](https://img.shields.io/npm/v/yanki-connect.svg)](https://npmjs.com/package/yanki-connect)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

<!-- /badges -->

<!-- short-description -->

**A fully-typed Anki-Connect API client.**

<!-- /short-description -->

## Overview

Yanki Connect exists to streamline development of JavaScript and TypeScript applications that use Alex Yatskov's [Anki-Connect](https://git.foosoft.net/alex/anki-connect/src/branch/master/README.md#supported-actions) to interface with the [Anki](https://apps.ankiweb.net) spaced repetition flashcard software. The library provides extensive type annotations for the Anki-Connect API, and includes a turn-key client implementation.

The "Y" prefix in "Yanki" is in the "Yet another" naming tradition; a nod to Anki's robust and occasionally duplicative ecosystem of third-party tools. (Also, appropriately, Yankī are a variety of [truant youth](https://en.wikipedia.org/wiki/Yankee#/media/File:ヤンキー.jpg).)

This library is used in the [`yanki`](https://github.com/kitschpatrol/yanki) CLI tool, which in turn powers the [`yanki-obsidian`](https://github.com/kitschpatrol/yanki-obsidian) plugin.

## Features

- **Action method organization + convenience methods**\
  Instead of putting 100+ methods in a single namespace, action convenience methods are organized into the same groups used in the [Anki-Connect documentation](https://git.foosoft.net/alex/anki-connect/src/branch/master/README.md), to simplify auto-complete discoverability.

- **Low-level access through the provided `invoke` method**\
  If you don't want to use the convenience methods, an `invoke(action, params)` method is also exposed on the YankiConnect class for direct interaction with the Anki-Connect API.

- **Inline documentation and full type annotations**\
  The action method types are annotated with JSDoc-style comments to provide documentation and links in your IDE's auto-complete pop-over.

- **Errors from the API are thrown**\
  Instead of returning an object with `result` and `error` keys, Yanki Connect's convenience methods checks for errors in responses from the Anki-Connect API, and throws them as errors. This gives more convenient access to the result, but means you'll need to do your own error handling.

  _Note that this only applies to the convenience methods (`client.card.*`, etc.) the `invoke(action, params)` method returns the Anki-Connect API's raw `{"result": ..., "error": null}` responses._

- **Anki desktop app auto-launch**\
  Perhaps the most precarious aspect of the Anki-Connect add-on is that the Anki desktop application _must_ be running for any of the API calls to work. Yanki Connect tries to sand down this rough edge by (optionally) automatically launching the Anki desktop app if it's not running already.

  You can enable this behavior by passing a configuration option when the class is instantiated:

  ```ts
  const client = new YankiConnect({ autoLaunch: true })
  ```

  _Warning: This feature is experimental, and is currently only supported in a Node environment on macOS._

## Getting started

### Dependencies

Yanki Connect is isomorphic: it runs in the browser and Node 18+ compatible environments (specifically Node `^18.19.0 || >=20.5.0`). The exported APIs are ESM-only. It's implemented in TypeScript and bundles extensive type definitions.

The Anki desktop app with the Anki-Connect add-on installed and configured is also required to do anything useful with the library.

### Installation

Add the library to your project:

```sh
npm install yanki-connect
```

## Usage

Yanki Connect strives to be discoverable and self-documenting when used in an environment with a robust autocompletion / language service implementation. (VS Code, for example.)

The library exports the `YankiConnect` class, which groups methods into the same structure of "supported actions" used in the official [Anki-Connect documentation](https://git.foosoft.net/alex/anki-connect#supported-actions).

Here's a simple example:

```ts
import { YankiConnect } from 'yanki-connect'

const client = new YankiConnect()

const decks = await client.deck.deckNames()

console.log(decks) // ["Your", "Deck", "Names", "Here"]
```

All 113 Anki-Connect actions are exposed under their respective groups, with type data for both parameters and return types:

```ts
client.card
client.deck
client.graphical
client.media
client.miscellaneous
client.model
client.note
client.statistic
```

Note that at the moment, only the latest Anki-Connect API version 6 is supported, and Anki-Connect release >24.7.25.0 is required for compatibility with all features.

### API

#### Configuration

The `YankiConnect` class features sensible defaults that should work fine for most configurations of Anki-Connect, but if you'd like to customize the client, you can pass an argument of type `YankiConnectOptions` with any of the following:

| Key          | Type                       | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Default              |
| ------------ | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `host`       | `string`                   | Host where the Anki-Connect service is running.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `'http://127.0.0.1'` |
| `port`       | `number`                   | Port where the Anki-Connect service is running.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `8765`               |
| `version`    | `AnkiConnectVersion`       | Anki-Connect API version. Only API version 6 is supported.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `6`                  |
| `key`        | `string`                   | Anki-Connect security key. Usually not required.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `undefined`          |
| `autoLaunch` | `boolean \| 'immediately'` | Attempt to launch the Anki desktop application if it's not already running.<br><ul><li>`true` will always attempt to open Anki _when a request is made_. This might introduce significant latency on the first launch.</li><li>`false` will never attempt to open Anki. Requests will fail until something or someone opens the Anki app.</li><li>`'immediately'` is a special option that will open Anki when the client is instantiated.</li></ul>The Anki desktop app must be running for the client and the underlying Anki-Connect service to work.<br><br>Currently supported on macOS only. | `false`              |

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

Chen Lijun's [autoanki](https://github.com/chenlijun99/autoanki) also implements a nicely typed Anki-Connect wrapper.

## Maintainers

[@kitschpatrol](https://github.com/kitschpatrol)

## Acknowledgments

Thanks to Alex Yatskov for creating [Anki-Connect](https://foosoft.net/projects/anki-connect/).

All of the embedded action descriptions in Yanki Connect are directly from the [Anki-Connect project readme](https://git.foosoft.net/alex/anki-connect/src/branch/master/README.md).

<!-- contributing -->

## Contributing

[Issues](https://github.com/kitschpatrol/yanki-connect/issues) and pull requests are welcome.

<!-- /contributing -->

<!-- license -->

## License

[MIT](license.txt) © Eric Mika

<!-- /license -->
