export default {
  presets: [
    ['es2015', { modules: false }],
    'stage-0',
    'react',
  ],
  plugins: [
    'react-html-attrs',
    'add-module-exports',
    'syntax-dynamic-import',
    'transform-class-properties',
    'transform-decorators-legacy',
  ],
};
