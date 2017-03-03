#!/bin/bash

echo "stopping docker and clean resources if exists..."
echo ""

docker-compose -f cloud-infrastructure/docker-compose.yml down -v --remove-orphans --rmi local
if ! [ "$0" = "stop" ]; then
    echo ""
    echo "creating infrastructure..."
    echo ""

    docker-compose -f cloud-infrastructure/docker-compose.yml --project-name=twitter up -d
    echo ""
    echo "services is up and running."
fi
