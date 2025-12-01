# Parliamentary Agent Runtime Architecture

## Overview
This document describes the runtime architecture for the Parliamentary Agent Framework. It details the request/response flow, message construction, and opportunities for parallelism.

## 1. The Runtime Loop (The Session)

The **Agent Framework** is the central orchestrator. It holds the entire state of Parliament (Hansard, Bills, Issues, Files) **in-memory** and executes all CLI commands. The Speaker is an LLM role that directs the flow, but the Framework executes the mechanics.

### Phase A: Speaker Decision (The Gavel)
The Framework constructs the context for the **Speaker LLM**.
*   **System**: `ROLE_SPEAKER.md`
*   **User (Context)**: Current State (Stage, Bills, Issues), Hansard History, and File Contents.
*   **Instruction**: "Review the state and Member responses. Decide the next action."
*   **Output**: The Speaker returns a Decision, a `# Speak` section (recorded in Hansard), and an Action section with a command (e.g., `parliament-recognize all "Vote now"`).

### Phase B: Framework Execution
The Framework executes the Speaker's command:
*   The Speaker's `# Speak` section is automatically recorded in Hansard.
*   If it's a `parliament-edit` call, it modifies the in-memory file buffers.
*   If it's a `parliament-recognize` call, it triggers Phase C to invoke the specified Member(s).

### Phase C: Member Invocation (Only When Recognized)
**IMPORTANT**: Members are ONLY invoked when the Speaker uses `parliament-recognize`. There is no automatic invocation.

When `parliament-recognize` is executed:
*   **For `parliament-recognize all`**: The Framework sends parallel requests to all **Member LLMs**.
*   **For `parliament-recognize [number]`**: The Framework sends a request to the specified Member LLM.
*   **System**: `MP.md` + `ROLE_MEMBER.md`
*   **User (Context)**: Current State, Hansard, and File Contents.
*   **Instruction**: "The Speaker recognizes you. [instruction from recognize command]"
*   **Output**: Members return `## Thought`, `# Speak`, `## Action` (or `## Pass`). Votes are included in the `# Speak` section.

### Two-Step Process for Opening the Floor
When the Speaker opens the floor for comment, the standard procedure is:

1. **Step 1 - Collect Summaries**: 
   * Speaker calls `parliament-recognize all "summarize your position in one line"`
   * All Members respond in parallel with brief one-line summaries in their `# Speak` section
   * Framework records summaries in Hansard

2. **Step 2 - Consider and Recognize**:
   * Speaker reviews the summaries
   * Speaker recognizes specific Member(s) based on their summaries:
     * `parliament-recognize [number] "Please elaborate on your position"`
   * Recognized Members provide full debate in their `# Speak` section

3. **Closing Discussion and Voting**:
   * Speaker closes discussion in their `# Speak` section
   * Speaker calls vote using `parliament-recognize all "Vote now: aye, no, or abstain"`
   * All Members vote in parallel
   * Speaker tallies and declares result in their `# Speak` section

### Phase D: Process Member Responses
The Framework processes Member responses:
*   Speech from `# Speak` section is added to Hansard.
*   Votes are recorded in the voting system.
*   Actions are executed (e.g., `parliament-table`, `parliament-edit`).
*   The loop returns to Phase A for the Speaker to review and decide the next action.

---

## 2. Parallelism Opportunities

### 1. Voting (The Division)
*   **Scenario**: The Speaker calls "Division" using `parliament-recognize all "Vote now"`.
*   **Parallelism**: **Full**. All agents are queried simultaneously when recognized.
*   **Aggregation**: The Framework waits for *all* active agents to respond (or a timeout). The results are tallied instantly.
*   **Benefit**: Reduces the N-turn latency of sequential voting to 1 turn.

### 2. Committee Stage Review
*   **Scenario**: A Bill is in Committee. An amendment has been tabled.
*   **Two-Step Process**:
    1. **Step 1**: Speaker uses `parliament-recognize all "summarize your position on this amendment in one line"` to collect summaries from all Members in parallel.
    2. **Step 2**: Speaker reviews summaries and recognizes specific Members (e.g., `parliament-recognize 2 "Please elaborate on your concerns"`) for full debate.
