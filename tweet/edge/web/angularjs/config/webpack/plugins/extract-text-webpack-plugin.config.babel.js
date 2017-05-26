import { publicPath, suffix } from '../output.config.babel';

export default {
  filename: '[name].css?' + suffix,
  disable: false,
  allChunks: true,
  publicPath,
};
