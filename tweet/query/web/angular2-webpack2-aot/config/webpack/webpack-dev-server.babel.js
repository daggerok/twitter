import { pathTo } from './utils.babel';
import { publicPath } from './output.babel';

const proxy = () => ({
  target: "http://localhost:8080",
  secure: false,
});

export default {
  port: 8000,
  inline: true,
  stats: 'minimal',
  contentBase: pathTo('./src'),
  historyApiFallback: { 
    index: `${publicPath}index.html`,
  },
  proxy: {
    "/api": proxy(),
  },
};
