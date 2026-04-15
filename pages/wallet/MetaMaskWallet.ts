import type { BrowserContext, Page } from 'playwright-core';

import dappwright, {
  type Dappwright,
  MetaMaskWallet as DappwrightMetaMaskWallet,
} from '@tenkeylabs/dappwright';

import { Logger } from '../../features/support/logger.ts';

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
    // dappwright.signin() waits for the next popup Page event on the context,
    // clicks confirm-btn if the connect popup is on stage 1 ("Connect this
    // website"), then clicks confirm-footer-button (stage 2). The helper
    // throws if the popup does not close, so no custom catch-swallow.
    logger.info('approving MetaMask connect popup via Dappwright.signin()');
    await this.dappwright.signin();
  }

  async signMessage(): Promise<void> {
    logger.info('confirming MetaMask signature popup');

    const context = this.dappwright.page.context();
    const isSignaturePopup = (p: Page): boolean =>
      p.url().startsWith('chrome-extension://') &&
      p.url().includes('/notification.html#/confirm-transaction/');

    // The signature popup frequently opens during the 3s waitForChromeState
    // settle inside the prior signin() call, so by the time we land here it
    // is already present in context.pages(). Check existing pages first, then
    // fall back to the next `page` event. Playwright's waitForEvent does not
    // replay past events, so relying on it alone races the popup open.
    const popup =
      context.pages().find(isSignaturePopup) ??
      (await context.waitForEvent('page', {
        predicate: isSignaturePopup,
        timeout: 20_000,
      }));

    await popup.waitForLoadState('domcontentloaded');

    const confirm = popup.getByTestId('confirm-footer-button');
    await confirm.waitFor({ state: 'visible', timeout: 10_000 });
    await confirm.click();

    if (!popup.isClosed()) {
      await popup.waitForEvent('close', { timeout: 15_000 });
    }
    logger.info('MetaMask signature popup closed');
  }

  async rejectConnection(): Promise<void> {
    // Dappwright.reject() clicks confirm-footer-cancel-button OR cancel-btn
    // via its own `.or()` chain; covers both stage-1 and stage-2 cancels.
    logger.info('rejecting MetaMask connect popup via Dappwright.reject()');
    await this.dappwright.reject();
  }
}
