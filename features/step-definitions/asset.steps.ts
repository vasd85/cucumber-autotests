import { Given, Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';

import { AssetPage } from '../../pages/asset.page.ts';
import { WalletConnectModalPage } from '../../pages/wallet-connect-modal.page.ts';
import { Logger } from '../support/logger.ts';
import type { CustomWorld } from '../support/world.ts';

const logger = new Logger('asset.steps');

const APPKIT_STATUS_CONNECTED = 'connected';
const APPKIT_CONNECTOR_METAMASK = 'io.metamask';
/** Turnkey session populates ~1.5-2s after the sign popup closes (exploration). */
const TURNKEY_SESSION_POLL_TIMEOUT_MS = 5_000;

Given(
  'the user is on the TradeGenius Asset page',
  async function (this: CustomWorld): Promise<void> {
    // The `Before` hook has already navigated to `DAPP_URL` and cleared
    // storage. We only need a lightweight visibility assertion against the
    // logged-out landing surface — the `Sign In` CTA — before a scenario
    // starts clicking through the funnel.
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

    // Poll the Turnkey key — it lands last of the three flags we assert on.
    // Reading only that key (not the whole snapshot) inside the poller keeps
    // the comparison cheap; once it is populated the full snapshot is stable.
    await expect
      .poll(
        async () => {
          const snapshot = await asset.readSessionStorageSnapshot();
          return snapshot.turnkeySession;
        },
        {
          timeout: TURNKEY_SESSION_POLL_TIMEOUT_MS,
          message: 'waiting for @turnkey/session/v2 to populate after sign popup',
        },
      )
      .not.toBeNull();

    const snapshot = await asset.readSessionStorageSnapshot();
    logger.info(
      'signed-in snapshot: appkitStatus=%s connectorId=%s turnkeySession=%s',
      snapshot.appkitStatus,
      snapshot.connectorId,
      snapshot.turnkeySession ? '<present>' : '<missing>',
    );
    expect(snapshot.appkitStatus).toBe(APPKIT_STATUS_CONNECTED);
    expect(snapshot.connectorId).toBe(APPKIT_CONNECTOR_METAMASK);
    expect(snapshot.turnkeySession).not.toBeNull();
  },
);

Then('the user is not signed in', async function (this: CustomWorld): Promise<void> {
  const asset = new AssetPage(this.page);
  const walletConnectModal = new WalletConnectModalPage(this.page);

  const status = await asset.readAppkitConnectionStatus();
  expect(status).not.toBe(APPKIT_STATUS_CONNECTED);
  // The Reown modal stays open when the user cancels the Connect popup —
  // the user is still at the wallet-chooser / chain-picker step.
  await expect(walletConnectModal.modalCard).toBeVisible();
});
