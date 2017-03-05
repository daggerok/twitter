import { pathTo, publicPath } from './utils.babel';
import { version } from '../../package.json';

const staticDir = '../../src/main/resources/public/react';

export const suffix = `v=${version}`;

export default env => ({
  publicPath,
  path: pathTo(staticDir),
  filename: `[name].js?${suffix}`,
  sourceMapFilename: `[file].map?${suffix}`,
  chunkFilename: `[id].chunk.js?${suffix}`,
  jsonpFunction: 'w',
});
