# ShelfArc Agent Guidelines

At any point, use the `ask_questions` tool to clarify ambiguous requirements or confirm high-risk decisions.

## Subagents

- **Important**: Whenever possible, **ALWAYS** run subagents in **parallel**. Do not wait for one subagent to finish before starting another unless they depend on each other.
- Use `runSubagent` proactively for bounded, self-contained tasks (research, refactor, triage, automation, complex edits) and prefer specialized agents to execute Plan items.
- Always include: **goal**, **constraints**, and **context** when invoking any subagent.
- **Important**: Be **VERY** thorough when providing context to subagents. The more context you provide, the better the subagent's output will be.
- Keep subagent prompts focused and bounded — each `runSubagent` should have a clear deliverable.
- **Important**: When a subagent reports back such as any changes made, **believe** and if needed read the changes to update your context. Do not assume the subagent's output is incorrect without checking the actual changes.

---

## Libraries & Docs

- Use Context7 / `get_library_documentation` for external library docs
