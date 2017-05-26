import React from 'react';
import { Link } from 'react-router';
import './Header.styl';
import { baseHref } from '../../../services/BaseHref';

export default () => (
  <header id='nav-header'>
    <Link to={baseHref}
          activeClassName='active'>rx</Link>
  </header>
);
