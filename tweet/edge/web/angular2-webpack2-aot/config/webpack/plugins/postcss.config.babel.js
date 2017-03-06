import rucksack from 'rucksack-css';
import precss from 'precss';

export default [
  precss,
  rucksack({
    fallbacks: true,
    autoprefixer: {
      browsers: [
        'last 4 versions',
      ],
    },
  }),
];
