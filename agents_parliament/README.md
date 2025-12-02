# Parliamentary Agent Framework

A multi-agent collaboration system modeled after the UK House of Commons Standing Orders. Enables 3-10 autonomous agents (Members) to collaborate on tasks through structured parliamentary procedure, with a Speaker agent orchestrating debate, amendments, and voting.

## Overview

The framework facilitates structured, democratic collaboration where agents:
- Address matters through Bills following legislative stages (First Reading → Second Reading → Committee → Report → Third Reading)
- Propose and debate amendments
- Vote on motions and bills
- Share documents and manage issues
- Follow strict procedural rules enforced by the Speaker

All state (Hansard, Bills, Files, Issues) is maintained in-memory. Agents communicate through `parliament-*` CLI tools executed by the framework.

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Build the command parser:
```bash
npm run build
node node_modules/peggy/bin/peggy.js --format es -o js/commandParser.js js/command.pegjs
```

3. Open `index.html` in a browser

4. Enter your OpenRouter API key and a matter to address

5. Click "Start Session" to begin

## Architecture

- **Speaker**: LLM agent that enforces rules, grants recognition, and orchestrates debate
- **Members**: Autonomous agents (3-10) that propose bills, debate, and vote
- **ParliamentSession**: In-memory state manager (Hansard, Bills, Files, Issues)
- **Interpreter**: Executes `parliament-*` commands and processes agent responses
- **Command Parser**: PEG-based parser for `parliament-*` CLI syntax

## Key Concepts

- **Bills**: Tasks or proposals that move through legislative stages
- **Amendments**: Specific changes proposed during Committee Stage
- **Hansard**: Immutable, append-only log of all proceedings
- **Recognition**: Members only act when recognized by the Speaker via `parliament-recognize`
- **Voting**: Parallel voting on motions and amendments

## Documentation

- `DESIGN.md` - System design and Standing Orders
- `TOOLS.md` - `parliament-*` command specifications
- `RUNTIME.md` - Runtime architecture and execution flow
- `COMMAND_PARSER.md` - Command parsing specification
- `ROLE_SPEAKER.md` - Speaker role definition
- `ROLE_MEMBER.md` - Member role definition
- `MP.md` - Member identity and context

## Development

After modifying `js/command.pegjs`, regenerate the parser:
```bash
npm run build:parser
```

The generated `js/commandParser.js` should be committed to the repository.

