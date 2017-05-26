import { pathTo, publicPath } from './utils.babel';

const proxy = () => ({
  target: 'http://localhost:8080',
  changeOrign: false,
  secure: false,
});

export default env => env === 'development' ? {
  port: 8000,
  inline: true,
  stats: 'minimal',
  publicPath,
  contentBase: pathTo('./src'),
  historyApiFallback: {
    index: `${publicPath}react.html`,
  },
  proxy: {
    '/api': proxy(),
  }
} : {};
