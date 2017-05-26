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

cloud infrastructure dev admin

```bash
open http://localhost:8001/ # auth: twitter / twitter
open http://localhost:8002/ # auth: twitter / twitter
```
