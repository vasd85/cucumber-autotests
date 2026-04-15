---
name: e2e-conventions
description: >-
  Core conventions and architectural principles for the TradeGenius Cucumber + Playwright +
  Dappwright e2e project. Preloaded into the e2e-architect, dapp-explorer, e2e-framework-builder,
  e2e-test-writer, and e2e-test-reviewer subagents. Use this skill whenever writing, reviewing, or
  planning e2e tests, page objects, step definitions, wallet services, Cucumber hooks, or framework
  infrastructure.
user-invocable: false
---

# E2E Conventions

Single source of truth for the Cucumber e2e project under `cucumber-autotests/`. Covers stack rules,
structural conventions, and the Web3-specific patterns that make the suite reliable against a real
wallet extension.

## Stack

- **Cucumber-js 11.x** is the **runner**. It owns the lifecycle: `BeforeAll`, `Before`, `After`,
  `AfterAll`, World construction, step execution. `@playwright/test` is **not** the runner — only
  the `playwright` (core) library is used for browser automation.
- **Playwright** (library, not test runner) provides `BrowserContext`, `Page`, locators. Imported
  via `@playwright/test` only for the installed Chromium binary, not for `test()`/`expect()`
  wrappers.
- **Dappwright 2.x** (`@tenkeylabs/dappwright`) handles wallet extension bootstrap and common wallet
  interactions (`approve`, `sign`, `confirmTransaction`, `switchNetwork`, etc.). It replaces
  Synpress 4.x because Synpress is locked to the Playwright test-fixture system and cannot be driven
  from a Cucumber World.
- **TypeScript (ESM, strict)**. `type: "module"` in `package.json`; `tsx/esm` loader in
  `cucumber.js`. Strict mode is non-negotiable.
- **Node ≥ 20**.

## Directory Layout

```
cucumber-autotests/
├── cucumber.js              # ESM config; tsx/esm loader; report outputs
├── tsconfig.json            # strict, ES2022, moduleResolution=bundler
├── package.json             # "type": "module"
├── features/
│   ├── *.feature            # Gherkin scenarios (one feature per file)
│   ├── step-definitions/    # Given/When/Then implementations
│   └── support/
│       ├── world.ts         # CustomWorld class
│       ├── hooks.ts         # BeforeAll/Before/After/AfterAll
│       ├── browser-session.ts  # singleton init/get/destroy
│       ├── wallet-state.ts  # WalletStateConfig interface + defaults
│       ├── wallet-reconciler.ts  # per-scenario state reset
│       ├── tag-parser.ts    # Cucumber tag → WalletStateConfig
│       └── metamask-selectors.ts  # all MM data-testid selectors (centralised)
├── pages/                   # Page Object Model
│   ├── <page>.page.ts       # locators + UI actions only
│   └── wallet/
│       └── MetaMaskWallet.ts  # thin wrapper over Dappwright
└── reports/                 # gitignored Cucumber output
```

## Single Browser Session (Critical)

`bootstrap()` from Dappwright is expensive (5-15s: downloads MetaMask, launches Chromium, walks
onboarding). It must run **once per worker process**, not once per scenario.

- `BeforeAll` initialises a module-level singleton (`browser-session.ts`) holding
  `{ context, wallet, page }`.
- `Before` retrieves the singleton and assigns references to the World (`this.page`, `this.wallet`,
  `this.context`).
- `After` captures a screenshot on failure and clears dApp state (`localStorage`, `sessionStorage`,
  cookies).
- `AfterAll` closes the context.

**Do not** call `bootstrap()` from `Before`. **Do not** store the session on the World — the World
is per-scenario, the session is per-process.

## World

```typescript
export class CustomWorld extends World {
  page!: Page;
  wallet!: Dappwright;
  context!: BrowserContext;

  constructor(options: IWorldOptions) {
    super(options);
  }
}
setWorldConstructor(CustomWorld);
```

All step definitions and hooks that need `this` **must use the `function` keyword**, never arrow
functions — arrows bind `this` to the enclosing scope and Cucumber cannot inject the World.

```typescript
// WRONG
Given('the user is on the landing page', async () => { … });

// RIGHT
Given('the user is on the landing page', async function (this: CustomWorld) { … });
```

