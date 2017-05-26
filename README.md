twitter [![build](https://travis-ci.org/daggerok/twitter.svg?branch=master)](https://travis-ci.org/daggerok/twitter)
=======

```bash
gradle composeUp # bash docker.bash # or in fish: sh -c 'bash docker.bash stop'
bash repo.bash
gradle cloud-infrastructure:config-server:bootRun
gradle cloud-infrastructure:discovery-server:bootRun
gradle tweet:edge:bootRun
gradle tweet:query:bootRun
gradle tweet:command:bootRun
# send message:
# 1) open http://localhost:8761
# 2) select query-edge
# 3) go base uri
# 4) type message, submit it using enter
# verify db: http://localhost:8002/db/test/tweet
gralde composeDown # bash docker.bash stop
gradle --stop
```

reactpr

```bash
gradle build -b tweet/webflux/build.gradle
```

web @angular/cli

```bash
npm remove angular-cli -g
npm i @angular/cli -g
ng new --routing=true --prefix=twitter --style=styl tweet-query-web
cd tweet-query-web/
ng eject
npm i
```

update npm versions

```bash
npm i -g npm-check-updates
ncu -u
```

docker services infrastructure

cloud infrastructure dev admin

```bash
open http://localhost:8001/ # auth: twitter / twitter
open http://localhost:8002/ # auth: twitter / twitter
```

*TODO: outdated*

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