*   **Parallelism**: **Controlled by Speaker**.
    *   Summary collection: All Members in parallel
    *   Full debate: Individual Members as recognized by Speaker
*   **Aggregation**: Members respond with `# Speak` sections and actions. The Speaker reviews responses and decides the next action (e.g., recognize another Member, close discussion, call a vote, etc.).

### 3. Brainstorming (First Reading)
*   **Scenario**: "What should we build?"
*   **Parallelism**: **High**. All agents generate ideas. The Speaker selects the most relevant one to Table.

---

## 3. OpenAI API Protocol

The runtime constructs a conversation history for each agent invocation. The **Speaker** acts as the `user`, and the **Agent** acts as the `assistant`.

### System Message
The static identity and rules for the agent.
```markdown
# Agent Context
[Content of MP.md]
[Content of ROLE_MEMBER.md]
```

### User Message (The Context Window)
Constructed dynamically at the start of each turn.
```markdown
For the matter of: [Current Issue/Bill Title]

# For Consideration
[Content of Tabled Papers (e.g., logs, search results)]
[Content of Relevant Files (e.g., main.py)]
[Current Amendment Diff]

# Hansard (Recent History)
Speaker: The Question is that Amendment AMDT-1 be made.
Member A: I move AMDT-1 to fix the SQL injection.
...
```

### Conversation History
The agent's own past actions and the Speaker's responses (feedback/results) are appended here.
```markdown
assistant:
## Thought
I need to check if the amendment handles edge cases.
# Speak
I support the amendment. It addresses the security concern while maintaining performance.

user:
[Result: Speech recorded in Hansard]
```

### User Message (The Trigger)
The final instruction to prompt the agent for action (only when recognized by the Speaker).
```markdown
# Instruction
The Speaker recognizes you. [instruction from parliament-recognize command]
```

### 3.1 Speaker Protocol
The Speaker receives a similar context but with a different system prompt and instruction.

**System Message**:
```markdown
# Speaker Context
[Content of ROLE_SPEAKER.md]
```

**User Message (Context)**:
*(Same as Agent: Issue, Papers, Files, Hansard)*

**User Message (Trigger)**:
```markdown
# Instruction
The House is in [Stage].
Recent Member responses:
- Member 1: [Speech or action from # Speak section]
- Member 2: [Vote or action]

Review the state and decide the next action. You may:
- Put your statement in the `# Speak` section (automatically recorded in Hansard)
- Use `parliament-recognize all "instruction"` to recognize all Members
- Use `parliament-recognize [number] "instruction"` to recognize a specific Member
- Use other tools as needed (e.g., `parliament-edit --enact`, `parliament-adjourn`)
```



---

## 4. State Machine

The parliamentary process is governed by a strict state machine that controls valid transitions.

### Bill Lifecycle States
```
┌─────────────────┐
│  Bill Tabled    │ (First Reading - No debate)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Second Reading  │ (Debate on principles)
│   [Vote Called] │
└────────┬────────┘
         │ (If Aye)
         ▼
┌─────────────────┐
│ Committee Stage │ (Amendments proposed & debated)
│   [Vote on Each]│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Report Stage   │ (Review Committee work)
│   [Vote Called] │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Third Reading  │ (Final vote, no amendments)
│   [Vote Called] │
└────────┬────────┘
         │ (If Aye)
         ▼
┌─────────────────┐
│   Royal Assent  │ (Bill Passed → Issue Closed)
└─────────────────┘
```

### Voting Sub-State
When a vote is called:
1. **State**: `voting: true` in `state.json`
2. **Quorum**: Wait for `floor(N/2) + 1` agents to respond (or timeout)
3. **Tally**: Count `aye`, `no`, `abstain`
4. **Decision**: `aye > no` → Pass, else Fail
5. **Transition**: Return to previous stage or advance

### Speaker Decision Points
- **After Second Reading Vote**: Advance to Committee or reject Bill
- **During Committee**: Select which amendments to debate (priority-based)
- **After Each Amendment Vote**: Enact (if passed) or discard
- **After Third Reading Vote**: Close Issue or send back to Committee

---

## 5. Error Handling

### Agent Response Errors

#### Malformed Response
**Scenario**: Agent returns invalid Markdown or missing `## Action`.
**Handler**:
1. Log the error to Hansard as `[Malformed Response from Member X]`
2. Treat as "No Action" (silent abstention)
3. Continue with other agents' responses