## Wallet State Reconciliation

MetaMask state leaks between scenarios when the context is reused: `PermissionController`,
`ApprovalController`, `NetworkController`, `AccountsController`, `TransactionController`, and more
all persist in `chrome.storage.local`. Without reconciliation, a scenario that "connects for the
first time" will never see the approval popup after an earlier connect.

Use a **hybrid reconciler**:

- `clearPendingApprovals` and `revokePermissions` → fast programmatic path via
  `chrome.storage.local` in the extension service worker, with UI fallback on failure.
- `switchNetwork`, `switchAccount`, `lock` → Dappwright API (stable).
- Idempotent: always apply desired state, do not read first.

Declare desired state via Cucumber tags parsed in `Before`:

```gherkin
@wallet:default @revokePermissions
Scenario: Connect wallet for the first time
  ...

@network:arbitrum @account:1
Scenario: Swap on Arbitrum with second account
  ...
```

Tag parser (`tag-parser.ts`) maps tags to a `WalletStateConfig`, reconciler applies it, then the
dApp's own `localStorage` is cleared.

## Page Object Model

- **Location**: `pages/<page>.page.ts`. Subfolder per domain if the suite grows (`pages/swap/`,
  `pages/assets/`).
- **Contents**: locators (`page.getByRole('button', { name: 'Connect' })`) and UI actions
  (`clickConnect()`, `waitForAssetList()`) only.
- **Forbidden in POM**: business logic, assertions about app state, step orchestration, HTTP calls,
  Cucumber imports. Those belong in step definitions.
- **Constructor**: takes a `Page` (and optionally `BrowserContext`) and nothing else. No singletons
  inside pages.
- **Wallet extension pages** live under `pages/wallet/` and are thin wrappers around Dappwright —
  step defs never import `dappwright` directly.

## Selector Priority

In order, strongest first:

1. **Role + accessible name** — `page.getByRole('button', { name: 'Connect Wallet' })`.
2. **Text locator** — `page.getByText('Connect Wallet')`, scoped.
3. **`data-testid`** / **`data-qa`** if the app exposes them.
4. **Structural CSS / XPath** — last resort; document the reason inline.

Avoid class-based selectors (`.btn-primary`) and deep descendant chains. All MetaMask extension
selectors live in `features/support/metamask-selectors.ts` so a MetaMask upgrade is one-file-atomic.

## Gherkin Quality

- **Declarative, not imperative.** "Given the user is signed in with MetaMask" — not "When the user
  clicks the Connect Wallet button and selects MetaMask and types the password".
- **Business language.** A product owner should read a scenario and recognise a flow, not a DOM
  walkthrough.
- **One Scenario = one observable outcome.** Long chains belong in multiple scenarios or a Scenario
  Outline.
- **Reuse steps.** A new step wording for an existing action is a smell — extend or rename the
  existing step.
- **Backgrounds** only for true setup shared by every scenario in the feature. Don't force-feed
  unrelated scenarios through a Background.
- **Tags** are a contract: `@smoke`, `@regression`, `@wallet:<state>`, `@network:<name>`,
  `@account:<n>`, `@bug`. Add to the tag catalogue in `features/support/tag-parser.ts` when
  introducing a new tag.

## Step Definitions

- **Location**: `features/step-definitions/<domain>.steps.ts`.
- **`function` keyword** (see World section above).
- **No business logic in regex** — parse with `string` + `cucumber-expressions`.
- **Step granularity**: one step calls one page action or one assertion. Composite steps belong in
  `common.steps.ts` only when the composition is genuinely domain-wide.
- **Assertions** live in step defs, not pages. Use Playwright's auto-waiting assertions
  (`expect(locator).toBeVisible()`) from `@playwright/test`'s `expect` — imported as a library, not
  as a test-runner fixture.

## Timing and Waits

- **Never** `page.waitForTimeout(<ms>)` in production tests. Flaky by construction. Reserve for
  local debugging, remove before commit.
- Prefer Playwright auto-waiting locators and assertions.
- For wallet popups, use Dappwright's awaited methods (`await wallet.approve()`) which poll for the
  popup window.
