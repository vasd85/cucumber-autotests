import type { Locator, Page } from 'playwright-core';

/**
 * TradeGenius `/asset` landing page and its own two-step Sign-In funnel:
 *
 *   [header Sign In] → [dialog: "Sign in or create an account"]
 *                    → [button: "Connect with Wallet"] → hands off to Reown AppKit
 *
 * The Reown modal that opens after `Connect with Wallet` is owned by
 * `WalletConnectModalPage` (separate POM) because it is a self-contained
 * third-party web component with its own shadow-DOM / testid surface.
 *
 * TradeGenius exposes no `data-testid` / `data-qa` on its own UI
 * (see exploration report), so locators here rely on role + accessible
 * name — the only stable option.
 */
export class AssetPage {
  readonly page: Page;

  readonly signInButton: Locator;
  readonly signInDialog: Locator;
  readonly connectWithWalletButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // Role + accessible name: no data-testid on TradeGenius-owned UI.
    this.signInButton = page.getByRole('button', { name: 'Sign In' });
    this.signInDialog = page.getByRole('dialog', { name: 'Sign in or create an account' });
    this.connectWithWalletButton = this.signInDialog.getByRole('button', {
      name: 'Connect with Wallet',
    });
  }

  async openSignInDialog(): Promise<void> {
    await this.signInButton.click();
  }

  async chooseConnectWithWallet(): Promise<void> {
    await this.connectWithWalletButton.click();
  }

  /**
   * Reads the small set of client-storage keys that indicate a live wallet
   * session. Bundled in a single `page.evaluate` so the three reads happen
   * under one microtask — preventing a race where `@appkit/connection_status`
   * has flipped but `@turnkey/session/v2` has not yet been written.
   */
  async readSessionStorageSnapshot(): Promise<SessionStorageSnapshot> {
    return this.page.evaluate(() => ({
      appkitStatus: localStorage.getItem('@appkit/connection_status'),
      turnkeySession: localStorage.getItem('@turnkey/session/v2'),
      connectorId: localStorage.getItem('@appkit/eip155:connected_connector_id'),
    }));
  }

  async readAppkitConnectionStatus(): Promise<string | null> {
    return this.page.evaluate(() => localStorage.getItem('@appkit/connection_status'));
  }
}

export interface SessionStorageSnapshot {
  appkitStatus: string | null;
  turnkeySession: string | null;
  connectorId: string | null;
}
