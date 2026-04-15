# CLAUDE.md — cucumber-autotests

Cucumber-js 11.x + Playwright (core) + Dappwright + TypeScript (ESM). BDD e2e tests against the
TradeGenius Web3 dApp. Deliverable for the QA assessment.

## Where to look first

- **Conventions** — `.claude/skills/e2e-conventions/SKILL.md`. Stack rules, layout, singleton
  pattern, reconciler, POM boundaries, selector priority, Gherkin quality, anti-patterns. Preloaded
  into every e2e subagent.
- **Pipeline** — `.claude/skills/e2e-test-builder/SKILL.md`. Orchestrated workflow for new features
  or framework changes. Run `/e2e-test-builder <description>` to start.
- **Subagents** — `.claude/agents/`. Thinker agents (`e2e-architect`, `dapp-explorer`,
  `e2e-test-reviewer`) and doer agents (`e2e-framework-builder`, `e2e-test-writer`).

## Commands

```bash
npm install
npm run browsers:install     # Playwright chromium (one-time)
npm test                     # full suite
npm run test:smoke           # @smoke only
npm run typecheck            # strict TS
npm run lint
npm run format
```

Run a single feature: `npm test -- features/<name>.feature`. Filter by tag:
`npm test -- --tags @smoke`.

## Scope boundaries (enforced by subagents)

- `features/support/**` and `pages/wallet/**` are framework infrastructure (singleton, hooks,
  reconciler, tag parser, MetaMask selectors, logger, wallet wrapper). Touch via
  `e2e-framework-builder`.
- `features/**` (feature files + step definitions) and `pages/**` excluding `pages/wallet/` are
  business tests. Touch via `e2e-test-writer`.
- Plans before code. `e2e-architect` produces `plan.md` under `.claude/scratchpads/<task>/` before
  any doer agent runs.

## Secrets and configuration

- Seed phrase, wallet password, absolute profile paths live in `.claude/settings.local.json`
  (gitignored) and never in committed files.
- `.env.local` is gitignored; commit `.env.example` with placeholders only.
- Hardcoded URLs, seeds, or passwords are a Critical review finding.

## Reports and scratchpads

- Cucumber HTML/JSON output under `reports/` (gitignored).
- Inter-agent context passing under `.claude/scratchpads/<task>/` (gitignored). Worktree isolation
  output under `.claude/worktrees/` (gitignored).

## Bugs

Bugs in the dApp itself go to `BUGS.md` at this directory's root. See `e2e-conventions` for the
exact entry format.
