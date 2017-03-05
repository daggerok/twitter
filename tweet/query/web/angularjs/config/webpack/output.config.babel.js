import { pathTo } from './utils.babel';
import { version } from '../../package.json';

const staticDir = '../../src/main/resources/public/angularjs';

export const suffix = `v=${version}`;
export const publicPath = '/angularjs/';

export default {
  publicPath: publicPath,
  path: pathTo(staticDir),
  filename: `[name].js?${suffix}`,
  sourceMapFilename: `[file].map?${suffix}`,
  chunkFilename: `[id].chunk.js?${suffix}`,
  jsonpFunction: 'w',
};
