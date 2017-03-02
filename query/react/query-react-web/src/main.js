import React from 'react';
import { render } from 'react-dom';

import Application from './app/routes';

render(
  <Application />,
  document.querySelector('#app')
);
