---
name: e2e-test-builder
description: >-
  Full pipeline for building and extending the Cucumber + Playwright + Dappwright e2e framework and
  writing new UI e2e tests for the TradeGenius dApp. Use when creating a new .feature file, adding
  step definitions, extending page objects, wiring a new wallet flow, scaffolding framework
  infrastructure (World, hooks, browser-session, wallet service), or exploring unknown dApp UI
  before testing. Coordinates thinker agents (e2e-architect, dapp-explorer, e2e-test-reviewer) and
  doer agents (e2e-framework-builder, e2e-test-writer) through file-based context passing, and can
  drive a real browser via MCP to map dApp flows.
disable-model-invocation: true
argument-hint: '<feature description, user flow, or dApp URL>'
---

ultrathink

# E2E Test Builder Pipeline

You are the orchestrator for creating e2e tests against a Web3 dApp using Cucumber-js + Playwright
(core) + Dappwright + TypeScript (ESM). You coordinate specialized thinker and doer agents through
scratchpad files.

**Your responsibilities:**

- Assess task complexity and choose the right pipeline path
- Decide whether the target dApp needs live exploration before planning
- Relay context between agents via scratchpad files
- Keep the user informed and in control at decision points
- Monitor quality — don't proceed if a phase fails

**You do NOT:** write feature files, step definitions, page objects, framework code, or reviews
yourself. You delegate to specialized agents.

**Working directory assumption:** you are running from `cucumber-autotests/` (the Cucumber project
root). All paths below are relative to that directory unless marked absolute.

## Setup

1. Derive a short kebab-case task name from `$ARGUMENTS` (e.g., `connect-metamask`,
   `swap-token-happy-path`, `add-wallet-reconciler`). If `$ARGUMENTS` is empty or gives no hint of a
   name, ask the user for one via `AskUserQuestion` before creating any files.
2. Create the scratchpad directory:
   ```bash
   mkdir -p .claude/scratchpads/<task-name>
   ```
3. Save the full task description to `.claude/scratchpads/<task-name>/task.md` with the Write tool —
   the single source of truth for all agents and session recovery. Include:
   - The raw `$ARGUMENTS` string
   - Any URLs, wallet flows, or acceptance criteria the user added
   - Any environment details (dApp URL, network, test account)
4. Decide whether to continue or branch fresh:
   - **Continuation:** if `.claude/scratchpads/<task-name>/phase-state.md` already exists AND the
     current branch is `test/<task-name>`, stay on the branch. Skip the rest of this step.
   - **Fresh start:** create a working branch off an up-to-date `main`. Refuse to proceed with a
     dirty tree; ask the user to resolve.

     ```bash
     test -z "$(git status --porcelain)" || { echo "Working tree is dirty — resolve before creating a branch"; exit 1; }

     CURRENT=$(git rev-parse --abbrev-ref HEAD)
     if [ "$CURRENT" != "main" ]; then
       git checkout main
     fi
     git pull --ff-only origin main
     git checkout -b test/<task-name>
     ```

5. Capture the absolute scratchpad path (worktree agents need it — the scratchpad dir is gitignored
   and invisible inside worktrees):
   ```bash
   SCRATCHPAD="$(cd .claude/scratchpads/<task-name> && pwd)"
   ```
   Use `$SCRATCHPAD` in all prompts to worktree agents.

## Phase Tracking

At the start of each phase, update the phase state file:

```bash
echo "phase: <N> — <phase-name>" > .claude/scratchpads/<task-name>/phase-state.md
echo "status: in-progress" >> .claude/scratchpads/<task-name>/phase-state.md
echo "started: $(date -Iseconds)" >> .claude/scratchpads/<task-name>/phase-state.md
```

A new session can read `phase-state.md` to know where to resume.

## Phase 1: Assess

Read the task description and classify it against two axes:

**Scope axis:**

- **Test-only** — the needed framework (World, hooks, wallet wrapper, POMs for touched flows)
  already exists. Only `.feature`, step defs, and maybe new POMs need to be written.
- **Framework-extending** — the task requires new or modified infrastructure: new wallet strategy,
  new hook, new shared helper, reconciler, tag parser, new singleton, etc.

**Exploration axis:**

- **Known UI** — the user provided explicit selectors, or the feature touches pages already covered
  by existing POMs.
- **Unknown UI** — the task mentions a new page, flow, modal, or the user provided only a URL.
  Selectors, element roles, and flow details must be discovered in a real browser before planning.

Decision matrix:

