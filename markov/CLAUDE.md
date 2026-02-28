# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A browser-based Markov chain text generator with three tokenization modes (Words, Text, GPT). No build system, no bundler, no package manager — plain vanilla JS loaded via `<script>` tags in `index.html`.

## Development

Open `index.html` directly in a browser. No build or install step. jQuery 3.7.1 and gpt-tokenizer are loaded from CDNs.

## Architecture

All JS uses constructor functions (not ES modules or classes). Scripts are loaded in dependency order in `index.html`:

1. **`js/markov.js`** — Core engine. `Markov(tokens, maxN)` builds adaptive n-gram transition maps and generates token sequences. Uses `MarkovConstants.Start`/`End` (`<`/`>`) as sequence delimiters. Tokens are stored as pipe-delimited string keys.
2. **`js/tokenize.js`** — Shared tokenization utilities. `Tokenize.splitIntoWordTokens(text)` is the core pipeline used by both Words and Text tokenizers (paired punctuation removal → whitespace split → punctuation separation).
3. **`js/words.js`** — Character-level tokenizer (`Words`). Wraps each word with Start/End markers for character-by-character generation.
4. **`js/text.js`** — Word-level tokenizer (`Text`). Splits by paragraphs, wraps each with markers for word-by-word generation.
5. **`js/gpt.js`** — BPE token-level tokenizer (`Gpt`). Uses `window.gptTokenizer` (cl100k_base).
6. **`js/tweet-cleaner.js`** — `extractTweetBodies()` strips tweet metadata from pasted text.
7. **`js/index.js`** — UI controller. Instantiates tokenizers, wires jQuery event handlers, coordinates calculate/generate flow.

Each tokenizer exposes `.tokenize(text)` → array of token groups and `.format(groups)` → string.

## Key Design Decisions

- **Adaptive n-grams**: Unlike fixed-size Markov chains, all prefix lengths 1–N are generated and frequency-weighted at each step.
- **No module system**: Global constructors/functions; load order in HTML matters.
- **n-gram key format**: Multi-token prefixes/suffixes are joined with `|` for use as object keys.
