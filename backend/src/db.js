// file database handling
import pgPromise from 'pg-promise';
const pgp = pgPromise({})
const db = pgp('postgresql://myuser:123@localhost:5432/overseas_db');

export default db;