- Explicit `waitForEvent`, `waitForResponse`, or `waitForLoadState` only when auto-waiting is
  insufficient and the reason is documented.

## Configuration and Secrets

- **Never hardcode URLs.** Read from env (`DAPP_URL`, `WALLET_SEED`, `METAMASK_VERSION`,
  `WALLET_PASSWORD`). Default to the documented dev URL only when no env is set, and log the
  resolved URL on start.
- **Never commit seed phrases** — `.env` and `.env.local` are in `.gitignore`; commit `.env.example`
  with placeholder values.
- **Test-only seed phrase**, never reuse a real-fund wallet.

## Logging

- `no-console` is an ESLint error. Use a logger module (create one if missing:
  `features/support/logger.ts` exporting a small wrapper around `debug` or `pino`).
- Log at phase boundaries (bootstrap start/end, reconciler entry, scenario start/end). Do not log
  every click.

## Reporting and Artefacts

- HTML and JSON reports write to `reports/` (configured in `cucumber.js`). `reports/` is gitignored.
- On scenario failure, `After` saves a screenshot to `reports/screenshots/<scenario>.png` via
  `page.screenshot`.
- CI should publish `reports/cucumber-report.html` and `reports/cucumber-report.json` as build
  artefacts.

## Parallel Execution

Cucumber-js parallel mode spawns separate Node processes. Each worker runs its own `BeforeAll` → its
own bootstrap. The singleton is scoped per process and does not conflict across workers. The
trade-off: parallel workers multiply bootstrap cost (~10s × N workers). Accept for 2-3 workers;
beyond that, invest in a pre-seeded browser profile via `launchPersistentContext`.

## Error Handling in the Framework

- **No silent fallbacks.** If the fast programmatic reconciler throws, log a warning, fall back to
  UI path, and continue.
- **Fail loud** on bootstrap errors — a broken wallet bootstrap means every subsequent scenario
  fails for the wrong reason.
- **Explicit timeouts** on wallet operations. Dappwright defaults are reasonable; override only when
  a flow needs more time.

## Commit Hygiene

- Conventional Commits (`type(scope): summary`). Scopes used in this project: `framework`, `pages`,
  `steps`, `features`, `hooks`, `wallet`, `config`, `ci`, `docs`. Types: `feat`, `fix`, `refactor`,
  `test`, `chore`, `docs`.
- One logical change per commit. Never `git add -A` / `git add .`.
- Never skip hooks with `--no-verify` unless the user explicitly requests it.

## Bug Reporting

- Bugs in the dApp itself go to `BUGS.md` at the `cucumber-autotests/` root. Format per entry:
  ```
  ### <short title>
  - **Summary:** one-sentence description.
  - **Repro:** numbered steps a human can follow.
  - **Expected:** what should happen.
  - **Actual:** what actually happens.
  - **Severity:** blocker | critical | major | minor | cosmetic.
  - **Environment:** URL, wallet, network, build.
  ```
- Bugs surfaced during automated runs get `@bug` on the scenario and a link back to the `BUGS.md`
  entry in a comment above the scenario.

## Anti-Patterns

| Anti-pattern                                           | Fix                                                 |
| ------------------------------------------------------ | --------------------------------------------------- |
| `bootstrap()` inside `Before`                          | Move to `BeforeAll` singleton                       |
| Arrow function in step definition                      | Use `async function (this: CustomWorld) { … }`      |
| Assertions in page objects                             | Move to step definitions                            |
| `page.waitForTimeout(3000)`                            | Use auto-waiting locator or explicit `waitForEvent` |
| Hardcoded `https://dev.tradegenius.com/…`              | Read from env with documented default               |
| MetaMask selectors scattered across files              | Centralise in `metamask-selectors.ts`               |
| New step wording duplicating existing step             | Reuse / rename / parameterise                       |
| Deep CSS selector (`.a > .b .c:nth-child(2)`)          | Use role/text locator                               |
| Importing `dappwright` from step defs                  | Wrap in `pages/wallet/MetaMaskWallet.ts`            |
| Scenarios that depend on the order other scenarios ran | Fix reconciler; scenarios must be independent       |
| Mocking the wallet or the dApp in e2e                  | E2e runs real stack; mocks belong in lower layers   |
