module.exports = {
  env: {
    es6: true,
    node: true,
    browser: true,
    commonjs: true,
  },
  parser: 'babel-eslint',
  extends: [
    'stylelint',
    'eslint:recommended',
  ],
  parserOptions: {
    ecmaFeatures: {
      experimentalObjectRestSpread: true,
      modules: true,
      esversion: 6,
      jsx: true,
    },
    sourceType: 'module'
  },
  plugins: [
    'react',
    'babel',
  ],
  rules: {
    // 'no-unused-vars': 1,
    'no-unused-vars': [
      'off', { 'vars': 'all', 'args': 'after-used' }
    ],
    // 'no-console': 1,
    // 'no-console': 0,
    'no-console': [
      'off',
    ],
    indent: [
      'error',
      2,
    ],
    'linebreak-style': [
      'error',
      'unix',
    ],
    quotes: [
      'error',
      'single',
    ],
    semi: [
      'error',
      'always',
    ],
    strict: 0,
  },
  'max-len': [
    1,
    120,
    2,
    { ignoreComments: true }
  ],
};
