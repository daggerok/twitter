const outputPath = '../../src/main/resources/static';

module.exports = {
  injectChanges: false,
  files: [
    `${outputPath}/**/*.*`
  ],
  watchOptions: {
    ignored: 'node_modules'
  },
  server: {
    baseDir: `${outputPath}/`,
    middleware: {
      middleware: {
        0: null, // removes default `connect-logger` middleware
      },
      // overrides the second middleware default with new settings
      1: require('connect-history-api-fallback')({
        index: '/index.html',
        verbose: true
      })
    }
  },
};
