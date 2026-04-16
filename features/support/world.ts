import { setWorldConstructor, World, type IWorldOptions } from '@cucumber/cucumber';
import type { BrowserContext, Page } from 'playwright-core';

import type { MetaMaskWallet } from '../../pages/wallet/MetaMaskWallet.ts';

/**
 * Per-scenario container. Holds references to the singleton browser
 * session — does NOT own them. The session lifecycle is managed by
 * `browser-session.ts` and the `BeforeAll` / `AfterAll` hooks.
 *
 * Step definitions access `page`, `context`, and `metaMask` off `this`.
 * Because they use the `function` keyword (never arrows), Cucumber's World
 * injection wires these refs automatically.
 */
export class CustomWorld extends World {
  page!: Page;
  context!: BrowserContext;
  metaMask!: MetaMaskWallet;

  constructor(options: IWorldOptions) {
    super(options);
  }
}

setWorldConstructor(CustomWorld);
