import React    from 'react';
import { Link } from 'react-router';
import               './Links.styl';

export default () => (
  <ul class='nav navbar-nav'>
    <li>
      <Link class='text-muted'
            to='/'>Home</Link>
    </li>
    <li>
      <Link class='text-muted'
            to='/rx'>Rx</Link>
    </li>
    <li>
      <Link class='text-muted'
            to='/some'>Not found</Link>
    </li>
  </ul>
);
