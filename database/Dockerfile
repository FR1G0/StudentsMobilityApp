FROM postgres:17-alpine

ENV POSTGRES_DB=overseas_db
ENV POSTGRES_USER=myuser
ENV POSTGRES_PASSWORD=123

COPY overseas.sql /docker-entrypoint-initdb.d/overseas.sql

EXPOSE 5432

VOLUME ["/var/lib/postgresql/data"]
