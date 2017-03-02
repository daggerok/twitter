import {
  pathTo,
  publicPath,
} from './utils.babel';

const proxy = () => ({
  target: 'http://localhost:8080',
  changeOrign: false,
  secure: false,
});

export default env => env === 'development' ? {
  port: 8000,
  inline: true,
  stats: 'minimal',
  contentBase: pathTo('./src'),
  historyApiFallback: {
    index: publicPath,
  },
  proxy: {
    '/api': proxy(),
  }
} : {};
