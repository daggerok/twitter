import { publicPath, suffix } from '../output.babel';

export default {
  filename: '[name].css?' + suffix,
  disable: false,
  allChunks: true,
  publicPath,
};
