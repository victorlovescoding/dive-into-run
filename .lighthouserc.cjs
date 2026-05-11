module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:3000/',
        'http://localhost:3000/events',
        'http://localhost:3000/weather',
      ],
      startServerCommand: 'npm run start',
      startServerReadyPattern: 'Ready in',
      startServerReadyTimeout: 60000,
      numberOfRuns: 1,
      settings: {
        chromeFlags: '--headless=new --no-sandbox',
        preset: 'desktop',
      },
    },
    assert: {
      assertions: {
        'categories:performance': 'off',
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: './lhci-report',
      reportFilenamePattern: '%%PATHNAME%%-%%DATETIME%%-report.%%EXTENSION%%',
    },
  },
};
