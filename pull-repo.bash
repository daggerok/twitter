#!/bin/bash
export BASE=$HOME/Documents/code/test/java/spring/cloud
mv -p ./netflix-config-server-repo
rm -rf ./netflix-config-server-repo/*.yml
cp -Rf $BASE/netflix-config-server-repo/*.* ./netflix-config-server-repo/
