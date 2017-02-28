const ProgressPlugin = require('webpack/lib/ProgressPlugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const autoprefixer = require('autoprefixer');
const postcssUrl = require('postcss-url');

const {
  NoEmitOnErrorsPlugin,
  LoaderOptionsPlugin,
  // ProvidePlugin,
  DefinePlugin,
  optimize,
} = require('webpack');

const {
  AggressiveMergingPlugin,
  CommonsChunkPlugin,
} = optimize;

const { GlobCopyWebpackPlugin, BaseHrefWebpackPlugin } = require('@angular/cli/plugins/webpack');
const { AotPlugin } = require('@ngtools/webpack');

const { pathTo, jsonEnv } = require('./utils');
const nodeModules = pathTo('node_modules');
const entryPoints = ['inline','polyfills','sw-register','styles','vendor','main'];
const baseHref = undefined;
const deployUrl = undefined;

module.exports = env => [
  env !== 'production' ? new NoEmitOnErrorsPlugin() : undefined,
  new GlobCopyWebpackPlugin({
    patterns: [
      'assets',
      'favicon.ico',
    ],
    globOptions: {
      cwd: pathTo('./src'),
      dot: true,
      ignore: '**/.gitkeep'
    }
  }),
  new ProgressPlugin(),
  new HtmlWebpackPlugin({
    template: './src/index.html',
    filename: './index.html',
    hash: false,
    inject: true,
    compile: true,
    favicon: false,
    minify: false,
    cache: true,
    showErrors: true,
    chunks: 'all',
    excludeChunks: [],
    title: 'Webpack App',
    xhtml: true,
    chunksSortMode: function sort(left, right) {

      let leftIndex = entryPoints.indexOf(left.names[0]);
      let rightindex = entryPoints.indexOf(right.names[0]);

      if (leftIndex > rightindex) return 1;
      else if (leftIndex < rightindex) return -1;
      else return 0;
    }
  }),
  new BaseHrefWebpackPlugin({}),
  new CommonsChunkPlugin({
    name: 'inline',
    minChunks: null
  }),
  new CommonsChunkPlugin({
    name: 'vendor',
    minChunks: module => module.resource && module.resource.startsWith(nodeModules),
    chunks: [
      'main'
    ]
  }),
  new ExtractTextPlugin({
    filename: '[name].bundle.css',
    disable: true
  }),
  new LoaderOptionsPlugin({
    sourceMap: false,
    options: {
      postcss: [
        autoprefixer(),
        postcssUrl({url: URL => {
          // Only convert absolute URLs, which CSS-Loader won't process into require().
          if (!URL.startsWith('/')) {
            return URL;
          }
          // Join together base-href, deploy-url and the original URL.
          // Also dedupe multiple slashes into single ones.
          return `/${baseHref || ''}/${deployUrl || ''}/${URL}`.replace(/\/\/+/g, '/');
        }})
      ],
      sassLoader: {
        sourceMap: false,
        includePaths: []
      },
      lessLoader: {
        sourceMap: false
      },
      context: ''
    }
  }),
  new AotPlugin({
    mainPath: 'main.ts',
    hostReplacementPaths: {
      'environments/environment.ts': env ==='production'
        ? 'environments/environment.prod.ts'
        : 'environments/environment.ts',
    },
    exclude: [],
    tsConfigPath: 'src/tsconfig.app.json',
    skipCodeGeneration: true,
  }),
  // new ProvidePlugin(providePluginConfig),
  new DefinePlugin({
    'process.env': {
      NODE_ENV: jsonEnv(env),
      DEVELOPMENT: env === 'development',
    },
  }),
  env !== 'development' ? new AggressiveMergingPlugin() : undefined,
].filter(p => !!p);
