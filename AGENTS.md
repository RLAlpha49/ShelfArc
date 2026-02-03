# ShelfArc Agent Guidelines

## Quick workflow (required)

1. **Always** Activate: `mcp_oraios_serena_activate_project "ShelfArc"`.
2. **Always** set mode based on task size/complexity (use `mcp_oraios_serena_switch_modes` with appropriate mode array from Modes section). Example: `mcp_oraios_serena_switch_modes(["planning", "editing"])`
3. Use Serena exploration tools for discovery: `get_symbols_overview`, `find_symbol`, `search_for_pattern`, `list_dir`. This does not require switching to plan agent.
4. Prefer symbolic tools over reading files unless necessary.
5. Follow these workflow checkpoints:

   ```mermaid
   flowchart TD
       A[think_about_collected_information] --> B[think_about_task_adherence]
       B --> C{Complex change?}
       C -->|Yes| D[Run Plan subagent]
       D --> E[Run Implementation subagent using Plan]
       C -->|No| F[Make changes directly]
       E --> G[Run Janitor subagent]
       F --> H{Non-trivial?}
       H -->|Yes| G
       H -->|No - docs/formatting/comments only| I[think_about_whether_you_are_done]
       G --> I
   ```

   - After exploring: `think_about_collected_information`.
   - For complex changes, run the Plan subagent (see [Plan subagent (authoritative)](#plan-subagent-authoritative)).
   - Before edits: `think_about_task_adherence`.
   - Make edits/changes.
   - After Implementation `runSubagent` completes (If used):
     - Implementation reporting: follow [Reporting (Required) - Implementation & Janitor](#reporting-required---implementation--janitor).
   - After code edits or non-trivial changes:
     - Run the `Janitor` subagent once per Implementation cycle (after each Implementation `runSubagent` completes), following the cycle Plan → Implementation → Janitor.
     - Exception: documentation-only changes, single-line typos, formatting-only changes, or comment-only updates do not require Janitor.
     - Janitor reporting: follow [Reporting (Required) - Implementation & Janitor](#reporting-required---implementation--janitor).
   - After finishing: `think_about_whether_you_are_done`.

At any point, use the `ask_questions` tool (see dedicated section below) to clarify ambiguous requirements or confirm high-risk decisions.

## Modes (serena)

- Trivial / small: `["one-shot", "editing"]` — quick edit.
- Medium: `["planning", "editing"]` — brief plan then edit.
- Large / risky: `["planning", "interactive", "editing"]` — require interactive validation.

## Subagents — Be proactive ⚡

- Use `runSubagent` proactively for bounded, self-contained tasks (research, refactor, triage, automation, complex edits) and prefer specialized agents to execute Plan items.
- Always include: **goal**, **constraints**, and **context** when invoking any subagent.
- Keep subagent prompts focused and bounded — each `runSubagent` should have a clear deliverable.
- Common agents: Plan, Accessibility Expert, Expert Next.js Developer, Expert React Frontend Engineer, Janitor (performs cleanup, review, and simplification).

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

### Example — 3-task subagent workflow

1. Scenario: you have three tasks (Task A, Task B, Task C).

2. For each task (repeat the same required cycle for Task A, Task B, and Task C):
   - Start with the `Plan` subagent (see [Plan subagent (authoritative)](#plan-subagent-authoritative)). Example:
     `runSubagent({agentName: "Plan", prompt: "Plan pagination for /api/get-cards — constraints: backward-compatible, minimal changes, no new deps", description: "Plan pagination for /api/get-cards"})`
   - Review and annotate the Plan output as needed, then provide it to the implementation subagent (specialist). Example:
     `runSubagent({agentName: "Expert Next.js Developer", prompt: "Implement Plan: add pagination to /api/get-cards; follow repo conventions; run tests", description: "Implement Task A (pagination)"})`
   - Run the `Janitor` subagent after each task to review, simplify, and clean up changes. Example:
     `runSubagent({agentName: "Janitor", prompt: "Janitor: review and simplify changes, ensure style and tests", description: "Janitor for Task A"})`

3. Move to the next task only after the previous task's Plan → Implementation → Janitor cycle is complete.

## Reporting (Required) - Implementation & Janitor

Use this for **both** Implementation and Janitor subagents.

- **Pre-run snapshot** (baseline state): capture _before_ the subagent using the snapshot script (see Tracking mechanism).
- **Post-run snapshot**: capture _after_ the subagent using the snapshot script; files in this diff are “files the subagent modified”.
- **Per-file summary template** (one entry per file touched):
  - `filename: <path>`
  - `pre_existing_changes: <line ranges or pre-snapshot refs>`
  - `subagent_changes: <line ranges or post-snapshot refs>`
  - `summary: <one-line description>`
- **Tracking mechanism**:

  ```bash
  # example for Implementation
  python .subagent/subagent_snapshot.py --subagent implementation --phase pre

  # run subagent

  python .subagent/subagent_snapshot.py --subagent implementation --phase post
  ```

  ```bash
  # example for Janitor
  python .subagent/subagent_snapshot.py --subagent janitor --phase pre

  # run janitor subagent

  python .subagent/subagent_snapshot.py --subagent janitor --phase post
  ```

  ```bash
  # cleanup when everything is done
  python .subagent/subagent_snapshot.py --subagent implementation --clean
  python .subagent/subagent_snapshot.py --subagent janitor --clean
  ```

- **Required diff script**: `python .subagent/subagent_diff.py --subagent <implementation|janitor>` writes three outputs to `.subagent/`:
  - `delta_files_*` (file list)
  - `delta_stat_*` (stat summary)
  - `delta_*.patch` (single unified patch that includes both pre-existing and subagent changes; **primary source of truth**)

  Agents **must** read `delta_*.patch` as the main way to see actual changes, then use the summaries for quick scanning. The unified patch includes labeled sections for pre-existing changes and subagent changes.

- **Short example** (illustrating pre-existing vs subagent changes; shown as two sequential diffs):

  ```diff
  # Pre-existing changes (before subagent)
  -const foo=1
  +const foo =1
  ```

  ```diff
  # Subagent changes (after subagent)
  -const foo =1
  +const foo = 1;
  ```

  ```yaml
  - filename: lib/foo.ts
    pre_existing_changes: "delta_implementation.patch: lines 1-4 (Pre-existing changes section)"
    subagent_changes: "delta_implementation.patch: lines 6-10 (Subagent changes section)"
    summary: "Normalized spacing for foo constant."
  ```

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
