import { pathTo } from './utils.babel';
import { version } from '../../package.json';

const staticDir = './dist';

export const suffix = `v=${version}`;
export const publicPath = env => env === 'ghpages' ? '/react/' : '/';

export default env => ({
  publicPath: publicPath(env),
  path: pathTo(staticDir),
  filename: `[name].js?${suffix}`,
  sourceMapFilename: `[file].map?${suffix}`,
  chunkFilename: `[id].chunk.js?${suffix}`,
  jsonpFunction: 'w',
});
