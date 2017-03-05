import React from 'react';
import './Rx.styl';

import Rx from 'rx';

export default class RxConnectSearch extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      value: 0,
    };
  }

  componentDidMount() {
    this.subscription = Rx.Observable.timer(0, 250)
      .timestamp()
      .subscribe(::this.setState);
  }

  componentWillUnmount() {
    this.subscription.dispose();
  }

  render() {
    return (
      <div>
        Rx: {JSON.stringify(this.state.value)}
      </div>
    );
  }
}
