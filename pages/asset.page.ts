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

  readonly depositButton: Locator;
  readonly airdropLink: Locator;
  readonly termsOfServiceDialog: Locator;
  readonly termsOfServiceAccept: Locator;

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

    // Post-login header controls: occupy the same slot that held `Sign In`
    // before the Turnkey session was issued.
    this.depositButton = page.getByRole('button', { name: 'Deposit' });
    this.airdropLink = page.getByRole('link', { name: 'Airdrop' });

    // Transient Terms-of-Service 1/2 dialog that flashes briefly on the
    // first /asset render after a signature. Auto-dismisses for wallets
    // that have already accepted the ToS on a previous run.
    this.termsOfServiceDialog = page.getByRole('dialog').filter({ hasText: 'Terms of Service' });
    this.termsOfServiceAccept = this.termsOfServiceDialog.getByRole('button', {
      name: 'I Accept',
    });
  }

  async openSignInDialog(): Promise<void> {
    await this.signInButton.click();
  }

  async chooseConnectWithWallet(): Promise<void> {
    await this.connectWithWalletButton.click();
  }

  /**
   * Best-effort dismissal of the Terms-of-Service 1/2 dialog that flashes
   * briefly on the first `/asset` render after a signature. For an already-
   * onboarded wallet the dialog auto-dismisses within ~2s; this method waits
   * up to `timeoutMs` for the hidden state, then returns. If the dialog
   * never mounted, the call returns immediately.
   *
   * Does not throw — callers assert the post-login UI themselves.
   */
  async waitForTermsOfServiceToDismiss(timeoutMs = 8_000): Promise<void> {
    try {
      await this.termsOfServiceDialog.waitFor({ state: 'hidden', timeout: timeoutMs });
    } catch {
      // Dialog stayed mounted or never rendered. Let the caller's UI
      // assertion surface the actual problem.
    }
  }
}
