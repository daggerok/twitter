import React from 'react';

import Collapse from './Collapse';
import Links from './Links';
import Header from './Header';

export default () => (
  <nav class='container-fluid text-center text-muted'>
    <Header />
    <Collapse />
    <Links />
  </nav>
);
