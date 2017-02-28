twitter [![build](https://travis-ci.org/daggerok/twitter.svg?branch=master)](https://travis-ci.org/daggerok/twitter)
=======

web @angular/cli

```bash
npm remove angular-cli -g
npm i @angular/cli -g
ng new --routing=true --prefix=twitter --style=styl tweet-query-web
cd tweet-query-web/
ng eject
npm i
```

```bash
docker-compose down -v --remove-orphans --rmi local
sudo rm -rf build/docker
docker-compose --project-name=twitter up -d --build --force-recreate --remove-orphans 
open http://localhost:8001/ # guest / guest
open http://localhost:8002/ # guest / guest
...
docker-compose stop
```

test config git repo

```bash
bash push-repo.bash
cd ../netflix-config-server-repo
git init
git add .
git commit -am init
cd ../twitter
gradle netflix-config-server:bootRun
```

*outdated:*

spring cloud data flow server (using ports 9393, 8081)

```bash
wget http://repo.spring.io/release/org/springframework/cloud/spring-cloud-dataflow-server-local/1.1.4.RELEASE/spring-cloud-dataflow-server-local-1.1.4.RELEASE.jar -P build
wget wget http://repo.spring.io/release/org/springframework/cloud/spring-cloud-dataflow-shell/1.1.4.RELEASE/spring-cloud-dataflow-shell-1.1.4.RELEASE.jar -P build
java -jar build/spring-cloud-dataflow-server-local-1.1.4.RELEASE.jar
java -jar build/spring-cloud-dataflow-shell-1.1.4.RELEASE.jar
```

*see https://github.com/spring-cloud/spring-cloud-stream-app-starters/tree/master/spring-cloud-stream-app-descriptor/src/main/resources/META-INF*

```bash
>dataflow config server http://localhost:9393
>app register --name http --type source --uri maven://org.springframework.cloud.stream.app:http-source-rabbit:1.1.2.BUILD-SNAPSHOT
>app register --name log --type sink --uri maven://org.springframework.cloud.stream.app:log-sink-rabbit:1.1.2.BUILD-SNAPSHOT
>app import --uri http://bit.ly/Avogadro-SR1-stream-applications-rabbit-maven

```
