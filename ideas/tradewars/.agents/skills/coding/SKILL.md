---
name: coding
description: Apply this repository's coding conventions when implementing, modifying, refactoring, or testing code. Use for code changes in this project; do not use for design-only discussion or prose edits.
---

# Project Coding Conventions

Implement the requested behavior first, then make a second pass for clarity and appropriate reuse. Stay close to the stated requirements and avoid speculative features.

## Design and structure

- Organize code around the domain's central concepts and centralize genuine cross-cutting concerns.
- Prefer clear names, single responsibilities, shallow nesting, guard clauses, and early returns.
- Keep call chains shallow and return concrete values where practical. Pass intermediate results explicitly instead of hiding them in deep call stacks.
- Combine functional techniques with objects when useful; do not force either paradigm.
- Factor code when it improves current clarity or reuse. Do not introduce abstractions solely for hypothetical future needs.

### Discriminator-based behavior

When the same mode, type, or category discriminator would be tested in several places, route it through one dispatch point using parameterization, a lookup table, a strategy, or first-class functions. Keep each variant cohesive.

Do not apply this mechanically. A small, stable, single-site `if` or `switch` can be clearer. Distinguish recurring “what kind is this?” branching from ordinary “what is true now?” logic.

## Function signatures and configuration

- Avoid optional parameters and inline default parameter values unless the API or user requirement calls for them.
- Keep configuration values centralized and fail clearly when required values are missing.
- Do not silently substitute fallback values for required input.

## Browser applications

For a new, dependency-free browser prototype, prefer HTML, CSS, and JavaScript that can be launched by opening the HTML file directly. Preserve an existing project's module system and build tooling; do not convert it without a task-specific reason.

## Stored-state changes

For prototypes and early development, do not add migrations or versioning unless requested. Clearly report changes that invalidate or alter persisted state.

## Tests and reusable scripts

- Add tests when they provide meaningful confidence; prototypes, games, and generative experiments may not need tests for every change.
- When test code is warranted, put reusable unit tests in the project's test location. Do not create throwaway diagnostic scripts as a substitute for tests.
- A durable helper script is acceptable when it supports an actual recurring workflow. Put it in the repository's established scripts location and document how it is used.
- Prefer tests against concrete behavior over mock-heavy tests that duplicate client/server contracts.

## MCP servers

- Default to stdio transport unless the deployment context requires another transport.
- For Python MCP servers, prefer `FastMCP` from `mcp.server.fastmcp` when compatible with the project's installed SDK.

Before finishing, run the narrowest relevant verification supported by the repository and report anything that could not be verified.
