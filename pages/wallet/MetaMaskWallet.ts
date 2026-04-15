import type { BrowserContext, Page } from 'playwright-core';

import dappwright, {
  type Dappwright,
  MetaMaskWallet as DappwrightMetaMaskWallet,
} from '@tenkeylabs/dappwright';

import { Logger } from '../../features/support/logger.ts';
import { MetaMaskConnectPopup, MetaMaskUrls } from '../../features/support/metamask-selectors.ts';
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
   * polls for the popup window internally.
   */
  async approveConnection(): Promise<void> {
    logger.info('approving MetaMask connect popup');
    await this.dappwright.approve();
  }

  /**
   * Signs the pending `personal_sign` (SIWE nonce) popup.
   */
  async signMessage(): Promise<void> {
    logger.info('signing MetaMask signature-request popup');
    await this.dappwright.sign();
  }

  /**
   * Rejects the pending Connect popup. Uses Dappwright's `reject()` which
   * clicks the Cancel button on whatever popup is currently active —
   * Dappwright is popup-agnostic, so this works for both Connect and
   * signature popups, but this project only exercises the Connect reject
   * branch from step defs.
   *
   * If `reject()` fails to find the popup (version drift), falls back to
   * locating the popup tab in the context by URL fragment and clicking
   * the Cancel button by role+name.
   */
  async rejectConnection(): Promise<void> {
    logger.info('rejecting MetaMask connect popup');
    try {
      await this.dappwright.reject();
      return;
    } catch (err) {
      logger.warn('dappwright.reject() threw, falling back to explicit Cancel click: %o', err);
    }

    const popup = this.context
      .pages()
      .find((p) => p.url().includes(MetaMaskUrls.connectPopupFragment));
    if (!popup) {
      throw new Error(
        'rejectConnection: no MetaMask Connect popup found (fast path + fallback both failed).',
      );
    }
    await popup.getByRole('button', { name: MetaMaskConnectPopup.cancelButtonName }).click();
    await popup.waitForEvent('close').catch(() => {
      // popup may already be closed by the time we await
    });
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
