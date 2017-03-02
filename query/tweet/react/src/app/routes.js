import React from 'react';
import {
  Router,
  Route,
  IndexRoute,
  browserHistory,
  applyRouterMiddleware } from 'react-router';
import { useScroll } from 'react-router-scroll';

import App from './components/App';
import Home from './components/Home';
import NotFound from './components/NotFound';
import Rx from './components/Rx';
import { baseHref } from './services/BaseHref';

export default () => (
  <Router history={browserHistory} render={applyRouterMiddleware(useScroll())}>
    <Route path={baseHref} component={App}>
      <IndexRoute component={Home} />
      <Route path='rx' component={Rx} />
      <Route path='*' component={NotFound} />
    </Route>
    <Route path='*' component={NotFound} />
  </Router>
);