#### Invalid Command
**Scenario**: Member proposes an action that is out of order (e.g., trying to edit without a passed motion).
**Handler**:
1. Framework validates the command during execution
2. Returns error status
3. Speaker may issue a ruling in their `# Speak` section: "The Member is out of order."

#### Timeout (see Section 6)

---

### System Errors

#### Tool Execution Failure
**Scenario**: `parliament-edit --enact AMDT-12` fails (file locked, disk full).
**Handler**:
1. Return error JSON to Speaker
2. Speaker announces: `"Division on Amendment AMDT-12 has failed to execute. The House stands adjourned."`
3. Set `state.json` to `adjourned: true`
4. Log incident and notify system operator

#### Speaker Malfunction
**Scenario**: Speaker times out or returns invalid response.
**Handler**:
1. **Emergency Protocol**: Deputy Speaker (fallback LLM) takes over
2. If Deputy fails: **Prorogation** - halt all operations, save state, exit gracefully
3. Manual intervention required

---

### Conflict Resolution

#### Simultaneous Amendments
**Scenario**: Two agents propose amendments to the same line during parallel invocation.
**Handler**:
1. Speaker receives both in Phase C
2. Speaker selects based on:
   - **Priority**: Higher priority wins
   - **Arrival Time**: If equal priority, first received wins
3. Selected amendment is debated
4. Rejected agent receives feedback: `"A conflicting amendment has been selected for debate. Please review and re-propose if needed."`

#### Edit Conflicts During Enactment
**Scenario**: File has changed since amendment was proposed.
**Handler**:
1. `parliament-edit --enact` detects conflict
2. Returns `exit 3` with error message
3. Speaker announces: `"The amendment cannot be applied due to changes in the file. The mover may withdraw and re-propose."`

---

## 7. Implementation Strategy
1.  **Framework Core**: A Python class `ParliamentSession` that holds:
    *   `self.hansard`: List[Dict]
    *   `self.files`: Dict[str, str] (In-memory file system)
    *   `self.state`: Dict (Current stage, active motions)
2.  **Agent Pool**: A list of LLM API clients (Speaker + Members).
3.  **Tool Registry**: Methods on `ParliamentSession` that implement `parliament-*` logic by manipulating the in-memory state. These are exposed to agents as **bash command line tools**.
4.  **Main Loop**:
    ```python
    while session_active:
        # 1. Speaker Turn
        speaker_context = build_context(self.state, self.hansard, member_responses)
        decision = await speaker_agent.act(speaker_context)
        self.execute_tool(decision.command)

    # 2. Member Turn (Only if recognized)
    if speaker_command == 'parliament-recognize':
        if target == 'all':
            member_responses = await asyncio.gather(*[
                m.act(member_context, instruction) for m in members
            ])
        else:
            member_responses = [await members[target-1].act(member_context, instruction)]
    ```

## 8. Timeouts and Absence

To ensure the parliamentary session remains active and does not hang due to unresponsive agents, the system enforces strict timeout policies:

*   **Timeout Window**: All agent invocations must complete within a fixed time window (e.g., 30 seconds).
*   **Handling Non-Response**:
    *   **During Debate**: If an agent fails to respond within the window, they are considered to be silent for that turn. The Speaker proceeds with the available responses.
        *   **Note**: This is different from an explicit "Pass" response, which indicates the agent is engaged but has nothing to contribute.
    *   **During Voting**: If an agent fails to vote, their vote is recorded as an **Abstention** or **Absent**.
*   **Quorum Checks**: The Speaker monitors the number of active (responsive) agents. If the number of responsive agents falls below the required Quorum, the Speaker has the authority to adjourn the House or pause proceedings until connectivity is restored.
