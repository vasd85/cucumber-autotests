import type { Locator, Page } from 'playwright-core';

/**
 * TradeGenius `/asset` landing page and its own two-step Sign-In funnel:
 *
 *   [header Sign In] → [dialog: "Sign in or create an account"]
 *                    → [button: "Connect with Wallet"] → Reown AppKit modal
 *
 * The Reown modal that opens after `Connect with Wallet` is owned by
 * `WalletConnectModalPage`. TradeGenius exposes no `data-testid` / `data-qa`
 * on its own UI, so locators rely on role + accessible name.
 */
export class AssetPage {
  readonly page: Page;

  readonly signInButton: Locator;
  readonly signInDialog: Locator;
  readonly connectWithWalletButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.signInButton = page.getByRole('button', { name: 'Sign In' });
    // The dialog's `aria-labelledby` does not resolve to a clean accessible
    // name through Playwright — anchor by visible title text instead.
    this.signInDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Sign in or create an account' });
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
   * All three reads happen under one microtask so the poll cannot catch a
   * state where `@appkit/connection_status` has flipped but the connector
   * or Turnkey fields have not yet been written.
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
