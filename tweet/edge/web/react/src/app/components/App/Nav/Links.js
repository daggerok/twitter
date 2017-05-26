import React from 'react';
import { Link } from 'react-router';
import './Links.styl';
import { baseHref } from '../../../services/BaseHref';

export default () => (
  <ul class='nav navbar-nav'>
    <li>
      <Link class='text-muted'
            to={baseHref}>Home</Link>
    </li>
    <li>
      <Link class='text-muted'
            to={baseHref + 'rx'}>Rx</Link>
    </li>
    <li>
      <Link class='text-muted'
            to={baseHref + 'some'}>Not found</Link>
    </li>
  </ul>
);
