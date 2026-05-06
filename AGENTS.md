# AGENTS.md

## 1. Plan Mode Default
- Enter plan mode for any non-trivial task (3+ steps or architectural decisions).
- If something goes sideways, stop and re-plan immediately instead of continuing blindly.
- Use plan mode for verification steps too, not only for implementation.
- Write detailed specs up front to reduce ambiguity.

## 2. Subagent Strategy
- Use subagents liberally to keep the main context window clean.
- Offload research, exploration, and parallel analysis to subagents when appropriate.
- For complex problems, use more subagents deliberately.
- Keep one focused objective per subagent.

## 3. Self-Improvement Loop
- After any user correction, update tasks/lessons.md with the relevant lesson.
- Write rules that prevent the same mistake from happening again.
- Iterate on these lessons over time to reduce repeated mistakes.
- Review relevant lessons at the start of each session.

## 4. Verification Before Done
- Never mark a task complete without proving it works.
- Compare behavior before and after changes when relevant.
- Ask: "Would a strong staff engineer approve this?"
- Run tests, check logs, and demonstrate correctness when possible.

## 5. Demand Elegance (Balanced)
- For non-trivial changes, pause and ask whether there is a more elegant solution.
- If a fix feels hacky, prefer the cleaner solution when reasonable.
- Skip over-engineering for simple and obvious fixes.
- Challenge your own work before presenting it.

## 6. Autonomous Bug Fixing
- When given a bug report, investigate and fix it directly when enough context exists.
- Start from logs, errors, and failing tests.
- Minimize unnecessary back-and-forth with the user.
- Fix failing CI-related issues when the cause is visible in the repository.

## Task Management
1. Plan first: write the plan to tasks/todo.md with checkable items.
2. Verify the plan before starting implementation.
3. Track progress by marking items complete as you go.
4. Explain changes with a short high-level summary at each meaningful step.
5. Document results by adding a review section to tasks/todo.md.
6. Capture lessons by updating tasks/lessons.md after corrections.

## Core Principles
- Simplicity first: make every change as simple as possible with minimal impact.
- Find root causes and avoid temporary fixes when a proper fix is reasonable.
- Follow existing project conventions unless there is a strong reason not to.
- Prefer small, reviewable changes over large messy rewrites.
