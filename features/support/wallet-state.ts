/**
 * Desired wallet + dApp state at the start of a scenario. The reconciler
 * reads this config (produced by `tag-parser`) and drives the extension +
 * dApp storage to match it, idempotently.
 *
 * The shape is deliberately wider than the current reconciler implements:
 * `network`, `accountIndex`, and `locked` are typed but not wired yet —
 * future tags (`@network:*`, `@account:*`, `@locked`) fill in the reconciler
 * without touching hooks.
 */
export interface WalletStateConfig {
  /**
   * If set, revoke any existing permission the MetaMask extension has
   * granted to this origin before the scenario runs. Typically the dApp's
   * own origin (e.g. `https://dev.tradegenius.com`).
   */
  revokePermissionsForOrigin?: string;
  /**
   * Clear dApp `localStorage`, `sessionStorage`, and cookies on the target
   * page. Default true — scenarios are independent by contract.
   */
  clearDappStorage: boolean;
  /**
   * Desired MetaMask network name (e.g. `Ethereum Mainnet`, `Arbitrum One`).
   * Not wired yet — `// TODO: Action: wire into reconciler when @network:*
   * tag ships.`
   */
  network?: string;
  /**
   * Zero-based index of the MetaMask account to select. Not wired yet —
   * `// TODO: Action: wire into reconciler when @account:* tag ships.`
   */
  accountIndex?: number;
  /**
   * If true, lock the wallet before the scenario runs. If false or undefined,
   * leave the wallet unlocked. Not wired yet — `// TODO: Action: wire into
   * reconciler when @locked tag ships.`
   */
  locked?: boolean;
}

export const DEFAULT_WALLET_STATE: WalletStateConfig = {
  clearDappStorage: true,
};
