# Parliamentary Agent Framework Design

## Overview
This document outlines the design for a multi-agent collaboration framework modeled after the **Standing Orders of the UK House of Commons**. The system is designed to facilitate structured, democratic, and transparent collaboration among 3-10 agents (Members) to address matters brought before the House through Bills and proper parliamentary procedure.

**Scope**: The House may consider any matter or issue, including but not limited to code modifications, creative tasks, problem-solving, analysis, and other work that can be addressed through parliamentary procedure.

## Core Concepts

### 1. The House (The Environment)
The shared workspace where agents collaborate. It is governed by strict procedural rules to ensure order and progress.

### 2. The Speaker (The Controller)
A special, impartial agent or system process that:
- Enforces the Standing Orders.
- Grants "The Floor" to Members.
- Selects amendments for debate.
- Maintains order and decorum.

### 3. Members (The Agents)
Autonomous agents representing different perspectives or capabilities (e.g., "The Member for Python", "The Member for Security", "The Member for Creative Writing"). They must:
- Address the Speaker, not each other directly.
- Follow the legislative process to address matters.
- Vote on motions and bills.
- Apply their expertise to whatever matter is before the House.

### 4. Session State (Authority)
The system must be in a valid active state for business to occur. This replaces the ceremonial "Mace".

### 5. Hansard (The Log)
An immutable, append-only record of all speeches, motions, votes, and file changes.

---

## Standing Orders (The Rules)

### S.O. No. 1: Communication
- **Directness**: Agents should speak clearly and directly. Addressing the Speaker is optional.
- **Language**: Communication should be professional and focused on the task. Avoid unnecessary pleasantries or jargon.
- **Relevance**: Speeches must be strictly relevant to the Motion under discussion.
- **Pass**: If an agent has nothing to contribute at a given moment, they should respond with "Pass" rather than remain silent.

### S.O. No. 2: The Legislative Process (Workflow)
All tasks (Bills) must pass through the following stages:
- **First Reading**: A Member tables a Bill (creates a task/file). No debate.
- **Second Reading**: General debate on the principles. A vote is taken on whether to proceed.
- **Committee Stage**: Detailed examination and amendment. This is where the actual work (editing) happens.
- **Report Stage**: The House reviews the Committee's work. Further amendments can be proposed.
- **Third Reading**: Final vote on the completed work. No further amendments allowed.

### S.O. No. 3: Motions and Amendments
- **Notice**: Members must give notice of a motion (using the `table` tool).
- **Selection**: The Speaker selects which amendments are debated.
- **Moving**: A Member must "move" a motion for it to be debated.

### S.O. No. 4: Voting
- **Vote**: When the Speaker puts a question, all Members must respond immediately with their vote in their response.

### 2. `parliament-table` (Propose)
**Purpose**: To submit a new Bill, Motion, or Amendment.
**Usage**: `parliament-table [type] [target] "Description"`
**Types**:
- `bill`: Creates a Bill file (e.g., `bills/BILL-01.md`) tracking the proposal.
- `motion`: A procedural proposal (e.g., "That the House do now adjourn").
- `amendment`: A specific change to a text.

### 2a. `parliament-share` (Share Documents)
**Purpose**: To share documents, logs, or reference materials with the House.
**Usage**: `parliament-share [name] [file content]`
**Description**: Adds a document to the shared context available to all agents.

### 3. `parliament-edit` (The Editor)
**Purpose**: To create or update files (The Laws).
**Usage**: `parliament-edit [file] [content]`
**Description**: Creates a file if it doesn't exist, or overwrites it if it does.
**Note**: Direct editing without a passed motion is blocked by the Sergeant-at-Arms (File Permissions).

### 4. `parliament-issue` (Task Management)
**Purpose**: To manage the lifecycle of issues/tasks.
**Usage**: `parliament-issue [action] [id] [details]`
**Actions**:
- `create "Title" "Description"`: Open a new issue.
- `close [id]`: Mark an issue as complete (Royal Assent).
- `list`: Show open issues.
**Note**: Closing an issue typically requires a passed Bill (Third Reading).

---

## Example Workflow: Fixing a Bug in `main.py`

**Scenario**: The system has an infinite loop. Member A (Python Expert) wants to fix it. Member B (Reviewer) checks the code.

### Stage 1: First Reading (Introduction)
- **Speaker**: `parliament-recognize 1 "You may table a Bill to address the infinite loop issue."`
  *   *System invokes Member 1*
- **Member 1** (in response): Uses `parliament-issue create "Infinite Loop in main.py" "The event handler hangs indefinitely."`
  *   *System generates Issue ID: ISSUE-42*
- **Member 1** (continues): Uses `parliament-share "logs/error.log" "Stack trace showing the infinite loop"`
  *   *System adds the shared document to the session context.*
