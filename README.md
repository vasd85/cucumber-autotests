# cucumber-autotests

E2E test for the TradeGenius Asset platform's Web3 sign-in flow. Deliverable
for the QA home task.

**Stack:** Cucumber-js 11 (runner) · Playwright-core (browser automation, not
`@playwright/test`) · Dappwright (MetaMask bootstrap) · TypeScript strict ESM ·
Node ≥ 20.

**Covered flow**

1. Navigate to `https://dev.tradegenius.com/asset`.
2. Open the Sign-In dialog and pick `Connect with Wallet`.
3. Choose **MetaMask** in the Reown AppKit modal, then the **EVM** chain group.
4. Approve the connect popup and sign the SIWE login message in MetaMask.
5. Assert the post-login header swap (Sign-In disappears, Deposit + Airdrop
   appear) and confirm a Turnkey session was written.

A negative scenario covers the user cancelling the MetaMask popup.

---

## Why this stack (and why not the stack I'd pick from scratch)

The brief mandates **Cucumber (BDD)**. If the runner had been a free choice,
the better stack would be **`playwright-bdd` + Synpress 4.x**:

- `playwright-bdd` translates Gherkin into Playwright Test specs. You keep the
  BDD syntax the brief asks for but the actual runner is `@playwright/test`,
  which unlocks Playwright's fixtures, parallelism, trace viewer, HTML report,
  Allure, and `npx playwright test --ui` debugging.
- **Synpress 4.x** is the de-facto MetaMask automation stack. It caches the
  onboarded MetaMask state via `defineWalletSetup` + browser-state hashing, so
  bootstrap cost is paid once at `globalSetup` and every worker reuses it.
  That is roughly an order of magnitude faster than Dappwright's per-process
  `bootstrap()`, and its popup selectors track MetaMask releases more tightly.

Neither of those is compatible with Cucumber-js as the **runner**:

- Synpress 4.x is tightly coupled to `@playwright/test`'s fixture system
  (`testWithSynpress`, `defineWalletSetup`). It cannot be driven from a
  Cucumber World without re-implementing most of what Synpress provides.
  Existing Cucumber + Synpress examples rely on Synpress v3.x, which had a
  fundamentally different (importable command) API that no longer exists.
- `playwright-bdd` is also disqualified because it keeps `@playwright/test` as
  the runner — the Gherkin is syntactic sugar, not a Cucumber-js execution
  environment. If the brief had said "BDD syntax" instead of "Cucumber", I
  would have chosen it.

So the stack here is **Cucumber-js + playwright-core + Dappwright 2.x**:

- Cucumber-js owns the lifecycle (`BeforeAll`, `Before`, `After`, `AfterAll`,
  World, step execution).
- Playwright is imported as a **library** (`playwright-core`) — no
  `@playwright/test` runner, no Playwright config file. `@playwright/test` is
  pulled in only for the Chromium binary and its `expect` assertion helper.
- Dappwright is runner-agnostic. `bootstrap()` is a plain async function that
  drops into a Cucumber `BeforeAll` cleanly and returns `{ wallet, page,
  context }`.

---

## Scope of the automated login scenario

The automated test **only covers login for an already-onboarded wallet.**

The brief asks for "login", and TradeGenius's login for a returning user is a
single path: connect → sign → header swap. A first-time wallet sees an extra
step — a mandatory username registration dialog.

The test seed phrase in `.env.local` is expected to be a wallet that has
already completed that onboarding once. A new seed will hit the ToS + username
dialog and the current `Then the user is signed in` assertion will time out
because the header swap is gated by the onboarding modal.

**How a first-time registration scenario would be added**

The shape is straightforward, but it carries a test-data cleanup obligation
the suite is not ready for yet:

1. Generate a fresh EVM private key per scenario
   (`ethers.Wallet.createRandom()`), import it into the running MetaMask via
   `wallet.importPK(...)`, and select the new account.
2. Drive the connect flow, accept ToS, generate a random username
   (`test-<uuid>`), submit.
3. After the scenario finishes, **delete the created TradeGenius account
   server-side** so the next run with a fresh key is not contaminated by
   orphaned accounts, and username collisions never occur.

The deletion step requires either a backend test endpoint or an authenticated
admin API. Neither is part of the brief, so the scenario is out of scope for
this deliverable and tracked as a follow-up. Adding it without the cleanup
hook would leak test accounts into the dev environment indefinitely.

