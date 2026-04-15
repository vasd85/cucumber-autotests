# TradeGenius Bug Log

Manual bugs surfaced while exploring the dApp to design the connect-wallet
automated test. Entry format follows `.claude/skills/e2e-conventions/SKILL.md`.

## Environment baseline (shared across entries)

- URL: `https://dev.tradegenius.com/asset`
- Browser: Chromium (Playwright MCP, viewport 1440×900)
- Wallet: MetaMask (real extension, test-only seed)
- Network selected during connect: Ethereum mainnet (`eip155:1`)
- Date observed: 2026-04-15

---

## `/api/asset/multi-pair-info` returns HTTP 500 on every landing-page load

- **Summary:** The `multi-pair-info` backend call fails with HTTP 500 on at
  least two consecutive requests per page load, so whichever widget depends on
  it renders empty / stale while the rest of the page fills in.
- **Repro:**
  1. Open `https://dev.tradegenius.com/asset` in a fresh browser session
     (logged-out is enough).
  2. Open DevTools → Network, filter on `multi-pair-info`.
  3. Reload the page.
- **Expected:** HTTP 200 with the pair-info JSON, or a well-handled
  degradation on the frontend (no console error, no repeated retries).
- **Actual:** HTTP 500 on at least two sequential calls per load. Other
  endpoints on the page succeed, so the overall UI still renders but the
  dependent widget stays blank.
- **Severity:** major — production-adjacent endpoint returning 500 is a
  monitoring / reliability signal and likely masks a missing or slow
  dependency.

---

## Duplicate 404 flood on `/api/proxy-image` for the `wkeyDAO2` token logo

- **Summary:** The trending strip triggers 20+ duplicate HTTP 404 requests
  to the same `/api/proxy-image?url=...wkeyDAO2...small.png` URL on every
  page load, spamming the devtools console and wasting proxy bandwidth.
- **Repro:**
  1. Open `https://dev.tradegenius.com/asset`.
  2. Open DevTools → Network.
  3. Filter by `proxy-image`.
  4. Wait for the trending strip to finish loading.
- **Expected:** Either the proxy returns 200 with an image, or the frontend
  caches the 404 result after the first miss and stops retrying.
- **Actual:** The same proxy URL fires 20+ identical 404s per page load.
- **Severity:** minor — not user-visible, but noisy for operators and a
  signal that the frontend is missing negative-cache / retry logic.

---

## First-time username onboarding commits permanently on a single click

- **Summary:** After a successful connect + SIWE signature, a first-time
  wallet is forced into a mandatory username dialog prefilled with a random
  handle (e.g. `@SexyEinstein`). The dialog shows the warning
  "You can only choose this once." A single click on `Next` commits the
  prefilled handle permanently, with no confirmation step and no way to
  change it later.
- **Repro:**
  1. Connect + sign with a brand-new wallet that has never completed
     TradeGenius onboarding before.
  2. Accept the Terms of Service on the `1/2` dialog.
  3. On the Username dialog, leave the prefilled random handle and click
     `Next`.
- **Expected:** Either a confirmation step ("This handle is permanent —
  continue?") before committing, or the ability to change the handle later
  from account settings.
- **Actual:** One click commits the prefilled handle permanently.
- **Severity:** major — a single accidental tap permanently brands the
  account with a system-generated handle. Data-integrity / UX defect, not
  just cosmetic.

---