- **Member 1** (in "# Speak" section): "I rise to table a Bill to fix the critical infinite loop in the main event handler (ISSUE-42). I have shared the error logs for reference."
- **Member 1** (continues): Uses `parliament-table bill main.py "Fix infinite loop in event handler"`
  *   *System records the Bill.*

### Stage 2: Second Reading (Principle)
- **Speaker** (in "# Speak" section): "The Question is that the Bill be read a second time. The floor is open for comment."
- **Speaker**: `parliament-recognize all "summarize your position in one line"`
  *   *System invokes all Members in parallel to collect summaries*
- **All Members respond with one-line summaries**:
  - Member 1: `# Speak\nI support this Bill as it addresses a critical bug.`
  - Member 2: `# Speak\nI support the intent. This bug is blocking deployment.`
- **Speaker**: (considers summaries) `parliament-recognize 2 "Please elaborate on your position"`
  *   *System invokes Member 2 for full debate*
- **Member 2** (in "# Speak" section): "I support the intent. This bug is blocking deployment. The proposed fix appears sound and should proceed to Committee Stage."
- **Speaker** (in "# Speak" section): "The floor is closed. Division. The Question is that the Bill be read a second time."
- **Speaker**: `parliament-recognize all "Vote now: aye, no, or abstain"`
  *   *System invokes all Members in parallel*
- **All Members respond with their votes**:
  - Member 1: `# Speak\naye`
  - Member 2: `# Speak\naye`
- **Speaker** (in "# Speak" section): "The Ayes have it. The Bill is committed to a Committee of the whole House."

### Stage 3: Committee Stage (The Work)
- **Speaker**: `parliament-recognize 1 "You may propose amendments to fix the infinite loop."`
  *   *System invokes Member 1*
- **Member 1**: Provides updated code in their `# Speak` section
- **Member 1**: Uses `parliament-table amendment AMDT-1 "Replace infinite loop with state variable"`
- **Speaker** (in "# Speak" section): "Amendment AMDT-1 has been tabled. The floor is open for comment."
- **Speaker**: `parliament-recognize all "summarize your position on Amendment AMDT-1 in one line"`
  *   *System invokes all Members in parallel to collect summaries*
- **All Members respond with one-line summaries**:
  - Member 1: `# Speak\nI move this amendment to fix the infinite loop.`
  - Member 2: `# Speak\nI have concerns about undefined variable 'running'.`
- **Speaker**: (considers summaries) `parliament-recognize 2 "Please elaborate on your concerns"`
  *   *System invokes Member 2 for full debate*
- **Member 2** (in "# Speak" section): "Point of Order. The variable 'running' is not defined in this scope. This will crash."
- **Speaker**: `parliament-recognize 1 "The Member has raised a valid point. How do you respond?"`
  *   *System invokes Member 1*
- **Member 1** (in "# Speak" section): "The Member is correct. I withdraw and will propose a corrected version."
- **Member 1**: Provides corrected code in their `# Speak` section
- **Member 1**: Uses `parliament-table amendment AMDT-2 "Define state variable and loop condition"`
- **Speaker** (in "# Speak" section): "Amendment AMDT-2 has been tabled. The floor is closed. The Question is that Amendment AMDT-2 be made."
- **Speaker**: `parliament-recognize all "Vote now on Amendment AMDT-2"`
  *   *System invokes all Members in parallel*
- **All Members respond with their votes**:
  - Member 1: `# Speak\naye`
  - Member 2: `# Speak\naye`
- **Speaker** (in "# Speak" section): "The Ayes have it."
- **Speaker**: Uses `parliament-edit main.py [content]` with the approved content
  *   *File `main.py` is updated.*

### Stage 4: Third Reading (Final Approval)
- **Speaker** (in "# Speak" section): "The Question is that the Bill be read the third time and passed. The floor is open for comment."
- **Speaker**: `parliament-recognize all "summarize your position in one line"`
  *   *System invokes all Members in parallel to collect summaries*
- **All Members respond with one-line summaries**:
  - Member 1: `# Speak\nI support final passage.`
  - Member 2: `# Speak\nI support final passage.`
- **Speaker**: (considers summaries - all support) **Speaker** (in "# Speak" section): "The floor is closed. Division. The Question is that the Bill be read the third time and passed."
- **Speaker**: `parliament-recognize all "Vote now on Third Reading"`
  *   *System invokes all Members in parallel*
- **All Members respond with their votes**:
  - Member 1: `# Speak\naye`
  - Member 2: `# Speak\naye`
- **Speaker** (in "# Speak" section): "The Ayes have it. The Bill is passed."
- **Speaker**: Uses `parliament-issue close ISSUE-42`
  *   *Task is marked complete.*

