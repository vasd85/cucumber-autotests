import type { BrowserContext, Page } from 'playwright-core';

import { Logger } from './logger.ts';
import {
  getMetaMaskHomeUrl,
  getMetaMaskOriginPrefix,
  MetaMaskTestIds,
} from './metamask-selectors.ts';
import type { WalletStateConfig } from './wallet-state.ts';

const logger = new Logger('wallet-reconciler');

/**
 * Idempotently drives MetaMask + dApp state to match `config`. Called from
 * the `Before` hook. Fast-programmatic-first, UI-fallback-second for
 * permission revocation; the dApp-storage clear is a plain `page.evaluate`.
 *
 * Current scope (per plan Framework Changes §wallet-reconciler):
 *  - revoke permissions for an origin, so the wallet-select modal + approve
 *    popup appear on the next connect attempt,
 *  - clear dApp `localStorage` / `sessionStorage` / cookies.
 *
 * Out of scope (typed but not implemented) — `config.network`,
 * `config.accountIndex`, `config.locked`. Adding them is additive.
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

  // TODO: Action: implement config.network branch when @network:* tag ships.
  // TODO: Action: implement config.accountIndex branch when @account:* tag ships.
  // TODO: Action: implement config.locked branch when @locked tag ships.
}

/**
 * Programmatic-first, UI-fallback revoke.
 *
 * MetaMask's MV3 service worker runs under LavaMoat scuttling, which
 * strips `globalThis` properties (e.g. `setInterval`, `Intl`) that
 * Playwright's `worker.evaluate` marshalling needs. In practice the
 * fast path always throws against MetaMask today — the UI fallback is
 * the path that actually runs. The programmatic attempt stays here as
 * a zero-cost seam for wallets without scuttling and for a future
 * MetaMask that relaxes it; failures log at `debug` only. The UI
 * fallback's failure is where we shout: that is the path we rely on.
 */
async function revokePermissions(context: BrowserContext, origin: string): Promise<void> {
  try {
    await programmaticallyRevokePermissions(context, origin);
    return;
  } catch (err) {
    logger.debug(
      'programmatic revoke unavailable for %s (expected under LavaMoat scuttling): %s',
      origin,
      errorMessage(err),
    );
  }

  try {
    await uiRevokePermissions(context, origin);
  } catch (err) {
    logger.warn(
      'UI fallback revoke failed for %s — continuing, scenario may fail if stale permissions matter: %s',
      origin,
      errorMessage(err),
    );
  }
}

/** Extracts `.message` off an unknown thrown value without dumping the full stack. */
function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

/**
 * Fast path: mutate `chrome.storage.local` directly via the MetaMask
 * extension's service worker. Clears the subject entry for the given
 * origin inside `PermissionController.subjects`.
 *
 * Exported because `MetaMaskWallet.revokeDappPermissions` delegates here —
 * the reconciler is the single owner of this mutation.
 */
export async function programmaticallyRevokePermissions(
  context: BrowserContext,
  origin: string,
): Promise<void> {
  const serviceWorker = await getMetaMaskServiceWorker(context);
  if (!serviceWorker) {
    throw new Error(
      'MetaMask service worker not found on context; cannot revoke programmatically.',
    );
  }

  await serviceWorker.evaluate(async (originArg) => {
    type ChromeLike = {
      storage?: {
        local?: {
          get: (key: string) => Promise<Record<string, unknown>>;
          set: (data: Record<string, unknown>) => Promise<void>;
        };
      };
    };
    const chromeRef = (globalThis as unknown as { chrome?: ChromeLike }).chrome;
    if (!chromeRef?.storage?.local) {
      throw new Error('chrome.storage.local not available inside extension service worker');
    }

    const root = await chromeRef.storage.local.get('data');
    const data = (root.data ?? {}) as Record<string, unknown>;
    const permissionController = (data.PermissionController ?? {}) as {
      subjects?: Record<string, unknown>;
    };
    if (permissionController.subjects && permissionController.subjects[originArg]) {
      delete permissionController.subjects[originArg];
      data.PermissionController = permissionController;
      await chromeRef.storage.local.set({ data });
    }
  }, origin);

  logger.debug('programmatic revoke succeeded for %s', origin);
}

/**
 * UI fallback — drive the MetaMask Sites screen to disconnect an origin.
 * Slower than the programmatic path but schema-stable across MetaMask
 * versions that move `PermissionController`.
 */
async function uiRevokePermissions(context: BrowserContext, origin: string): Promise<void> {
  const settingsPage = await context.newPage();
  try {
    await settingsPage.goto(getMetaMaskHomeUrl('permissions'));

    const row = settingsPage.getByTestId(MetaMaskTestIds.connectedOriginRow(origin));
    if ((await row.count()) === 0) {
      logger.debug('UI revoke: no row for %s — nothing to do', origin);
      return;
    }
    await row.click();
    await settingsPage.getByTestId(MetaMaskTestIds.disconnectButton).click();
    await settingsPage.getByTestId(MetaMaskTestIds.disconnectConfirmButton).click();
    logger.debug('UI revoke succeeded for %s', origin);
  } finally {
    await settingsPage.close().catch(() => {
      // best-effort cleanup
    });
  }
}

/**
 * Clears the dApp-side storage we know about. Called on every scenario by
 * default so reused contexts cannot leak AppKit / Turnkey flags between
 * scenarios.
 */
async function clearDappStorage(page: Page): Promise<void> {
  await page.evaluate(() => {
    try {
      localStorage.clear();
    } catch {
      // ignore — not all pages expose localStorage (e.g. about:blank)
    }
    try {
      sessionStorage.clear();
    } catch {
      // ignore
    }
    for (const cookie of document.cookie.split(';')) {
      const eqIdx = cookie.indexOf('=');
      const name = (eqIdx > -1 ? cookie.slice(0, eqIdx) : cookie).trim();
      if (name) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      }
    }
  });
  logger.debug('cleared dApp localStorage / sessionStorage / cookies');
}

async function getMetaMaskServiceWorker(context: BrowserContext) {
  const prefix = getMetaMaskOriginPrefix();
  const existing = context.serviceWorkers().find((sw) => sw.url().startsWith(prefix));
  if (existing) {
    return existing;
  }

  // Service worker may not be warm yet; wait briefly for it to register.
  return context
    .waitForEvent('serviceworker', {
      predicate: (sw) => sw.url().startsWith(prefix),
      timeout: 2000,
    })
    .catch(() => undefined);
}
