# Database
PostgreSQL database running in Docker.

## Build & Run
```bash
docker build -t overseas_db . 
docker run --name my-database -p 5432:5432 overseas_db
```

## Connect
```bash
psql -h localhost -U myuser -p 5432 -d overseas_db
```
**Credentials**
 User :     `myuser`   
 Password : `123`      
 
## Dump
Generate a dump file:
```bash
pg_dump -U myuser -h localhost -p 5432 -d overseas_db -f overseas.sql
```
The dump is automatically loaded into the database on startup via `/docker-entrypoint-initdb.d/`, which executes `.sql` files when the container initializes.
