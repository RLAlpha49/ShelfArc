# ShelfArc Agent Guidelines

## Quick workflow (required)

1. **Always** Activate: `mcp_oraios_serena_activate_project "ShelfArc"`.
2. **Always** set mode based on task size/complexity (use `mcp_oraios_serena_switch_modes` with appropriate mode array from Modes section). Example: `mcp_oraios_serena_switch_modes(["planning", "editing"])`
3. Use Serena exploration tools for discovery: `get_symbols_overview`, `find_symbol`, `search_for_pattern`, `list_dir`. This does not require switching to plan agent.
4. Prefer symbolic tools over reading files unless necessary.

At any point, use the `ask_questions` tool (see dedicated section below) to clarify ambiguous requirements or confirm high-risk decisions.

## Modes (serena)

- Trivial / small: `["one-shot", "editing"]` — quick edit.
- Medium: `["planning", "editing"]` — brief plan then edit.
- Large / risky: `["planning", "interactive", "editing"]` — require interactive validation.

## Subagents — Be proactive ⚡

- Use `runSubagent` proactively for bounded, self-contained tasks (research, refactor, triage, automation, complex edits) and prefer specialized agents to execute Plan items.
- Always include: **goal**, **constraints**, and **context** when invoking any subagent.
- **Important**: Be **VERY** thorough when providing context to subagents. The more context you provide, the better the subagent's output will be.
- Keep subagent prompts focused and bounded — each `runSubagent` should have a clear deliverable.
- Common agents: Plan, Accessibility Expert, Expert Next.js Developer, Expert React Frontend Engineer, Janitor (performs cleanup, review, and simplification).
- **Important**: When a subagent reports back such as any changes made, believe and if needed read the changes to update your context. Do not assume the subagent's output is incorrect without checking the actual changes.

### Plan subagent (authoritative)

Run the `Plan` subagent for complex changes, new features, architectural changes, cross-team impact, multi-step workflows, or anything beyond a simple one-line bug fix. Run it after initial exploration and before making edits. The Plan subagent produces an implementable plan.

- If you have multiple distinct tasks, run a separate Plan per task.
- Each Plan prompt must include **goal**, **constraints**, and **context**.
- Before handing the Plan to the implementation subagent, review the Plan output:
  - Annotate or correct it to reflect current context.
  - Fix outdated assumptions or errors.
  - Note acceptance criteria.
  - Adjust the Plan when context changes.
- The implementation subagent must be invoked using the approved Plan output; include the Plan steps in its prompt and treat them as the source of truth unless explicitly revised.

## Exploration Tools (Code Discovery)

Using exploration tools does not require switching to the Plan agent. Any code exploration can be done directly within the current agent mode.

- **`get_symbols_overview`**: High-level view of top-level symbols in a file
- **`find_symbol`**: Locate specific symbol by name path with optional depth
- **`search_for_pattern`**: Regex search when you don't know exact symbol names
- **`list_dir`**: Understand project structure
- **`find_file`**: Search files by glob pattern

**Best Practice**: **Always** explore with these tools BEFORE reading files. Saves tokens and time.

## `ask_questions` tool

Use to clarify ambiguous requirements or confirm high-risk decisions.

### Key constraints

- Up to **4** questions per call.
- Each question requires: a header, question text, and up to 6 predefined options (an automatic 'Other' free-text option is always added).
- Response structure: Each question returns an object `{ selected?: string, freeText?: string }` keyed by the header value.

### Recommended Pattern — Options + automatic "Other"

Use a single question with a few options. If the user needs a custom value, they type it in **Other**. Parse `Header.freeText` when present; otherwise use `selected`.

### Example — file scope

Ask "Which files should I check?" with header `Files` and options:

- All files (recommended)
- Changed files only
- /app directory
- Specific directory (use **Other** to type the path)
- List files (use **Other** to type filenames, comma-separated)

If **Other** is used, read `Files.freeText` (e.g., `app/api/**` or `app/page.tsx, lib/utils.ts`).

---

## Libraries & Docs

- Use Context7 / `get_library_documentation` for external library docs

## Memory policy

- Store only essential project context (patterns, decisions). Do not store docs or large summaries.
