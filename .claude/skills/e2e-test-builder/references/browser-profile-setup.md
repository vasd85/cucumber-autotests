# Browser profile setup for dapp-explorer

The `dapp-explorer` agent drives a real browser via **Playwright MCP** against a
Chrome profile that has MetaMask pre-installed and pre-seeded. This is a
one-time, per-machine setup. Complete it before invoking `/e2e-test-builder`
with an Unknown-UI task (Phase 2).

## One-time setup

1. Pick a dedicated user-data-dir outside the normal Chrome profile so it does
   not interfere with day-to-day browsing. Any path works; the examples use
   `~/.playwright-mcp-profile`:
   ```bash
   mkdir -p ~/.playwright-mcp-profile
   ```
2. Launch Chrome once with that profile:
   ```bash
   # macOS
   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
     --user-data-dir="$HOME/.playwright-mcp-profile"
   # Linux
   google-chrome --user-data-dir="$HOME/.playwright-mcp-profile"
   ```
3. Install MetaMask from the Chrome Web Store in that window.
4. Run MetaMask onboarding with a **test-only seed phrase**. Never a wallet
   that holds real funds. Set a password and remember it.
5. In MetaMask **Settings**:
   - General → Auto-lock timer: maximum (43200 minutes = 30 days).
   - Security & Privacy → Phishing detection: off.
   - Security & Privacy → Incoming transactions: off.
6. Optional: disable MetaMask auto-update via `chrome://extensions` →
   Details → toggle off "Auto update". Keeps popup selectors stable between
   snapshot refreshes.
7. Close Chrome fully (Cmd+Q on macOS, not just the window).

## Clean snapshot (recommended)

MetaMask state drifts across sessions — permissions, connected sites, known
tokens, transaction history. Snapshot the clean profile right after
onboarding so you can reset between important runs:

```bash
tar czf ~/.playwright-mcp-profile.clean.tgz \
  -C ~/.playwright-mcp-profile .
```

Reset before a fresh run:

```bash
rm -rf ~/.playwright-mcp-profile
mkdir  ~/.playwright-mcp-profile
tar xzf ~/.playwright-mcp-profile.clean.tgz -C ~/.playwright-mcp-profile
```

Rebuild the snapshot whenever MetaMask updates its extension version or
storage schema.

## Playwright MCP configuration

Configure the MCP in `cucumber-autotests/.claude/settings.local.json` (this
file is gitignored — it holds the absolute profile path and the wallet
password):

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "-y",
        "@playwright/mcp@latest",
        "--browser", "chrome",
        "--user-data-dir", "/Users/<you>/.playwright-mcp-profile",
        "--viewport-size", "1440,900"
      ],
      "env": {
        "METAMASK_PASSWORD": "<the password you set during onboarding>"
      }
    }
  }
}
```

`cucumber-autotests/.gitignore` already excludes `.claude/settings.local.json`.

## Security rules (strict)

- **Test-only seed phrase.** Never a wallet that holds real funds.
- **Password** lives in `settings.local.json` env only. Never in committed
  files, step definitions, or chat output.
- **Profile dir** stays outside any git repository.
- **MetaMask auto-update:** keep disabled, or rebuild the clean snapshot
  after every upgrade — new versions can change popup selectors and internal
  storage schemas, breaking the agent.
- If `dapp-explorer` reports a broken profile (missing extension, unlock
  failure, popup selector drift), wipe the profile dir and re-onboard. Never
  share the profile.

## Troubleshooting

If `dapp-explorer` reports an attachment failure, check:

1. `.claude/settings.local.json` exists and defines the `playwright` MCP with
   the fields above.
2. `METAMASK_PASSWORD` is set under `env` for that MCP entry.
3. The user-data-dir path is absolute and exists.
4. MetaMask is still installed in the profile (`chrome://extensions` shows it
   enabled when you open Chrome with `--user-data-dir=<the same path>`).
5. The Chrome profile is not already open in another window — Playwright MCP
   needs exclusive access.

Share only the agent's own failure message when asking for help. Never paste
the seed phrase, the password, or the profile contents into chat.
