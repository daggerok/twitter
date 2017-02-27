#!/bin/bash

cp -Rf ./netflix-config-server-repo ../netflix-config-server-repo
cd ../netflix-config-server-repo/
git init
git add .
git commit -am init
cd ../twitter
mkdir -p $HOME/Documents/code/test/java/spring/cloud
cp -Rf ../netflix-config-server-repo $HOME/Documents/code/test/java/spring/cloud/netflix-config-server-repo
