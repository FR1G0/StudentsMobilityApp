# StudentMobilityApp

## Requirements

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) installed on your system.

## Build & Run

### Option 1: Using the provided script (recommended)

The `run.sh` script cleans up any previous build before starting the containers, which is useful when rebuilding:

```bash
./run.sh
```

If the script is not executable, run it with `sh` instead:

```bash
sh run.sh
```

### Option 2: Using Docker Compose directly

```bash
docker compose up --build
```
