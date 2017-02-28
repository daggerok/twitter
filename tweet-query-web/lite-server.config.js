module.exports = {
  injectChanges: false,
  files: [
    '../tweet-query/src/main/resources/static/**/*.*'
  ],
  watchOptions: {
    ignored: 'node_modules'
  },
  server: {
    baseDir: '../tweet-query/src/main/resources/static/',
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
