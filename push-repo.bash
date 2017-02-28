#!/bin/bash
export BASE=$HOME/Documents/code/test/java/spring/cloud
mkdir -p $BASE/netflix-config-server-repo
rm -rf $BASE/netflix-config-server-repo/*.yml
cp -Rf ./netflix-config-server-repo/*.* $BASE/netflix-config-server-repo/
