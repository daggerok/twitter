import { pathTo } from './utils.babel';
import { publicPath } from './output.config.babel';

export default {
  port: 8000,
  inline: true,
  stats: 'minimal',
  contentBase: pathTo('./src'),
  historyApiFallback: { index: `${publicPath}index.html`, },
  proxy: {
    '/api': {
      target: 'http://localhost:8080',
      secure: true,
    },
  },
};
