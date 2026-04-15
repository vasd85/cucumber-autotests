import type { BrowserContext, Page } from 'playwright-core';

import dappwright, {
  type Dappwright,
  MetaMaskWallet as DappwrightMetaMaskWallet,
} from '@tenkeylabs/dappwright';

import { Logger } from '../../features/support/logger.ts';
import {
  MetaMaskPopupButtonTestIds,
  MetaMaskUrls,
} from '../../features/support/metamask-selectors.ts';
import { programmaticallyRevokePermissions } from '../../features/support/wallet-reconciler.ts';

const logger = new Logger('MetaMaskWallet');

export interface MetaMaskBootstrapOptions {
  seed: string;
  password: string;
  /** Empty string or undefined → Dappwright's recommendedVersion. */
  version?: string;
  headless?: boolean;
}

export interface MetaMaskBootstrapResult {
  context: BrowserContext;
  page: Page;
  metaMask: MetaMaskWallet;
}

/**
 * Thin wrapper around Dappwright's `Dappwright` handle. Step definitions
 * import this class, never `@tenkeylabs/dappwright` directly — so a future
 * swap to a different wallet driver (or a fake in-page provider) changes
 * one file.
 *
 * The class is intentionally instance-based and takes a `Dappwright` in
 * its constructor so a `BaseWalletStrategy` interface can be extracted
 * later with zero caller churn.
 */
export class MetaMaskWallet {
  private readonly dappwright: Dappwright;
  private readonly page: Page;
  private readonly context: BrowserContext;

  constructor(dappwrightHandle: Dappwright, page: Page, context: BrowserContext) {
    this.dappwright = dappwrightHandle;
    this.page = page;
    this.context = context;
  }

  /**
   * Boots Dappwright + MetaMask and returns a ready-to-use wrapper along
   * with the underlying Playwright context + page. This is the single
   * Dappwright `bootstrap()` call site — the framework singleton calls
   * this once per process.
   *
   * The MetaMask version is resolved here: `options.version` if set,
   * otherwise Dappwright's `MetaMaskWallet.recommendedVersion`.
   */
  static async bootstrap(options: MetaMaskBootstrapOptions): Promise<MetaMaskBootstrapResult> {
    const version =
      options.version && options.version.length > 0
        ? options.version
        : DappwrightMetaMaskWallet.recommendedVersion;
    logger.info('bootstrapping MetaMask v%s (headless=%s)', version, options.headless ?? false);

    const [wallet, page, context] = await dappwright.bootstrap('', {
      wallet: 'metamask',
      version,
      seed: options.seed,
      password: options.password,
      headless: options.headless ?? false,
    });

    return { context, page, metaMask: new MetaMaskWallet(wallet, page, context) };
  }

  /** Underlying Dappwright handle for advanced paths. Prefer the methods. */
  get raw(): Dappwright {
    return this.dappwright;
  }

  /**
   * Approves the pending `eth_requestAccounts` (Connect) popup. Dappwright
   * 2.9.2's `approve()` targets the legacy testid `confirm-btn` which is
   * missing from the MM popup layout used by MetaMask 13.17.0 in this
   * project — the call hangs forever. We wait for the popup tab ourselves
   * and click the Connect button by role + accessible name; that pair is
   * stable across recent MM releases.
   */
  async approveConnection(): Promise<void> {
    logger.info('approving MetaMask connect popup');
    await this.clickPopupButton(MetaMaskUrls.connectPopupFragment, 'confirm');
  }

  /**
   * Signs the pending `personal_sign` (SIWE nonce) popup. Same testid-OR
   * rationale as `approveConnection()` — Dappwright's `sign()` clicks by a
   * single (legacy) testid and is version-coupled.
   */
  async signMessage(): Promise<void> {
    logger.info('signing MetaMask signature-request popup');
    await this.clickPopupButton(MetaMaskUrls.signaturePopupFragment, 'confirm');
  }

  /**
   * Shared popup-wait + click-by-name helper. Picks an already-open popup
   * if one is present (Dappwright's own pre-click tabs can leave a popup
   * attached for a few ms) otherwise polls for a new `page` event on the
   * context. Button match is role + accessible name — one testid change
   * in MetaMask will not break this.
   */
  private async clickPopupButton(urlFragment: string, action: 'confirm' | 'cancel'): Promise<void> {
    // Dappwright installs MetaMask as an unpacked extension — its extension
    // ID is not the stable Web Store ID (`nkbihfbeogaeaoehlefnkodbefgpgknn`)
    // but a random one per install. We match popup pages by
    // `notification.html` only (MetaMask's popup path is stable); the hash
    // fragment (`#/connect/<uuid>` vs `#/confirm-transaction/<uuid>/…`) is
    // set asynchronously after the `page` event fires, so filtering on it
    // race-conditions the match.
    const isMetaMaskPopup = (p: Page): boolean =>
      p.url().startsWith('chrome-extension://') && p.url().includes('notification.html');

    const popup =
      this.context.pages().find((p) => isMetaMaskPopup(p)) ??
      (await this.context.waitForEvent('page', {
        predicate: isMetaMaskPopup,
        timeout: 20_000,
      }));
    await popup.waitForLoadState('domcontentloaded');
    // Wait for the expected hash to confirm we're on the right step — the
    // Connect popup and the Signature popup both use `notification.html`.
    // Do NOT `waitForLoadState('networkidle')` — MetaMask's popup keeps
    // long-lived background pings to its service worker, so networkidle
    // never fires and the default 30s timeout would eat the whole step.
    await popup.waitForURL((url) => url.toString().includes(urlFragment), { timeout: 5_000 });
    logger.debug('clickPopupButton url=%s action=%s', popup.url(), action);

    // Prefer `data-testid`. MetaMask's MV3 popup uses
    // `confirm-footer-button` / `confirm-footer-cancel-button`; the legacy
    // Dappwright codepath uses `confirm-btn` / `cancel-btn`. Chain both via
    // `.or()` so either version resolves. `force: true` bypasses the
    // actionability polling that LavaMoat's scuttling mode sometimes hangs
    // — the popup is the only window open, the button is on-screen, no
    // overlay covers it.
    const primaryId =
      action === 'confirm'
        ? MetaMaskPopupButtonTestIds.confirmPrimary
        : MetaMaskPopupButtonTestIds.cancelPrimary;
    const legacyId =
      action === 'confirm'
        ? MetaMaskPopupButtonTestIds.confirmLegacy
        : MetaMaskPopupButtonTestIds.cancelLegacy;
    const button = popup.getByTestId(primaryId).or(popup.getByTestId(legacyId)).first();
    await button.waitFor({ state: 'visible', timeout: 10_000 });
    await button.click({ force: true, timeout: 5_000 });
    if (!popup.isClosed()) {
      await popup.waitForEvent('close', { timeout: 10_000 }).catch(() => {
        // popup already torn down by MetaMask before we started waiting
      });
    }
  }

  /**
   * Rejects the pending Connect popup by clicking Cancel. Same popup-match
   * strategy as `approveConnection()` — see `clickPopupButton` for the
   * Dappwright-bypass rationale.
   */
  async rejectConnection(): Promise<void> {
    logger.info('rejecting MetaMask connect popup');
    await this.clickPopupButton(MetaMaskUrls.connectPopupFragment, 'cancel');
  }

  /**
   * Revokes any previously-granted MetaMask permission the given origin
   * holds. Delegates to the reconciler's programmatic helper so the
   * `chrome.storage.local` mutation has a single owner.
   */
  async revokeDappPermissions(origin: string): Promise<void> {
    await programmaticallyRevokePermissions(this.context, origin);
  }
}
