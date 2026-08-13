# StudentMobilityApp
![Preview Image of StudentMobilityApp Ui](https://github.com/user-attachments/assets/dba4510a-64e3-493d-bb8a-dd29593782e2 "Image Preview of StudentMobilityApp")
## About

StudentMobilityApp is a web application (backend, frontend, database) designed to manage and streamline the Erasmus+ / Overseas mobility process for university students. It provides a secure, centralized, and role-governed workflow environment to handle the complete lifecycle of a mobility program—from initial application to final credit recognition.

### Key Features
* **Students:** Submit mobility applications, manage study plan course mappings, upload signed Learning Agreements, update mobility dates, and upload Transcripts of Records for grade conversion.
* **Academic Advisors (Referent Lecturers):** Review and evaluate proposed course mappings, approve or reject Learning Agreements with feedback, and validate official exam recognitions.
* **Overseas Mobility Office:** Moderate overall application progress, conduct pre-departure compliance checks, oversee documentation, and officially close finalized mobility files.

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
