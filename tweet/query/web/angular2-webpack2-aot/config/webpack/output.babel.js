import { pathTo } from './utils.babel';
import { version } from '../../package.json';

export const suffix = `v=${version}`;
const staticDir = '../../src/main/resources/public/angular2-webpack2-aot';
export const publicPath = '/angular2-webpack2-aot/';

export default env => ({
  publicPath,
  path: pathTo(staticDir),
  filename: `[name].js?${suffix}`,
  sourceMapFilename: `[file].map?${suffix}`,
  chunkFilename: `[id].chunk.js?${suffix}`,
  jsonpFunction: 'w',
});
