import type { BrowserContext, Page } from 'playwright-core';

import { Logger } from './logger.ts';
import { getMetaMaskHomeUrl, MetaMaskTestIds } from './metamask-selectors.ts';
import type { WalletStateConfig } from './wallet-state.ts';

const logger = new Logger('wallet-reconciler');

/**
 * Idempotently drives MetaMask + dApp state to match `config`. Called from
 * the `Before` hook. `config.network` / `accountIndex` / `locked` are
 * typed in `WalletStateConfig` but not yet wired — adding them is additive.
 */
export async function applyWalletState(
  context: BrowserContext,
  page: Page,
  config: WalletStateConfig,
): Promise<void> {
  logger.info('applying wallet state: %o', config);

  if (config.revokePermissionsForOrigin) {
    await revokePermissions(context, config.revokePermissionsForOrigin);
  }

  if (config.clearDappStorage) {
    await clearDappStorage(page);
  }
}

async function revokePermissions(context: BrowserContext, origin: string): Promise<void> {
  const settingsPage = await context.newPage();
  try {
    await settingsPage.goto(getMetaMaskHomeUrl('permissions'));

    const row = settingsPage.getByTestId(MetaMaskTestIds.connectedOriginRow(origin));
    if ((await row.count()) === 0) {
      logger.debug('no connected-sites row for %s — nothing to revoke', origin);
      return;
    }
    await row.click();
    await settingsPage.getByTestId(MetaMaskTestIds.disconnectButton).click();
    await settingsPage.getByTestId(MetaMaskTestIds.disconnectConfirmButton).click();
    logger.debug('revoked permissions for %s', origin);
  } catch (err) {
    // Non-fatal: scenario may still pass (nothing to revoke is the common
    // case on a fresh context) or may fail on a stale permission. Log and
    // let the scenario's own assertions decide.
    logger.warn(
      'revokePermissions failed for %s: %s',
      origin,
      err instanceof Error ? err.message : String(err),
    );
  } finally {
    await settingsPage.close().catch(() => undefined);
  }
}

async function clearDappStorage(page: Page): Promise<void> {
  await page.evaluate(() => {
    try {
      localStorage.clear();
    } catch {
      // about:blank and chrome-extension:// pages don't expose localStorage
    }
    try {
      sessionStorage.clear();
    } catch {
      // as above
    }
    for (const cookie of document.cookie.split(';')) {
      const eqIdx = cookie.indexOf('=');
      const name = (eqIdx > -1 ? cookie.slice(0, eqIdx) : cookie).trim();
      if (name) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      }
    }
  });
  logger.debug('cleared dApp storage');
}
