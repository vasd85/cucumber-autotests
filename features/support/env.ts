import { config as loadDotenv } from 'dotenv';

import { Logger } from './logger.ts';

const logger = new Logger('env');

export interface EnvConfig {
  /** Target dApp URL — default documented in `.env.example`. */
  dappUrl: string;
  /** Space-separated 12/24-word test seed. Required. */
  walletSeed: string;
  /** Password MetaMask onboarding sets. Required. */
  walletPassword: string;
  /**
   * MetaMask extension version to bootstrap with. Empty string means
   * "use Dappwright's `MetaMaskWallet.recommendedVersion`" — the caller
   * resolves the fallback at the bootstrap call site.
   */
  metamaskVersion: string;
  /** Launch Chromium headless. Default false. */
  headless: boolean;
}

let cached: EnvConfig | null = null;

/**
 * Loads `.env.local` then `.env` (so `.env.local` overrides committed
 * defaults), validates the keys this project depends on, and returns a
 * typed config object. Call once at bootstrap. Subsequent calls return the
 * cached config without re-reading the filesystem.
 *
 * Never logs secret values. A missing mandatory key throws with the key
 * name so a newcomer gets a precise error.
 */
export function loadEnv(): EnvConfig {
  if (cached) {
    return cached;
  }

  // `.env.local` takes precedence over `.env` per Next.js convention.
  loadDotenv({ path: '.env.local' });
  loadDotenv({ path: '.env' });

  const dappUrl = readRequired('DAPP_URL');
  const walletSeed = readRequired('WALLET_SEED');
  const walletPassword = readRequired('WALLET_PASSWORD');
  const metamaskVersion = process.env.METAMASK_VERSION?.trim() ?? '';
  const headless = (process.env.HEADLESS ?? 'false').toLowerCase() === 'true';

  cached = { dappUrl, walletSeed, walletPassword, metamaskVersion, headless };
  logger.info(
    'env loaded; dappUrl=%s headless=%s metamaskVersion=%s',
    dappUrl,
    headless,
    metamaskVersion || '(recommended)',
  );
  return cached;
}

function readRequired(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}. See .env.example.`);
  }
  return value;
}