| Scope × Exploration           | Pipeline                              |
| ----------------------------- | ------------------------------------- |
| Test-only × Known             | Skip 2 and 4. Run 3 → 5 → 6 → 7.      |
| Test-only × Unknown           | Skip 4. Run 2 → 3 → 5 → 6 → 7.        |
| Framework-extending × Known   | Skip 2. Run 3 → 4 → 5 → 6 → 7.        |
| Framework-extending × Unknown | Run all phases 2 → 3 → 4 → 5 → 6 → 7. |

Tell the user which path you chose and why. Confirm before proceeding.

## Phase 2: Explore the dApp (conditional)

Run when the Exploration axis is **Unknown**.

Spawn the **dapp-explorer** agent. This agent uses **Playwright MCP** attached to a persistent
Chrome profile with MetaMask pre-installed and pre-seeded (see `references/browser-profile-setup.md`
next to this skill for the one-time setup). It unlocks MetaMask at session start, opens the dApp,
traverses the relevant flow, and captures selectors, role/text queries, network calls, and timing.

Prompt template:

```
Explore the TradeGenius dApp for the task described in the task file.

Context file: .claude/scratchpads/<task-name>/task.md

Your job is to:
- Open the dApp at the URL in the task (or the production default).
- Walk the relevant user flow end to end, as a human would.
- For every UI step, record the stablest locator available
  (role/text > data-testid/data-qa > CSS), exact element text,
  visible state transitions, and any loading/retry behaviour.
- Capture the wallet-connect popup flow: which wallet tile triggers
  the popup, popup structure (buttons by role + accessible name +
  testid), method name in the popup body, which Dappwright action
  maps to each user click.
- For Approve / Confirm / Sign, **hand off to the user**: announce
  the popup in chat, wait for them to click in the browser, then
  record the post-action dApp state. Do not click wallet-level
  buttons yourself. On timeout, check in with the user via
  AskUserQuestion rather than force-cancelling.
- Note any bugs, spec deviations, or UX oddities for BUGS.md.

Do NOT write any test code. Write your exploration report to:
.claude/scratchpads/<task-name>/exploration.md
```

After exploration finishes:

1. Read the `## Summary` and `## Selector Catalogue` sections of `exploration.md` (use
   `offset`/`limit` — the full file can be long).
2. If the explorer flagged bugs in the dApp itself, append them to `BUGS.md` at the
   cucumber-autotests root following the project's bug-report format (Summary, Repro, Expected,
   Actual, Severity).
3. Present a short summary to the user and ask if the mapped flow matches their intent. Wait for
   confirmation.

**If Playwright MCP is not attached** (or the MetaMask profile is missing / not seeded), stop and
tell the user:

> Playwright MCP with the MetaMask profile is required for Phase 2 and is not attached. Follow the
> one-time setup in `.claude/skills/e2e-test-builder/references/browser-profile-setup.md`, confirm
> that `.claude/settings.local.json` defines the `playwright` MCP with `--user-data-dir` and
> `METAMASK_PASSWORD`, and retry.

Do not fall back to a manual checklist — live exploration is a hard requirement because the
TradeGenius flow is wallet-gated.

## Phase 3: Plan

Spawn the **e2e-architect** agent. This single agent designs both the framework changes (if any) and
the BDD scenarios — Gherkin structure and POM shape are too coupled to split across agents for e2e
work.

```
Design the e2e test plan for the task.

Context files:
- Task: .claude/scratchpads/<task-name>/task.md
- Exploration (if it exists): .claude/scratchpads/<task-name>/exploration.md

Produce a plan covering:
1. Framework changes (if any): new/modified files in features/support/**,
   pages/**, wallet service, hooks, tag parser, reconciler, etc.
2. POM shape: page objects to create or extend, with locators and UI
   actions only (no business logic).
3. BDD scenarios: Gherkin Background/Scenario/Outline with tags.
4. Step definitions to add or reuse.
5. Data/config additions (env vars, seed phrase, network config).
6. Affected files table + dependency-ordered implementation steps.

Write the plan to: .claude/scratchpads/<task-name>/plan.md
```

After the architect finishes:

1. Read the `## Summary`, `## Affected Files`, and `## Implementation Steps` sections of `plan.md`.
   Use `offset`/`limit`.
2. Present the plan to the user. Highlight any framework changes and ask for confirmation —
   framework changes are higher risk than a single new feature file.
3. **Wait for user approval.** Do not proceed without confirmation.
4. On request, adjust the plan yourself or re-spawn the architect.

