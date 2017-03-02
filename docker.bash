#!/bin/bash

docker-compose down -v --remove-orphans --rmi local
docker-compose --project-name=twitter up -d
