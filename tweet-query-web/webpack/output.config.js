const { pathTo } = require('./utils');

module.exports = {
  path: pathTo('../tweet-query/src/main/resources/static'),
  filename: '[name].bundle.js',
  chunkFilename: '[id].chunk.js'
};