---

## Quick start

```bash
cp .env.example .env.local             # fill WALLET_SEED with a test-only seed
npm install
npm run browsers:install               # Playwright Chromium (one-time)
npm test                               # runs every scenario
npm run test:smoke                     # the happy-path MetaMask connect only
npm run typecheck && npm run lint
```

Dappwright downloads the MetaMask extension binary on first run and caches it
under the OS temp dir — there is no `npx synpress`-style prepare step.

Single feature / filter by tag:

```bash
npm test -- features/connect-wallet.feature
npm test -- --tags @smoke
```

Enable namespaced logs via `DEBUG` (wraps the `debug` package):

```bash
DEBUG=tradegenius:* npm test
DEBUG=tradegenius:hooks:*,tradegenius:wallet-reconciler:* npm test
```

---

## Project layout

```
cucumber-autotests/
├── cucumber.js                 # ESM config, tsx/esm loader, report paths
├── package.json                # "type": "module"; scripts: test, typecheck, lint
├── tsconfig.json               # strict ES2022, moduleResolution: bundler
├── .env.example                # template — copy to .env.local
├── BUGS.md                     # manual bugs found while exploring the dApp
├── features/
│   ├── connect-wallet.feature  # Gherkin scenarios (happy path + cancel)
│   ├── step-definitions/       # Given/When/Then
│   │   ├── asset.steps.ts
│   │   ├── wallet-connect.steps.ts
│   │   └── wallet.steps.ts
│   └── support/                # framework infrastructure
│       ├── world.ts            # CustomWorld (page, context, metaMask)
│       ├── hooks.ts            # BeforeAll / Before / After / AfterAll
│       ├── browser-session.ts  # module-level singleton (init/get/destroy)
│       ├── env.ts              # typed .env.local loader
│       ├── logger.ts           # debug-based logger (no-console is enforced)
│       ├── tag-parser.ts       # Cucumber tags → WalletStateConfig
│       ├── wallet-state.ts     # WalletStateConfig + defaults
│       ├── wallet-reconciler.ts# per-scenario state reset
│       └── metamask-selectors.ts # centralised MM data-testid catalogue
└── pages/
    ├── asset.page.ts           # TradeGenius /asset POM
    ├── wallet-connect-modal.page.ts # Reown AppKit modal POM
    └── wallet/
        └── MetaMaskWallet.ts   # thin wrapper over Dappwright
```

`reports/` (Cucumber HTML + JSON + failure screenshots) is gitignored.

---

## How it works

### Single browser session, per-scenario reconciler

`bootstrap()` is expensive (5–15 s — it downloads the extension, launches
Chromium, walks onboarding). Running it per scenario is not viable, so the
lifecycle is:

```
BeforeAll   → bootstrap() → module-level singleton { context, page, metaMask }
Before      → attach singleton to World, reconcile wallet + dApp state, goto()
After       → screenshot on failure (attached to Cucumber report)
AfterAll    → context.close()
```

The module-level singleton lives in `features/support/browser-session.ts`. The
World is a per-scenario container that only holds references — it never owns
the lifecycle.

`wallet-reconciler.ts` is the piece that makes scenarios independent when the
browser context is reused. MetaMask keeps permissions, pending approvals,
networks, and accounts in `chrome.storage.local`; a second scenario that
"connects for the first time" will never see the approval popup if an earlier
scenario left the permission granted. Current reconcile steps:

- Revoke the dApp origin's MetaMask permissions (driven by
  `@revokePermissions`).
- Clear dApp `localStorage`, `sessionStorage`, cookies (HttpOnly included via
  `context.clearCookies()`), and IndexedDB (Turnkey session store).

The `WalletStateConfig` interface is wider than the current implementation:
`network`, `accountIndex`, and `locked` are typed but not yet wired.
`@network:*` / `@account:*` tags throw today as a reminder — adding them is a
reconciler-only change.

### Page Object Model

POMs hold locators and UI actions **only** — no assertions, no business
logic, no Cucumber imports. Assertions live in step definitions. Wallet
extension interactions go through `pages/wallet/MetaMaskWallet.ts`, never
through Dappwright directly, so a future swap to a different wallet driver
(or a fake-provider strategy) changes one file.

### Selectors

