import { DEFAULT_WALLET_STATE, type WalletStateConfig } from './wallet-state.ts';

/**
 * Catalogue of recognised tags. A tag in one of the namespaced families
 * (`@wallet:*`, `@network:*`, `@account:*`) that does not match a known
 * value throws — so typos in feature files surface immediately instead of
 * producing a silently-misconfigured run.
 *
 * Metadata-only tags (`@smoke`, `@regression`, `@bug`) are pass-through:
 * Cucumber uses them for filtering; the reconciler ignores them.
 */

const METADATA_TAGS = new Set(['@smoke', '@regression', '@bug']);

const WALLET_FAMILY_VALUES = new Set(['default']);

/**
 * Parse a list of Cucumber tags (e.g. `['@smoke', '@wallet:default',
 * '@revokePermissions']`) into a desired-state config.
 *
 * Unknown tags in a reserved namespace throw. Unknown plain tags are
 * ignored (they may be project-level filters we don't care about).
 *
 * @param tags - Raw tag strings from `pickle.tags`.
 * @param dappOrigin - The origin (scheme + host) to revoke permissions for
 *   when `@revokePermissions` is present.
 */
export function parseTags(tags: readonly string[], dappOrigin: string): WalletStateConfig {
  const config: WalletStateConfig = { ...DEFAULT_WALLET_STATE };

  for (const tag of tags) {
    if (METADATA_TAGS.has(tag)) {
      continue;
    }

    if (tag === '@revokePermissions') {
      config.revokePermissionsForOrigin = dappOrigin;
      continue;
    }

    if (tag.startsWith('@wallet:')) {
      const value = tag.slice('@wallet:'.length);
      if (!WALLET_FAMILY_VALUES.has(value)) {
        throw new Error(
          `Unknown @wallet:* value "${value}" on scenario. Known values: ${Array.from(WALLET_FAMILY_VALUES).join(', ')}.`,
        );
      }
      // `@wallet:default` is a declaration of intent; no override needed.
      continue;
    }

    if (tag.startsWith('@network:')) {
      throw new Error(
        `@network:* tags are declared but not yet wired. See wallet-state.ts TODO. Offending tag: ${tag}.`,
      );
    }

    if (tag.startsWith('@account:')) {
      throw new Error(
        `@account:* tags are declared but not yet wired. See wallet-state.ts TODO. Offending tag: ${tag}.`,
      );
    }

    // Any other tag is caller-defined (e.g. @wip). Ignore.
  }

  return config;
}
