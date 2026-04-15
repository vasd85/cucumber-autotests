// The browser-session singleton in features/support/browser-session.ts is
// per-process. Each Cucumber parallel worker would bootstrap its own
// MetaMask instance (~10s each) and — more importantly — share nothing
// with other workers. For this iteration we intentionally run in a single
// worker. Lift `parallel` once the reconciler handles cross-worker
// coordination (profile pooling via launchPersistentContext, etc.).
//
// ESM note: with package.json `type: "module"`, Cucumber reads this file
// via `await import(...)` and uses the module's default export as the
// default profile directly — do NOT wrap the object in `{ default: {...} }`
// or the profile keys end up one level too deep and silently unused
// (Cucumber 11.3 on Node 24).
//
// TypeScript loader note: Node 20+ removed the old `--loader` hook that
// Cucumber's `loader: []` config key uses. tsx must be registered via
// `NODE_OPTIONS='--import tsx/esm'` at process start — see the `test` /
// `test:smoke` scripts in package.json.
export default {
  paths: ['features/**/*.feature'],
  import: ['features/step-definitions/**/*.ts', 'features/support/**/*.ts'],
  parallel: 1,
  retry: 0,
  format: [
    'progress-bar',
    'summary',
    'html:reports/cucumber-report.html',
    'json:reports/cucumber-report.json',
  ],
  formatOptions: { snippetInterface: 'async-await' },
};
