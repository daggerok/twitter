module.exports = function (config) {
  config.set({
    basePath: '..',
    frameworks: ['jasmine'],
    files: [
      '../../src/main/resources/public/angularjs/manifest.js',
      '../../src/main/resources/public/angularjs/vendors.js',
      '../../src/main/resources/public/angularjs/app.js',
      './node_modules/angular-mocks/angular-mocks.js',
      './node_modules/sinon/pkg/sinon.js',
      './src/**/*.spec.js',
    ],
    exclude: [],
    preprocessors: {},
    reporters: ['progress'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: false,
    browsers: ['Chrome'],
    singleRun: true,
    concurrency: Infinity,
  });
};
