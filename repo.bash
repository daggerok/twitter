#!/bin/bash

export $TWITTER=$PWD
export BASE=$HOME/Documents/code/test/java/spring/cloud

rm -rf $BASE/config-server-repo
mkdir -p $BASE

cp -Rf ./cloud-infrastructure/config-server-repo $BASE/config-server-repo
cd $BASE/config-server-repo/
git init
git add .
git commit -am init
cd $TWITTER
