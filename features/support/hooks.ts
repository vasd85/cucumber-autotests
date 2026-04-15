import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import {
  After,
  AfterAll,
  Before,
  BeforeAll,
  Status,
  type ITestCaseHookParameter,
} from '@cucumber/cucumber';

import { destroySession, getSession, initSession } from './browser-session.ts';
import { loadEnv } from './env.ts';
import { Logger } from './logger.ts';
import { parseTags } from './tag-parser.ts';
import { applyWalletState } from './wallet-reconciler.ts';
import type { CustomWorld } from './world.ts';

const logger = new Logger('hooks');

BeforeAll({ timeout: 120_000 }, async function () {
  logger.info('BeforeAll: initialising browser session');
  await initSession();
});

Before({ timeout: 60_000 }, async function (this: CustomWorld, scenario: ITestCaseHookParameter) {
  const env = loadEnv();
  const { context, page, metaMask } = getSession();
  this.context = context;
  this.page = page;
  this.metaMask = metaMask;

  const tags = scenario.pickle.tags.map((t) => t.name);
  const dappOrigin = new URL(env.dappUrl).origin;
  const stateConfig = parseTags(tags, dappOrigin);

  logger.info('Before scenario "%s" — tags=%o', scenario.pickle.name, tags);

  // Navigate first so storage clear runs on the dApp origin, not about:blank.
  await page.goto(env.dappUrl, { waitUntil: 'domcontentloaded' });
  await applyWalletState(context, page, stateConfig);
  // Reload so the cleared storage takes effect for the scenario's first read.
  await page.goto(env.dappUrl, { waitUntil: 'domcontentloaded' });
});

After({ timeout: 30_000 }, async function (this: CustomWorld, scenario: ITestCaseHookParameter) {
  if (scenario.result?.status === Status.FAILED) {
    await captureFailureScreenshot(this, scenario);
  }
});

AfterAll({ timeout: 30_000 }, async function () {
  logger.info('AfterAll: destroying browser session');
  await destroySession();
});

async function captureFailureScreenshot(
  world: CustomWorld,
  scenario: ITestCaseHookParameter,
): Promise<void> {
  if (!world.page) {
    return;
  }
  const safeName = scenario.pickle.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const target = resolve('reports/screenshots', `${safeName}.png`);
  try {
    await mkdir(dirname(target), { recursive: true });
    const buffer = await world.page.screenshot({ fullPage: true });
    world.attach(buffer, 'image/png');
    logger.info('captured failure screenshot at %s', target);
    await world.page.screenshot({ path: target, fullPage: true });
  } catch (err) {
    logger.warn('failed to capture screenshot for %s: %o', safeName, err);
  }
}
