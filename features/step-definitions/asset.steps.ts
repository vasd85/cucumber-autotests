import { Given, Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';

import { AssetPage } from '../../pages/asset.page.ts';
import { WalletConnectModalPage } from '../../pages/wallet-connect-modal.page.ts';
import { Logger } from '../support/logger.ts';
import type { CustomWorld } from '../support/world.ts';

const logger = new Logger('asset.steps');

const APPKIT_STATUS_CONNECTED = 'connected';
const APPKIT_CONNECTOR_METAMASK = 'io.metamask';
const CONNECTION_STATUS_POLL_TIMEOUT_MS = 10_000;

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

    await expect
      .poll(async () => (await asset.readSessionStorageSnapshot()).appkitStatus, {
        timeout: CONNECTION_STATUS_POLL_TIMEOUT_MS,
        message: 'waiting for @appkit/connection_status to flip to "connected"',
      })
      .toBe(APPKIT_STATUS_CONNECTED);

    const snapshot = await asset.readSessionStorageSnapshot();
    logger.info(
      'signed-in snapshot: appkitStatus=%s connectorId=%s turnkeySession=%s',
      snapshot.appkitStatus,
      snapshot.connectorId,
      snapshot.turnkeySession ? '<present>' : '<missing>',
    );
    expect(snapshot.appkitStatus).toBe(APPKIT_STATUS_CONNECTED);
    expect(snapshot.connectorId).toBe(APPKIT_CONNECTOR_METAMASK);
    // `@turnkey/session/v2` populates after the dApp hits
    // `POST /api/auth/turnkey-session-update`; a cold backend can take
    // 10-20s, so we log its presence but do not gate the assertion on it.
  },
);

Then('the user is not signed in', async function (this: CustomWorld): Promise<void> {
  const asset = new AssetPage(this.page);
  const walletConnectModal = new WalletConnectModalPage(this.page);

  const status = await asset.readAppkitConnectionStatus();
  expect(status).not.toBe(APPKIT_STATUS_CONNECTED);
  await expect(walletConnectModal.modalCard).toBeVisible();
});
