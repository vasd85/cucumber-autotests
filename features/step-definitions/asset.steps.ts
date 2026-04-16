import { Given, Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';

import { AssetPage } from '../../pages/asset.page.ts';
import { WalletConnectModalPage } from '../../pages/wallet-connect-modal.page.ts';
import { Logger } from '../support/logger.ts';
import type { CustomWorld } from '../support/world.ts';

const logger = new Logger('asset.steps');

const SIGNED_IN_TIMEOUT_MS = 20_000;

Given(
  'the user is on the TradeGenius Asset page',
  async function (this: CustomWorld): Promise<void> {
    const asset = new AssetPage(this.page);
    await expect(asset.signInButton).toBeVisible();
  },
);

When('the user opens the wallet sign-in flow', async function (this: CustomWorld): Promise<void> {
  const asset = new AssetPage(this.page);
  await asset.openSignInDialog();
  await expect(asset.signInDialog).toBeVisible();
  await asset.chooseConnectWithWallet();
});

Then(
  'the user is signed in with a wallet session',
  async function (this: CustomWorld): Promise<void> {
    const asset = new AssetPage(this.page);

    // The ToS 1/2 dialog flashes briefly for already-onboarded wallets.
    // Best-effort wait so the header-swap assertions do not race its mount.
    await asset.waitForTermsOfServiceToDismiss();

    // The "Set up your Security" 2FA onboarding modal overlays the header
    // on every fresh sign-in and `aria-hidden`s the post-login nav below.
    // Skip it best-effort so the Deposit/Airdrop assertions can see the UI.
    await asset.dismissTwoFactorSetupIfPresent();

    // UI is the source of truth: the Sign-In button disappears when the
    // Turnkey session is established, and Deposit + Airdrop take over the
    // same header slot.
    await expect(asset.signInButton).toBeHidden({ timeout: SIGNED_IN_TIMEOUT_MS });
    await expect(asset.depositButton).toBeVisible();
    await expect(asset.airdropLink).toBeVisible();

    // Supplementary diagnostic only — the backend write of
    // `@turnkey/session/v2` can lag the UI flip by a few seconds, so its
    // absence is not gating.
    const turnkeySession = await this.page.evaluate(() =>
      localStorage.getItem('@turnkey/session/v2'),
    );
    const turnkeyDiagnostic = turnkeySession
      ? `<present: ${turnkeySession.slice(0, 16)}…>`
      : '<missing>';
    logger.info('signed-in diagnostic: turnkeySession=%s', turnkeyDiagnostic);
  },
);

Then('the user is not signed in', async function (this: CustomWorld): Promise<void> {
  const asset = new AssetPage(this.page);
  const walletConnectModal = new WalletConnectModalPage(this.page);

  // Cancelling the MetaMask popup at stage 1 keeps the Reown modal mounted
  // and the Sign-In button visible in the dApp header.
  await expect(walletConnectModal.modalCard).toBeVisible();
  await expect(asset.signInButton).toBeVisible();
});
