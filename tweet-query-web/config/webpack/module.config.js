const ExtractTextPlugin = require('extract-text-webpack-plugin');
const { pathTo } = require('./utils');

const loaders = [
  'exports-loader?module.exports.toString()',
  'css-loader?{"sourceMap":false,"importLoaders":1}',
  'postcss-loader',
];

const use = [
  'css-loader?{"sourceMap":false,"importLoaders":1}',
  'postcss-loader',
];

const publicPath = '';
const fallback = 'style-loader';

module.exports = env => ({
  rules: [
    {
      enforce: 'pre',
      test: /\.js$/i,
      loader: 'source-map-loader',
      exclude: [
        /\/node_modules\//i,
      ]
    },
    {
      test: /\.json$/i,
      loader: 'json-loader',
    },
    {
      test: /\.html$/i,
      loader: 'raw-loader',
    },
    {
      test: /\.(eot|svg)$/i,
      loader: 'file-loader?name=[name].[hash:20].[ext]',
    },
    {
      test: /\.(jpg|png|gif|otf|ttf|woff|woff2|cur|ani)$/i,
      loader: 'url-loader?name=[name].[hash:20].[ext]&limit=10000',
    },
    {
      exclude: [
        pathTo('./src/styles.css'),
      ],
      test: /\.css$/i,
      loaders,
    },
    {
      exclude: [
        pathTo('./src/styles.scss'),
        pathTo('./src/styles.sass'),
      ],
      test: /\.scss$|\.sass$/i,
      loaders: [
        ...loaders,
        'sass-loader',
      ],
    },
    {
      exclude: [
        pathTo('./src/styles.less'),
      ],
      test: /\.less$/i,
      loaders: [
        ...loaders,
        'less-loader',
      ],
    },
    {
      exclude: [
        pathTo('./src/styles.styl'),
      ],
      test: /\.styl$/i,
      loaders: [
        ...loaders,
        'stylus-loader?{"sourceMap":false,"paths":[]}',
      ],
    },
    {
      include: [
        pathTo('./src/styles.css'),
      ],
      test: /\.css$/i,
      loaders: ExtractTextPlugin.extract({
        use,
        fallback,
        publicPath,
      }),
    },
    {
      include: [
        pathTo('./src/styles.scss'),
        pathTo('./src/styles.sass'),
      ],
      test: /\.scss$|\.sass$/i,
      loaders: ExtractTextPlugin.extract({
        use: [
          ...use,
          'sass-loader',
        ],
        fallback,
        publicPath,
      }),
    },
    {
      include: [
        pathTo('./src/styles.less'),
      ],
      test: /\.less$/i,
      loaders: ExtractTextPlugin.extract({
        use: [
          ...use,
          'less-loader',
        ],
        fallback,
        publicPath,
      }),
    },
    {
      include: [
        pathTo('./src/styles.styl'),
      ],
      test: /\.styl$/i,
      loaders: ExtractTextPlugin.extract({
        use: [
          ...use,
          'stylus-loader?{"sourceMap":false,"paths":[]}',
        ],
        fallback,
        publicPath,
      }),
    },
    {
      test: /\.ts$/i,
      loader: '@ngtools/webpack',
    },
  ],
});
