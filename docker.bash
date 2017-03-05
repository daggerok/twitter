#!/bin/bash

echo "stopping docker and clean resources if exists..."
echo ""
docker-compose -f cloud-infrastructure/compose/src/main/resources/docker-compose.yml --project-name=twitter down -v --remove-orphans --rmi local

if ! [ "$1" = "stop" ]; then # || ! [ $1 == "stop" ]; then
    echo ""
    echo "creating infrastructure..."
    echo ""

    docker-compose -f cloud-infrastructure/compose/src/main/resources/docker-compose.yml --project-name=twitter up -d --remove-orphans
    echo ""
    echo "all services are up and running."
fi
