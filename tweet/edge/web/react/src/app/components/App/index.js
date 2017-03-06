import React, { Component } from 'react';
import './App.styl';
import Nav from './Nav';

export default class App extends Component {
  render() {
    return (
      <div>
        <Nav />
        <div id="content"
             class="container-fluid">

          {this.props.children}
        </div>
      </div>
    );
  }
}
