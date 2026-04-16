import type { Locator, Page } from 'playwright-core';

/**
 * Reown AppKit `<w3m-modal>` — the wallet-chooser overlay that takes over
 * after the dApp's own Sign-In dialog hands off via "Connect with Wallet".
 *
 * This modal is a shadow-DOM web component. Playwright's locator engine
 * (including `getByTestId`) pierces open shadow roots, so the Reown
 * `data-testid` surface can be queried as if it were light DOM.
 *
 * Two sequential "steps" happen inside the same `<w3m-modal>`:
 *   1. Wallet list  — header text "Connect Wallet", user picks MetaMask.
 *   2. Chain picker — header text "Select Chain", user picks EVM / Solana.
 *
 * Selectors are the stable ones captured during exploration. The MetaMask
 * tile is selected by `name="MetaMask"` (stable across WalletConnect
 * project updates) rather than by the hashed testid
 * (`wallet-selector-c57ca9…`) — the hashed form is left commented below
 * for reviewer context.
 */
export class WalletConnectModalPage {
  readonly page: Page;

  readonly modalCard: Locator;
  readonly headerText: Locator;
  readonly closeButton: Locator;
  readonly metaMaskTile: Locator;
  readonly evmChainTile: Locator;
  /** Solana namespace tile — not exercised yet; kept for future tests. */
  readonly solanaChainTile: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modalCard = page.getByTestId('w3m-modal-card');
    this.headerText = page.getByTestId('w3m-header-text');
    this.closeButton = page.getByTestId('w3m-header-close');
    // Prefer the stable name-based selector over the hashed testid:
    //   page.getByTestId('wallet-selector-c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96')
    this.metaMaskTile = page.locator('w3m-list-wallet[name="MetaMask"]');
    this.evmChainTile = page.getByTestId('wui-list-chain-eip155');
    this.solanaChainTile = page.getByTestId('wui-list-chain-solana');
  }

  async selectMetaMask(): Promise<void> {
    await this.metaMaskTile.click();
  }

  async selectEvmNetworks(): Promise<void> {
    await this.evmChainTile.click();
  }

  async close(): Promise<void> {
    await this.closeButton.click();
  }
}