Priority: role + accessible name > text > `data-testid`/`data-qa` >
structural CSS. TradeGenius does not expose test-only attributes, so the
`AssetPage` is role/text-driven. The Reown AppKit modal is a web component;
its shadow-DOM `data-testid`s (`w3m-modal-card`, `wui-list-chain-eip155`, …)
are stable and used directly. Every MetaMask selector lives in
`metamask-selectors.ts` so a MetaMask upgrade is a one-file fix.

---

## How to work with the AI agents

This project ships with a Claude Code agent pipeline that automates the
thinker → doer → reviewer loop. It's optional — every file is plain
TypeScript + Gherkin that works standalone — but the pipeline is how new
scenarios and framework changes were (and should be) built.

### Entry point

Run from inside `cucumber-autotests/`:

```
/e2e-test-builder <feature description | user flow | dApp URL>
```

The `e2e-test-builder` skill (`.claude/skills/e2e-test-builder/SKILL.md`)
orchestrates the whole pipeline. It classifies the task along two axes (scope:
test-only vs framework-extending; exploration: known UI vs unknown UI) and
picks the phases needed.

### Agents

| Agent                   | Kind     | Responsibility                                                                                         |
| ----------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `dapp-explorer`         | thinker  | Drives a real browser via Playwright MCP to map UI flows, capture selectors, surface bugs.             |
| `e2e-architect`         | thinker  | Produces `plan.md`: framework changes, POM shape, Gherkin scenarios, affected files, ordered steps.    |
| `e2e-framework-builder` | doer     | Implements framework infra (`features/support/**`, `pages/wallet/**`). Cannot touch feature files.     |
| `e2e-test-writer`       | doer     | Implements feature files, step defs, non-wallet POMs. Cannot touch framework infra.                    |
| `e2e-test-reviewer`     | reviewer | Reads the branch diff + scratchpads, writes `review.md` with Verdict + Findings. Blocks Phase 7 merge. |

The split is enforced by agent tool permissions (`hooks.PreToolUse`, write
paths) — the architect can only write to `.claude/scratchpads/`, the
reviewer can only run `git diff`/`log`/`status`, the doers are bound to their
scope directories.

### Context passing

Agents never share memory. They pass context via files under
`.claude/scratchpads/<task-name>/`:

```
task.md              # the raw input plus user-added constraints
exploration.md       # dapp-explorer's flow + selector report (when relevant)
plan.md              # e2e-architect's design
framework-progress.md# e2e-framework-builder's output
test-progress.md     # e2e-test-writer's output (split per chunk when parallel)
review.md            # e2e-test-reviewer's verdict
phase-state.md       # orchestrator's session-recovery marker
```

The scratchpad directory is gitignored — it is session state, not a
deliverable.

### Conventions

The single source of truth for conventions is
`.claude/skills/e2e-conventions/SKILL.md`, preloaded into every agent. It
covers: stack rules, directory layout, the singleton pattern, the reconciler,
POM boundaries, selector priority, Gherkin quality, step-definition rules,
logging, error handling, and an anti-pattern table. Reviewers who want to see
"what does this project consider a code smell" should read that file.

### Live-browser exploration

`dapp-explorer` requires Playwright MCP attached to a persistent Chrome
profile with MetaMask pre-installed and pre-seeded. The one-time setup lives
in `.claude/skills/e2e-test-builder/references/browser-profile-setup.md`.
Profile path, extension ID, and wallet password are read from
`.claude/settings.local.json` (gitignored) — never hardcoded, never logged,
never committed.

---

## Environment and secrets

- `.env.local` (gitignored) overrides `.env` (gitignored). Template in
  `.env.example`.
- Required keys: `DAPP_URL`, `WALLET_SEED`, `WALLET_PASSWORD`. Optional:
  `METAMASK_VERSION` (blank → Dappwright's `recommendedVersion`), `HEADLESS`
  (default `false`), `DEBUG`.
- The seed must belong to a **test-only** wallet. Never use one that holds
  real funds.
- Hardcoded URLs, seeds, or passwords in committed files are a Critical
  review finding — everything reads from env through `features/support/env.ts`.

---

## Reports

- HTML + JSON: `reports/cucumber-report.html`, `reports/cucumber-report.json`.
- Failure screenshots: `reports/screenshots/<scenario>.png` — also attached
  to the HTML report inline.

---

## Bug log

Manual bugs found while exploring the dApp for this assessment are in
[`BUGS.md`](BUGS.md). Each entry has Summary, Repro, Expected, Actual,
Severity, and Environment — the format prescribed in `e2e-conventions`.
