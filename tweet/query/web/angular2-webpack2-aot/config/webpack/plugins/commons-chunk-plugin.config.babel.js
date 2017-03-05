import { suffix } from '../output.babel';

const names = [
  'polyfills',
  'vendors',
];

export default {
  names,
  minChunks: names.length,
  filename: `[name].js?${suffix}`,
};
