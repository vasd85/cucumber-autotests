import { Given, Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';

import { AssetPage } from '../../pages/asset.page.ts';
import { WalletConnectModalPage } from '../../pages/wallet-connect-modal.page.ts';
import { Logger } from '../support/logger.ts';
import type { CustomWorld } from '../support/world.ts';

const logger = new Logger('asset.steps');

const APPKIT_STATUS_CONNECTED = 'connected';
const APPKIT_CONNECTOR_METAMASK = 'io.metamask';
/**
 * `@appkit/connection_status` flips to `"connected"` within ~500ms of the
 * Connect popup closing. This budget is loose to absorb the overlapping
 * Turnkey round-trip that runs in parallel with the sign popup.
 */
const CONNECTION_STATUS_POLL_TIMEOUT_MS = 10_000;

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

    // The reliable "wallet is connected" signal is AppKit's own connection
    // status flag — it flips the moment the Connect popup closes. Poll on
    // this because the sign popup may still be processing on the other
    // end of the step when we enter.
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
    // `@turnkey/session/v2` is Turnkey's encrypted JWT for authenticated
    // backend calls. It populates after the sign popup closes and the
    // dApp hits `POST /api/auth/turnkey-session-update` — a cold backend
    // can take 10-20s. Treated as a supplementary signal: we log its
    // presence but do not fail on missing (the brief's "logged in"
    // contract is satisfied by the wallet-level connection state above).
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
