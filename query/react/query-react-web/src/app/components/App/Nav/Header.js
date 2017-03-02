import React    from 'react';
import { Link } from 'react-router';
import               './Header.styl';

export default () => (
  <header id='nav-header'>
    <Link to='/'
          activeClassName='active'>rx</Link>
  </header>
);
