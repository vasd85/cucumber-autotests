import type { BrowserContext, Page } from 'playwright-core';

import dappwright, {
  type Dappwright,
  MetaMaskWallet as DappwrightMetaMaskWallet,
} from '@tenkeylabs/dappwright';

import { Logger } from '../../features/support/logger.ts';
import {
  MetaMaskPopupButtonTestIds,
  MetaMaskPopupUrls,
} from '../../features/support/metamask-selectors.ts';

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
 * import this class, never `@tenkeylabs/dappwright` directly, so a future
 * swap to a different wallet driver changes one file.
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

  get raw(): Dappwright {
    return this.dappwright;
  }

  /**
   * Chrome-assigned extension ID for this MetaMask install. Read off the
   * wallet page URL — Dappwright installs MetaMask unpacked, so the ID is
   * random per install and differs from the Web Store ID.
   */
  get extensionId(): string {
    const url = this.dappwright.page.url();
    const match = url.match(/^chrome-extension:\/\/([a-p]{32})\//);
    if (!match) {
      throw new Error(
        `MetaMaskWallet.extensionId: expected chrome-extension://<32-char-id>/... but saw "${url}"`,
      );
    }
    return match[1];
  }

  async approveConnection(): Promise<void> {
    logger.info('approving MetaMask connect popup');
    await this.clickPopupButton(MetaMaskPopupUrls.connectPopupFragment, 'confirm');
  }

  async signMessage(): Promise<void> {
    logger.info('signing MetaMask signature-request popup');
    await this.clickPopupButton(MetaMaskPopupUrls.signaturePopupFragment, 'confirm');
  }

  async rejectConnection(): Promise<void> {
    logger.info('rejecting MetaMask connect popup');
    await this.clickPopupButton(MetaMaskPopupUrls.connectPopupFragment, 'cancel');
  }

  private async clickPopupButton(urlFragment: string, action: 'confirm' | 'cancel'): Promise<void> {
    // Match popup pages by `notification.html` only. The hash fragment
    // (`#/connect/<uuid>` / `#/confirm-transaction/<uuid>/…`) is set
    // asynchronously after the `page` event fires, so filtering on it
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
    // Do NOT `waitForLoadState('networkidle')` — MetaMask's popup keeps
    // long-lived background pings, so networkidle never fires.
    await popup.waitForURL((url) => url.toString().includes(urlFragment), { timeout: 5_000 });

    // MV3 popup uses `confirm-footer-*` testids; legacy Dappwright codepath
    // uses `confirm-btn` / `cancel-btn`. Chain both via `.or()`.
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
    // `force: true` skips Playwright's actionability polling, which hangs
    // under MetaMask's LavaMoat scuttling mode.
    await button.click({ force: true, timeout: 5_000 });
    if (!popup.isClosed()) {
      await popup.waitForEvent('close', { timeout: 10_000 }).catch(() => undefined);
    }
  }
}
