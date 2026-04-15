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
 * `BeforeAll`. Subsequent calls are a no-op — per-scenario refs come from
 * `getSession()`.
 *
 * The MetaMask version is pinned by env (`METAMASK_VERSION`) when set, or
 * falls back to Dappwright's `MetaMaskWallet.recommendedVersion` — resolved
 * inside `MetaMaskWallet.bootstrap`, not hardcoded.
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

  // The extension ID is assigned by Chromium at install time — the
  // reconciler and selector helpers need it to build chrome-extension://
  // URLs and match MM service workers. Register it exactly once here.
  initMetaMaskExtensionId(refs.metaMask.extensionId);

  session = refs;
  logger.info('session ready (mm extension id=%s)', refs.metaMask.extensionId);
  return session;
}

/**
 * Returns the singleton session. Throws if `initSession()` has not run —
 * this means a scenario's `Before` hook is firing before `BeforeAll`,
 * which is a wiring bug.
 */
export function getSession(): SessionRefs {
  if (!session) {
    throw new Error('Session not initialised. initSession() must run in BeforeAll.');
  }
  return session;
}

/**
 * Closes the singleton context and releases the reference. Called from
 * `AfterAll`.
 */
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
