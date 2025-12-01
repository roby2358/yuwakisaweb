# Parliamentary CLI Tools Specification

## Overview
This document defines the interface contracts for all `parliament-*` command-line tools. These tools are **virtual**; they operate on the in-memory state held by the Agent Framework, not the local file system.

---

## Global Conventions

### Exit Codes
- `0`: Success
- `1`: Invalid arguments
- `2`: Out of order (action not allowed in current state)
- `3`: Permission denied (e.g., direct file edit blocked)
- `4`: Not found (e.g., amendment ID doesn't exist)

### Output Format
All tools output **Markdown** to `stdout` (captured by the Framework) for human readability and LLM parsing:
```markdown
## Status: Success | Error

[Human-readable message]

### Data
- **Field**: Value
- **Field**: Value
```

### State Management
All tools manipulate the `ParliamentSession` object:
- `state` - Current stage, active bill
- `hansard` - Append-only log
- `files` - In-memory file buffers
- `issues` - Issue tracking list
- `papers` - Tabled document buffers
- `amendments` - Proposed diffs list

---

## 1. `parliament-recognize`

### Purpose
Grant the floor to a Member or all Members, triggering an LLM invocation. **This is the ONLY way to invoke Member LLMs.** There is no automatic routing of requests to Members.

### Usage
```bash
parliament-recognize all "instruction"
parliament-recognize [member-number] "instruction"
```

### Arguments
- `all` or `[member-number]`: Target Member(s) to recognize
  - `all`: Recognize all Members (invokes all Member LLMs in parallel)
  - `[member-number]`: Recognize a specific Member by number (e.g., `1`, `2`, `3`)
- `"instruction"`: One-line instruction to give to the recognized Member(s)

### Behavior
1. Validates the target (must be "all" or a valid member number)
2. Returns a success status with recognition data
3. **Framework Action**: The framework then invokes the specified Member LLM(s) with the instruction
4. Members respond with their `# Speak` section, votes, or actions
5. Responses are processed and added to Hansard

### Output
```markdown
## Status: Success

Recognizing all members

### Data
- **Target**: all
- **Instruction**: Vote now: aye, no, or abstain
- **Requires Invocation**: true
```

### Exit Codes
- `0`: Success
- `1`: Invalid format or invalid member number

### Notes
- **Critical**: Members can ONLY be invoked through this command. There is no automatic invocation.
- When recognizing "all", all Members are invoked in parallel.
- The instruction should be clear and specific (e.g., "What is your view on this amendment?" or "Vote now: aye, no, or abstain").

---

## 2. `parliament-table`

### Purpose
Submit a Bill, Motion, or Amendment.

### Usage
```bash
parliament-table [type] [target] "description"
```

### Types
- `bill [file]`: Create a new Bill
- `motion`: Submit a procedural motion
- `amendment [id]`: Formally move an amendment

### Behavior
- **Bill**: Create `bills/BILL-{N}.md` with metadata.
- **Motion**: Append to Hansard and set as active motion.
- **Amendment**: Link amendment to current Bill.

### Output
```markdown
## Status: Success

Bill BILL-05 tabled

### Data
- **ID**: BILL-05
- **Type**: bill
- **Target**: main.py
- **Description**: Fix infinite loop
```

### Exit Codes
- `0`: Success
- `1`: Invalid type
- `4`: Target file not found (for `bill`)

---

## 3. `parliament-share`

### Purpose
Share a file or document with the House. This adds the document to the shared context available to all agents.

### Usage
```bash
parliament-share [name] [file content]
```

### Arguments
- `[name]`: The name/identifier for the shared document
- `[file content]`: The content of the file to share

### Behavior
1. Creates a paper entry with the provided name and content
2. Adds it to the shared papers collection
3. The document becomes available in the context for all agents

### Output
```markdown
## Status: Success

Shared: log.txt

### Data
- **ID**: PAPER-1
- **Filename**: log.txt
- **Description**: Shared document: log.txt
- **Content**: [file content]
```

### Exit Codes
- `0`: Success
- `1`: Invalid format (name and content required)

---

## 4. `parliament-edit`

### Purpose
View files, propose amendments, or enact approved changes.

### Usage
```bash
parliament-edit [file] --view
parliament-edit --view-amendment [id]
parliament-edit [file] --propose "diff"
parliament-edit [file] --enact [amendment_id]
parliament-edit [file] --create "content"
```

### Modes

#### `--view`
Read-only file viewing.
**Exit Code**: `0`

#### `--view-amendment [id]`
Display the proposed diff for an amendment.
**Exit Code**: `0` (success), `4` (not found)

#### `--propose "diff"`
Create a new amendment file in `amendments/AMDT-{N}.diff`.
**Output**:
```markdown
## Status: Success

Amendment AMDT-12 created

### Data
- **ID**: AMDT-12
- **File**: main.py
- **Diff**: (diff content shown)
```
**Exit Code**: `0`

#### `--enact [id]`
Apply the diff to the target file. **Requires**: Amendment must have passed a vote.
**Exit Code**: `0` (success), `2` (out of order - not passed), `3` (permission denied)

#### `--create "content"`
Create a new file with the specified content. **Requires**: File must not already exist.
**Output**:
```markdown
## Status: Success

File sonnet.txt created

### Data
- **Filename**: sonnet.txt
- **Content**: (file content shown)
```
**Exit Code**: `0` (success), `1` (filename required), `2` (file already exists)

---

## 5. `parliament-order-paper`

### Purpose
Display the current business of the House.

### Usage
```bash
parliament-order-paper
```

### Output
```markdown
## Status: Success

### Current Business
- **Stage**: Committee Stage
- **Current Bill**: BILL-05
- **Active Motion**: That Amendment AMDT-12 be made
- **Pending Votes**: 3
- **Members Present**: Member for Python, Member for Security
```

### Exit Codes
- `0`: Success

---

## 6. `parliament-issue`

### Purpose
Manage issues/tasks.

### Usage
```bash
parliament-issue create "title" "description"
parliament-issue close [id]
parliament-issue list
```

### Actions

#### `create`
Create `issues/ISSUE-{N}.md`.
**Output**:
```markdown
## Status: Success

Issue ISSUE-42 created

### Data
- **ID**: ISSUE-42
- **Title**: Infinite Loop in main.py
- **Status**: open
```

#### `close [id]`
Mark issue as closed. **Requires**: Related Bill must have passed Third Reading.
**Exit Code**: `0` (success), `2` (out of order)

#### `list`
Return all open issues.

### Exit Codes
- `0`: Success
- `2`: Out of order (for `close`)
- `4`: Issue not found

---

## 7. `parliament-adjourn`

### Purpose
Adjourn the House and end the session. This is a Speaker-only command that stops the parliamentary loop.

### Usage
```bash
parliament-adjourn [reason]
```

### Behavior
1. Sets `state.adjourned` to `true`
2. Sets `state.stage` to `"Adjourned"`
3. Records adjournment in Hansard
4. Session loop will exit on next check

### Output
```markdown
## Status: Success

House adjourned

### Data
- **Reason**: Business concluded
- **Timestamp**: 2025-11-29T19:30:00Z
```

### Exit Codes
- `0`: Success

### Notes
- Only the Speaker should use this command
- Once adjourned, the session will end gracefully
- Adjournment should be used when all business is concluded
