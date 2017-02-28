const ExtractTextPlugin = require('extract-text-webpack-plugin');
const { pathTo } = require('./utils');

module.exports = env => ({
  rules: [
    {
      enforce: 'pre',
      test: /\.js$/i,
      loader: 'source-map-loader',
      exclude: [
        /\/node_modules\//,
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
        pathTo('src/styles.styl'),
      ],
      test: /\.css$/i,
      loaders: [
        'exports-loader?module.exports.toString()',
        'css-loader?{"sourceMap":false,"importLoaders":1}',
        'postcss-loader',
      ]
    },
    {
      exclude: [
        pathTo('src/styles.styl'),
      ],
      test: /\.scss$|\.sass$/i,
      loaders: [
        'exports-loader?module.exports.toString()',
        'css-loader?{"sourceMap":false,"importLoaders":1}',
        'postcss-loader',
        'sass-loader',
      ],
    },
    {
      exclude: [
        pathTo('src/styles.styl'),
      ],
      test: /\.less$/i,
      loaders: [
        'exports-loader?module.exports.toString()',
        'css-loader?{"sourceMap":false,"importLoaders":1}',
        'postcss-loader',
        'less-loader',
      ],
    },
    {
      exclude: [
        pathTo('src/styles.styl'),
      ],
      test: /\.styl$/i,
      loaders: [
        'exports-loader?module.exports.toString()',
        'css-loader?{"sourceMap":false,"importLoaders":1}',
        'postcss-loader',
        'stylus-loader?{"sourceMap":false,"paths":[]}',
      ],
    },
    {
      include: [
        pathTo('src/styles.styl'),
      ],
      test: /\.css$/,
      loaders: ExtractTextPlugin.extract({
        use: [
          'css-loader?{"sourceMap":false,"importLoaders":1}',
          'postcss-loader',
        ],
        fallback: 'style-loader',
        publicPath: '',
      }),
    },
    {
      include: [
        pathTo('src/styles.styl'),
      ],
      test: /\.scss$|\.sass$/,
      loaders: ExtractTextPlugin.extract({
        use: [
          'css-loader?{"sourceMap":false,"importLoaders":1}',
          'postcss-loader',
          'sass-loader',
        ],
        fallback: 'style-loader',
        publicPath: '',
      }),
    },
    {
      include: [
        pathTo('src/styles.styl'),
      ],
      test: /\.less$/,
      loaders: ExtractTextPlugin.extract({
        use: [
          'css-loader?{"sourceMap":false,"importLoaders":1}',
          'postcss-loader',
          'less-loader',
        ],
        fallback: 'style-loader',
        publicPath: '',
      }),
    },
    {
      include: [
        pathTo('src/styles.styl'),
      ],
      test: /\.styl$/,
      loaders: ExtractTextPlugin.extract({
        use: [
          'css-loader?{"sourceMap":false,"importLoaders":1}',
          'postcss-loader',
          'stylus-loader?{"sourceMap":false,"paths":[]}',
        ],
        fallback: 'style-loader',
        publicPath: '',
      }),
    },
    {
      test: /\.ts$/,
      loader: '@ngtools/webpack',
    },
  ],
});
