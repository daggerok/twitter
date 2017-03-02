import React, { PureComponent } from 'react';
import Rx from 'rx';

import './Home.styl';
import { rxConnect } from 'rx-connect';

@rxConnect(
  Rx.Observable.timer(0, 1000).timestamp()
)
export default class RxComponent extends React.PureComponent {

  render() {
    return (
      <div>
        Home page {this.props.value}
      </div>
    );
  }
}
