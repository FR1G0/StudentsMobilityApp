// file database handling
import pgPromise from 'pg-promise';
const pgp = pgPromise({})
// use DATABASE_URL when set or fall back to localhost for running the backend outside Docker
const connection = process.env.DATABASE_URL || 'postgresql://myuser:123@localhost:5432/overseas_db';
const db = pgp(connection);

export default db;
