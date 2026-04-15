import type { Locator, Page } from 'playwright-core';

import { Logger } from '../features/support/logger.ts';

const logger = new Logger('AssetPage');

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
  readonly twoFactorDialog: Locator;
  readonly twoFactorSkipButton: Locator;

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
    // before the Turnkey session was issued. `exact: true` on Deposit — the
    // page also renders a `Deposits and Withdraws` button that would otherwise
    // match in strict mode.
    this.depositButton = page.getByRole('button', { name: 'Deposit', exact: true });
    this.airdropLink = page.getByRole('link', { name: 'Airdrop' });

    // Transient Terms-of-Service 1/2 dialog that flashes briefly on the
    // first /asset render after a signature. Auto-dismisses for wallets
    // that have already accepted the ToS on a previous run.
    this.termsOfServiceDialog = page.getByRole('dialog').filter({ hasText: 'Terms of Service' });
    this.termsOfServiceAccept = this.termsOfServiceDialog.getByRole('button', {
      name: 'I Accept',
    });

    // Post-login onboarding bump: "Set up your Security" Two-Factor
    // Authentication modal that overlays the header on every fresh
    // sign-in session and `aria-hidden`s the nav underneath.
    this.twoFactorDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Two-Factor Authentication' });
    // `Skip` is a <div> (not a <button>) inside the 2FA dialog — anchor by
    // exact text, not by role.
    this.twoFactorSkipButton = this.twoFactorDialog.getByText('Skip', { exact: true });
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
      logger.debug(
        'Terms of Service dialog stayed mounted or never rendered within %dms',
        timeoutMs,
      );
      // Dialog stayed mounted or never rendered. Let the caller's UI
      // assertion surface the actual problem.
    }
  }

  /**
   * Best-effort dismissal of the Two-Factor-Authentication onboarding modal
   * that covers the header on every fresh sign-in session. Clicks `Skip` if
   * the dialog is visible within `timeoutMs`; otherwise returns. Does NOT
   * throw.
   */
  async dismissTwoFactorSetupIfPresent(timeoutMs = 8_000): Promise<void> {
    try {
      await this.twoFactorDialog.waitFor({ state: 'visible', timeout: timeoutMs });
      await this.twoFactorSkipButton.click();
      await this.twoFactorDialog.waitFor({ state: 'hidden', timeout: timeoutMs });
    } catch {
      logger.debug('2FA onboarding dialog not dismissed within %dms', timeoutMs);
      // Dialog never appeared, or stayed mounted after the skip click.
      // Either way, let the caller's UI assertion surface the real issue.
    }
  }
}
