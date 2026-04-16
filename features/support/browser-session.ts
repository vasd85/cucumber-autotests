import type { BrowserContext, Page } from 'playwright-core';

import { MetaMaskWallet } from '../../pages/wallet/MetaMaskWallet.ts';

import { loadEnv } from './env.ts';
import { Logger } from './logger.ts';
import { initMetaMaskExtensionId } from './metamask-selectors.ts';

const logger = new Logger('browser-session');

export interface SessionRefs {
  context: BrowserContext;
  page: Page;
  metaMask: MetaMaskWallet;
}

let session: SessionRefs | null = null;

/**
 * Bootstraps Dappwright + MetaMask exactly once per process. Called from
 * `BeforeAll`; subsequent calls are a no-op.
 */
export async function initSession(): Promise<SessionRefs> {
  if (session) {
    return session;
  }

  const env = loadEnv();
  const refs = await MetaMaskWallet.bootstrap({
    seed: env.walletSeed,
    password: env.walletPassword,
    version: env.metamaskVersion,
    headless: env.headless,
  });

  initMetaMaskExtensionId(refs.metaMask.extensionId);

  session = refs;
  logger.info('session ready (mm extension id=%s)', refs.metaMask.extensionId);
  return session;
}

export function getSession(): SessionRefs {
  if (!session) {
    throw new Error('Session not initialised. initSession() must run in BeforeAll.');
  }
  return session;
}

export async function destroySession(): Promise<void> {
  if (!session) {
    return;
  }
  const { context } = session;
  session = null;
  try {
    await context.close();
    logger.info('session closed');
  } catch (err) {
    logger.warn('error closing context: %o', err);
  }
}
