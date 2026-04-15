// The browser-session singleton in features/support/browser-session.ts is
// per-process. Each Cucumber parallel worker would bootstrap its own
// MetaMask instance (~10s each) and — more importantly — share nothing
// with other workers. For this iteration we intentionally run in a single
// worker. Lift `parallel` once the reconciler handles cross-worker
// coordination (profile pooling via launchPersistentContext, etc.).
export default {
  default: {
    paths: ['features/**/*.feature'],
    import: ['features/step-definitions/**/*.ts', 'features/support/**/*.ts'],
    loader: ['tsx/esm'],
    parallel: 1,
    retry: 0,
    format: [
      'progress-bar',
      'summary',
      'html:reports/cucumber-report.html',
      'json:reports/cucumber-report.json',
    ],
    formatOptions: { snippetInterface: 'async-await' },
    publishQuiet: true,
  },
};
