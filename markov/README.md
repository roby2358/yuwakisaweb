# Markov Chain Text Generator

A web-based Markov chain text generator that creates new text by learning patterns from source text. This implementation features an adaptive n-gram approach that dynamically selects prefix lengths based on frequency, rather than using fixed-size n-grams.

## Features

- **Two Generation Modes:**
  - **Words Mode**: Generates individual words character-by-character using adaptive n-grams (1-N tokens)
  - **Text Mode**: Generates flowing paragraphs word-by-word with paragraph-aware boundaries

- **Intelligent Punctuation Handling:**
  - Removes paired punctuation (quotes, brackets) to avoid pairing errors
  - Properly separates and formats unpaired punctuation (periods, commas, dashes)
  - Preserves dash sequences (e.g., `--`) as single tokens

- **Adaptive N-gram Generation:**
  - Instead of fixed n-gram sizes, generates all possible prefix-suffix pairs from 1 to N tokens
  - Randomly selects prefix length weighted by frequency at each generation step
  - Better captures patterns at multiple scales

## Usage

1. Open `index.html` in a web browser
2. Select a tokenization mode (Words or Text)
3. Paste or enter your source text in the source panel
4. Click "calculate" to build the Markov chain from the source text
5. Switch to the "generated" tab
6. Enter the desired output length and click "generate"

## Technical Details

### Architecture

The application consists of several modules:

- **`markov.js`**: Core Markov chain implementation
  - Builds n-gram transition maps from input tokens
  - Generates new sequences using frequency-weighted selection
  - Uses Start/End markers (`<` and `>`) to delimit sequences

- **`words.js`**: Character-level tokenizer for word generation
  - Wraps each word with Start/End markers
  - Splits words on punctuation characters
  - Formats generated character sequences back into words

- **`text.js`**: Word-level tokenizer for paragraph generation
  - Splits text into paragraphs (by newlines)
  - Wraps each paragraph with Start/End markers
  - Formats generated word sequences back into paragraphs

- **`tokenize.js`**: Shared punctuation utilities
  - Handles punctuation separation and formatting
  - Removes paired punctuation (quotes, brackets)
  - Preserves unpaired punctuation (periods, commas, dashes)
  - Manages dash sequences

- **`index.js`**: UI controller and event handlers
  - Manages tab switching
  - Coordinates tokenization, chain building, and generation
  - Displays status messages

### How It Works

1. **Tokenization**: Source text is tokenized based on the selected mode:
   - Words mode: Each word becomes a character sequence wrapped with markers
   - Text mode: Paragraphs are split into word tokens and wrapped with markers

2. **Chain Building**: For each token group (word or paragraph):
   - All possible n-gram pairs (1 to maxN) are generated
   - Prefix-suffix transitions are recorded with frequency counts
   - The chain stores all possible continuations for each prefix

3. **Generation**: Starting with the Start marker:
   - All possible continuations are found by checking prefixes of length 1 to maxN
   - A continuation is randomly selected, weighted by frequency
   - The process continues until no continuations are found (End marker reached)

### Key Differences from Standard Markov Chains

Most Markov chain implementations use a fixed n-gram size (e.g., always 3-grams). This implementation:
- Generates all n-gram sizes from 1 to N
- At each generation step, considers all possible prefix lengths simultaneously
- Selects continuations weighted by their combined frequencies across all prefix lengths
- This adaptive approach captures both short-range and long-range patterns more effectively

## Files

- `index.html` - Main HTML interface
- `css/index.css` - Stylesheet
- `js/markov.js` - Core Markov chain implementation
- `js/words.js` - Character-level tokenizer
- `js/text.js` - Word-level tokenizer
- `js/tokenize.js` - Punctuation utilities
- `js/index.js` - UI controller
- `example.txt` - Example source text (appears to contain Scala code)

## Dependencies

- jQuery 3.7.1 (loaded via CDN)

## Browser Compatibility

Works in modern browsers that support ES6 JavaScript features and jQuery 3.x.

