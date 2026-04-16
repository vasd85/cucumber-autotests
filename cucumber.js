// Single-worker: each parallel worker would bootstrap its own MetaMask
// (~10s) and share nothing with the others. Revisit if the suite grows
// enough to need launchPersistentContext pooling.
//
// Do NOT wrap the profile in `{ default: {...} }`. With `type: "module"`
// Cucumber reads this file via `await import(...)` and treats the module's
// default export as the profile directly — an inner `default` key pushes
// the config one level too deep and is silently dropped.
//
// tsx registration is `NODE_OPTIONS='--import tsx/esm'` in the npm scripts,
// not the `loader: ['tsx/esm']` config key, because Node 20+ removed the
// `--loader` hook that config key invokes.
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
