#!/bin/bash
export BASE=$HOME/Documents/code/test/java/spring/cloud
cp -Rf ./netflix-config-server-repo ../netflix-config-server-repo
cd ../netflix-config-server-repo/
git init
git add .
git commit -am init
cd ../twitter
mkdir -p $BASE
cp -Rf ../netflix-config-server-repo $BASE/netflix-config-server-repo
