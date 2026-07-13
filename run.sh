#!/usr/bin/env bash
# Runs the whole project with docker compose.
# Pass "clean" to tear down containers, images and volumes before starting fresh.
set -euo pipefail

#doesn't matter where the script if ran from
cd "$(dirname "$0")"

if [ "${1:-}" = "clean" ]; then
    echo ">> cleaning: removing containers, images and volumes"
    docker compose down --rmi all --volumes --remove-orphans
fi

echo ">> building and starting"
docker compose up --build
