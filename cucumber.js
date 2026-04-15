export default {
  default: {
    paths: ['features/**/*.feature'],
    import: ['features/step-definitions/**/*.ts', 'features/support/**/*.ts'],
    loader: ['tsx/esm'],
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
