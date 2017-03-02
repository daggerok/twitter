export default {
  sourceMap: false,
  beautify: false,
  mangle: {
    screw_ie8: true,
    keep_fnames: true
  },
  comments: false,
  compress: {
    warnings: false,
    screw_ie8: true,
    conditionals: true,
    unused: true,
    comparisons: true,
    sequences: true,
    dead_code: true,
    evaluate: true,
    if_return: true,
    join_vars: true,
  },
  output: {
    comments: false,
  },
};