## Phase 4: Build framework (conditional)

Run only when the plan's Scope axis is **Framework-extending**.

**Reminder:** The user approved the plan in Phase 3. Unless the user explicitly requested
review-before-commit in this session, let each doer's own workflow handle committing — do not layer
extra "don't commit yet" instructions on top.

Spawn the **e2e-framework-builder** agent:

```
Implement the framework changes described in the plan.

Context files:
- Task: .claude/scratchpads/<task-name>/task.md
- Plan: .claude/scratchpads/<task-name>/plan.md
- Exploration (if relevant): .claude/scratchpads/<task-name>/exploration.md

Scope: only the framework-level changes listed under "Framework Changes"
in the plan (files under features/support/**, pages/wallet/**, hooks,
reconciler, tag parser, World, browser-session). Do NOT write feature
files or step definitions — that is the test-writer's job.

After completing, write progress to:
.claude/scratchpads/<task-name>/framework-progress.md
```

After the builder finishes:

1. Read the `## Summary` and `## Files` sections of `framework-progress.md`. The builder's Stop hook
   has already run `npm run typecheck && npm run lint` — completion implies they passed.
2. If the builder reported blockers for the test-writer (missing helper, unresolved design
   question), surface them to the user before starting Phase 5.

## Phase 5: Write tests

Spawn the **e2e-test-writer** agent. Use one agent for a single feature file / POM. Parallelize only
if the plan contains 2+ independent feature files that don't share new step definitions or POM
changes.

**Single feature / sequential:**

```
Implement the test scenarios described in the plan.

Context files:
- Task: .claude/scratchpads/<task-name>/task.md
- Plan: .claude/scratchpads/<task-name>/plan.md
- Exploration (if it exists): .claude/scratchpads/<task-name>/exploration.md
- Framework progress (if Phase 4 ran):
  .claude/scratchpads/<task-name>/framework-progress.md

Scope: .feature files, step definitions, and page objects only.
Do NOT modify framework infrastructure — if you need a helper that
doesn't exist, flag it in your progress file for a follow-up pass.

Run `npm test` (or `npm run test:smoke` if your scenarios are
@smoke-tagged) to verify locally before completing.

After completing, write progress to:
.claude/scratchpads/<task-name>/test-progress.md
```

**Parallel feature files** — spawn each test-writer with `isolation: "worktree"`. Use `$SCRATCHPAD`
for absolute paths:

```
Implement the test scenarios described in the plan.

Context files (absolute paths — you are in a worktree):
- Task: $SCRATCHPAD/task.md
- Plan: $SCRATCHPAD/plan.md
- Exploration: $SCRATCHPAD/exploration.md (if exists)
- Framework progress: $SCRATCHPAD/framework-progress.md (if exists)

Your chunk: <feature file name or scenario group>

Commit your work on the worktree branch before finishing. At the top of
your progress file write a `Branch: <branch-name>` line so the
orchestrator can merge — e.g. `Branch: test/connect-wallet-worktree-1`.

After completing, write progress to:
$SCRATCHPAD/test-progress-<chunk>.md
```

After parallel worktree agents complete — merge step:

1. For each chunk's `test-progress-<chunk>.md`, read the `Branch:` header. If a progress file has no
   `Branch:` line the worktree agent did not commit — surface the failure to the user and do not
   proceed with merges for that chunk.
2. Merge each reported worktree branch into the current branch:
   ```bash
   git merge <worktree-branch> --no-edit
   ```
3. Run `npm run typecheck && npm test` on the merged result.
4. If tests fail because of a merge artifact (e.g., conflicting step definition names), resolve in
   the main session or re-spawn the affected test-writer.

**Wait for ALL test-writer commits to finish before proceeding.**

## Phase 6: Review

Spawn the **e2e-test-reviewer** agent:

```
Review the e2e changes on this branch.

Context files:
- Task: .claude/scratchpads/<task-name>/task.md
- Plan: .claude/scratchpads/<task-name>/plan.md  (may not exist for small tasks)
- Framework progress (if Phase 4 ran):
  .claude/scratchpads/<task-name>/framework-progress.md
- Test progress: .claude/scratchpads/<task-name>/test-progress*.md

Then review the diff:
- `git diff main...HEAD` (or `git diff` if not on a branch) for the full diff.
- `git log main..HEAD --oneline` for commit history.

Verify that the implementation fulfils the task, follows the plan, and
upholds the conventions from the e2e-conventions skill (locator priority,
World typing, no arrow-function hooks, singleton pattern, selector
centralisation, etc.).

Write the review to: .claude/scratchpads/<task-name>/review.md
```

