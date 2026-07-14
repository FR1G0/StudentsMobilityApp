StudentMobilityApp
===================

REQUIREMENTS
------------
Docker and Docker Compose must be installed on your system.
(See: https://docs.docker.com/get-docker/ and https://docs.docker.com/compose/install/)

BUILD & RUN
------------

Option 1: Using the provided script (recommended)

The run.sh script cleans up any previous build before starting the
containers, which is useful when rebuilding.

  ./run.sh

If the script is not executable, run it with sh instead:

  sh run.sh

Option 2: Using Docker Compose directly

  docker compose up --build
