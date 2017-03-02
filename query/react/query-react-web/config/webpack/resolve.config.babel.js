import { pathTo } from './utils.babel';

export default {
  extensions: [
    '.js',
    '.css',
    '.styl',
    '.json',
  ],
  modules: [
    pathTo('./src'),
    'node_modules',
  ],
};
