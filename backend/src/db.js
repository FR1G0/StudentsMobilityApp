// file database handling
import pgPromise from 'pg-promise';
const pgp = pgPromise({})
// use DATABASE_URL when set (docker-compose points it at the db container);
// fall back to localhost for running the backend outside Docker
const connection = process.env.DATABASE_URL || 'postgresql://myuser:123@localhost:5432/overseas_db';
const db = pgp(connection);

export default db;