After the reviewer finishes:

1. Read the `### Verdict` section of `review.md` first. Only read `### Findings` if the verdict
   requires fixes.
2. If verdict is **Ready to run** — proceed to Phase 7.
3. If **Critical** findings: spawn the appropriate doer (e2e-framework-builder for framework issues,
   e2e-test-writer for test issues) with:

   ```
   Fix the critical issues listed in the review report.

   Context files:
   - Review: .claude/scratchpads/<task-name>/review.md
   - Plan: .claude/scratchpads/<task-name>/plan.md
   - Prior progress: .claude/scratchpads/<task-name>/*-progress*.md

   Fix only the items marked Critical. Commit each fix separately.
   ```

   After fixes, loop back to Phase 5 verification (`npm test`) then re-enter Phase 6 for a second
   pass.

4. If only **Warning** findings: present each to the user and ask whether to fix now, defer, or
   skip.

**Max review cycles: 2.** If still failing after 2 cycles, report the remaining issues to the user
and ask how to proceed.

## Phase 7: Verify and report

1. Run the suite at the appropriate scope:
   ```bash
   npm test                # full suite
   npm run test:smoke      # only @smoke
   ```
2. If tests fail:
   - Read the Cucumber HTML/JSON report under `reports/`.
   - Classify each failure:
     - **Test bug** (selector wrong, flaky wait, timing) — re-spawn `e2e-test-writer` with the
       failure.
     - **dApp bug** (application misbehaves) — append to `BUGS.md` and mark the scenario `@bug` (or
       skip with a reason). Do NOT change assertions to make a bug pass.
     - **Framework bug** — re-spawn `e2e-framework-builder`.
3. If the user asked for a PR, ask confirmation, rebase on main, then open the PR:
   ```bash
   gh pr create --title "<title>" --body "<body>"
   ```
4. Summarise for the user:
   - Files created or changed
   - Scenarios added (by name and tag)
   - Bugs captured in BUGS.md (by title)
   - Open items or follow-up work

## Error Handling

- If any agent fails (crashes, no output, infinite loop): report to the user, do not retry
  automatically. Let the user decide.
- If `npm run typecheck` or `npm test` fails between phases: fix before proceeding. Never pass
  broken code to the next phase.
- If the user wants to stop mid-pipeline: that's fine. Scratchpad files preserve all context for
  later resume.
- If a browser MCP disconnects mid-exploration: tell the user, offer to resume or fall back to
  selector-discovery.

## Session Recovery

All intermediate artefacts live in `.claude/scratchpads/<task-name>/`. A new session can resume by:

1. Reading `phase-state.md` to identify the last active phase.
2. Cross-checking with `git log` and `git status` for commits that may have landed after
   `phase-state.md` was written.
3. Picking up from the last completed phase. If `phase-state.md` says "in-progress", re-run that
   phase — partial results are not guaranteed.

## Scratchpad Files

| File                         | Written by            | Read by                                                                 |
| ---------------------------- | --------------------- | ----------------------------------------------------------------------- |
| `task.md`                    | orchestrator          | all agents                                                              |
| `exploration.md`             | dapp-explorer         | e2e-architect, e2e-test-writer, orchestrator                            |
| `plan.md`                    | e2e-architect         | e2e-framework-builder, e2e-test-writer, e2e-test-reviewer, orchestrator |
| `framework-progress.md`      | e2e-framework-builder | e2e-test-writer, e2e-test-reviewer, orchestrator                        |
| `test-progress[-<chunk>].md` | e2e-test-writer       | e2e-test-reviewer, orchestrator                                         |
| `review.md`                  | e2e-test-reviewer     | doer (fix cycle), orchestrator                                          |
| `phase-state.md`             | orchestrator          | orchestrator (session recovery)                                         |

**Read dependencies by agent:**

- dapp-explorer → `task.md`
- e2e-architect → `task.md` + `exploration.md` (if exists)
- e2e-framework-builder → `task.md` + `plan.md` + `exploration.md` (if relevant)
- e2e-test-writer → `task.md` + `plan.md` + `exploration.md` + `framework-progress.md` (if exist)
- e2e-test-reviewer → `task.md` + `plan.md` + `*-progress*.md` + git diff
- Doers (fix cycle) → `review.md` + `plan.md` + prior progress files
