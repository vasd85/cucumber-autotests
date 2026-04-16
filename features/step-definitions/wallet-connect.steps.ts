import { When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';

import { WalletConnectModalPage } from '../../pages/wallet-connect-modal.page.ts';
import type { CustomWorld } from '../support/world.ts';

When(
  'the user selects MetaMask on the Ethereum network',
  async function (this: CustomWorld): Promise<void> {
    const modal = new WalletConnectModalPage(this.page);

    // Reown AppKit web components hydrate asynchronously (~300ms per the
    // exploration report). Auto-waiting on the modal card + header text
    // covers the hydration window without a fixed sleep.
    await expect(modal.modalCard).toBeVisible();
    await expect(modal.headerText).toHaveText('Connect Wallet');

    await modal.selectMetaMask();

    await expect(modal.headerText).toHaveText('Select Chain');
    await modal.selectEvmNetworks();
  },
);
