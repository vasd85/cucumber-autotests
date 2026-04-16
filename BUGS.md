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

## Wallet sign-request messages contain raw JSON instead of human-readable text

- **Summary:** During the wallet-connect flow, both signature requests
  (`approveConnection` and `signMessage`) display raw JSON payloads in the
  MetaMask approval popup instead of a clear, user-friendly message explaining
  what the user is signing.
- **Repro:**
  1. Navigate to `https://dev.tradegenius.com/asset`.
  2. Click "Connect Wallet" → select MetaMask.
  3. Approve the connection in MetaMask — observe the first signature request
     (`approveConnection`): the popup body shows raw JSON:
     ```
     {"statement":"By signing this message, you authenticate access to your TradeGenius account, and agree to the Terms & Conditions.","domain":"tradegenius.com","nonce":"...","expirationTime":"..."}
     ```
  4. After approving, a second signature request (`signMessage`) appears with
     another raw JSON blob:
     ```
     {"parameters":{"publicKey":"...","expirationSeconds":"1209600"},"organizationId":"...","timestampMs":"...","type":"ACTIVITY_TYPE_STAMP_LOGIN"}
     ```
- **Expected:** Each signature popup should present a human-readable, formatted
  message — e.g. a plain-English statement for `approveConnection` and at most
  a brief explanation of the stamp-login action for `signMessage`. Technical
  fields (`nonce`, `organizationId`, `publicKey`, etc.) should be hidden or
  shown only in an expandable "Details" section.
- **Actual:** Both popups dump the full JSON object as-is. Non-technical users
  see opaque machine data with no clear indication of what they are consenting
  to, which erodes trust and violates standard Web3 UX practices (EIP-4361 /
  Sign-In with Ethereum recommends a human-readable `statement` rendered as
  plain text, not embedded in a JSON wrapper).
- **Severity:** major — directly affects user trust and informed consent.
  Signing opaque data is a well-known phishing vector; users trained to "just
  click Sign" on unreadable messages are more vulnerable to malicious dApps.

---

## Terms of Service dialog flashes briefly for a returning user who already accepted it

- **Summary:** When a previously registered wallet (Terms already accepted,
  2FA not yet configured) connects after the browser's site data has been
  cleared, the Terms of Service dialog appears for a split second and then
  disappears on its own before the 2FA setup dialog opens. The user should
  never see the ToS form again after accepting it once.
- **Repro:**
  1. Clear the browser's site data for `dev.tradegenius.com` (cookies,
     localStorage, sessionStorage).
  2. Navigate to `https://dev.tradegenius.com/asset`.
  3. Click "Connect Wallet" → select MetaMask → approve and sign.
  4. Observe the post-login onboarding flow.
- **Expected:** The ToS dialog is not shown at all — the server already knows
  this wallet accepted the terms, so the flow should skip straight to the 2FA
  setup dialog.
- **Actual:** The ToS dialog renders visibly for a brief moment (≈ 100–300 ms),
  then auto-dismisses and the 2FA dialog appears. The flash is noticeable and
  gives the impression of a broken or unstable UI.
- **Severity:** minor — no data loss or functional breakage, but the visual
  glitch undermines perceived quality. Likely a race condition: the client
  renders the default onboarding step before the server response confirming
  ToS acceptance arrives and advances the flow.

---

## Missing space in 2FA email verification dialog text

- **Summary:** On the email-based 2FA code entry form, two sentences are
  concatenated without a space: `"...via email.Please check..."`.
- **Repro:**
  1. Log in with a wallet that has email-based 2FA enabled.
  2. Observe the text on the 2FA code entry dialog.
- **Expected:** `"You have Two Factor Authentication enabled via email. Please
  check the email address you used to enable Two Factor Auth to receive a
  code."`
- **Actual:** `"You have Two Factor Authentication enabled via email.Please
  check the email address you used to enable Two Factor Auth to receive a
  code."` — no space after the period.
- **Severity:** trivial — cosmetic typo, no functional impact.

---
