#!/bin/bash

export $TWITTER=$PWD
export BASE=$HOME/Documents/code/test/java/spring/cloud

rm -rf $BASE/netflix-config-server-repo
mkdir -p $BASE

cp -Rf ./netflix-config-server-repo $BASE/netflix-config-server-repo
cd $BASE/netflix-config-server-repo/
git init
git add .
git commit -am init
cd $TWITTER
