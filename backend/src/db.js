// file database handling
const pgp = require('pg-promise')();
const db = pgp('postgres://username:password@localhost:5432/mydatabase');

module.exports = db;
