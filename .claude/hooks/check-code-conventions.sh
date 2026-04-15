#!/usr/bin/env bash
# PreToolUse guard for Write|Edit inside cucumber-autotests.
# Reads Claude Code hook JSON from stdin, exits 2 to block with a message.
# Scoped to files inside cucumber-autotests/ and limited to a short list of
# anti-patterns that must never reach the repo (the reviewer and ESLint catch
# everything else later, so keep this cheap).

set -u

PAYLOAD="$(cat)"
FILE="$(printf '%s' "$PAYLOAD" | jq -r '.tool_input.file_path // empty')"
[ -z "$FILE" ] && exit 0

case "$FILE" in
  *cucumber-autotests/*) ;;
  *) exit 0 ;;
esac

CONTENT="$(printf '%s' "$PAYLOAD" | jq -r '.tool_input.content // .tool_input.new_string // empty')"
[ -z "$CONTENT" ] && exit 0

fail() {
  printf 'Blocked by .claude/hooks/check-code-conventions.sh:\n  %s\n  File: %s\n' "$1" "$FILE" >&2
  exit 2
}

# 1. page.waitForTimeout is flaky by construction (e2e-conventions > Timing).
case "$FILE" in
  *cucumber-autotests/features/*|*cucumber-autotests/pages/*)
    if printf '%s' "$CONTENT" | grep -qE '\bpage\.waitForTimeout\b'; then
      fail 'page.waitForTimeout is forbidden in features/ and pages/. Use auto-waiting locators, expect(), waitForEvent, or waitForResponse.'
    fi
    ;;
esac

# 2. @tenkeylabs/dappwright may only be imported inside pages/wallet/.
case "$FILE" in
  *cucumber-autotests/pages/wallet/*) ;;
  *cucumber-autotests/features/*|*cucumber-autotests/pages/*)
    if printf '%s' "$CONTENT" | grep -qE "(from|require\()[[:space:]]*['\"]@tenkeylabs/dappwright['\"]"; then
      fail '@tenkeylabs/dappwright may only be imported inside pages/wallet/. Wrap it in pages/wallet/MetaMaskWallet.ts and import the wrapper from step defs / pages.'
    fi
    ;;
esac

# 3. Step/hook definitions must use the `function` keyword (Cucumber binds
#    `this: CustomWorld`; arrows silently break World injection).
case "$FILE" in
  *cucumber-autotests/features/step-definitions/*|*cucumber-autotests/features/support/*)
    if printf '%s' "$CONTENT" | grep -qE '\b(Given|When|Then|Before|After|BeforeAll|AfterAll)[[:space:]]*\([^)]*,[[:space:]]*(async[[:space:]]+)?\([^)]*\)[[:space:]]*=>'; then
      fail 'Step and hook definitions must use `async function (this: CustomWorld, ...)` — never arrow functions. Arrows break Cucumber World injection.'
    fi
    ;;
esac

exit 0
