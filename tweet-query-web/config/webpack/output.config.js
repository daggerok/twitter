const { pathTo } = require('./utils');
const { version } = require('../../package.json');

module.exports = {
  path: pathTo('../tweet-query/src/main/resources/static'),
  filename: `[name].bundle.js?v=${version}`,
  chunkFilename: `[id].chunk.js?v=${version}`,
  sourceMapFilename: `[file].map?v=${version}`,
  jsonpFunction: 'w',
};
