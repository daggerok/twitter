module.exports = env => ({
  devtool: env === 'production' ? 'source-map' : 'eval',
  resolve: require('./webpack/resolve.config'),
  resolveLoader: require('./webpack/resolveLoader.config'),
  entry: require('./webpack/entry.config'),
  output: require('./webpack/output.config'),
  module: require('./webpack/module.config')(env),
  plugins: require('./webpack/plugins.config')(env),
  node: require('./webpack/node.config'),
});
