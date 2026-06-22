'use strict';
require('dotenv').config();

const mysql = require('mysql2/promise');

// ─── Connection Pool ───────────────────────────────────────────────────────────
// A pool is used instead of a single connection so concurrent requests each
// get their own connection without blocking each other.
const pool = mysql.createPool({
  host:              process.env.DB_HOST     || 'localhost',
  port:              parseInt(process.env.DB_PORT || '3306', 10),
  user:              process.env.DB_USER     || 'appuser',
  password:          process.env.DB_PASSWORD || 'apppassword',
  database:          process.env.DB_NAME     || 'products_db',
  connectionLimit:   20,          // max simultaneous DB connections
  waitForConnections: true,
  queueLimit:        0,
  timezone:          'Z',         // always store/read as UTC
  decimalNumbers:    true,        // return DECIMAL columns as JS numbers
});

// ─── Connectivity Check ────────────────────────────────────────────────────────
// Called once at startup; exits if the DB is unreachable.
async function testConnection() {
  const conn = await pool.getConnection();
  await conn.ping();
  conn.release();
  console.log('[db] Connected to MySQL');
}

module.exports = { pool, testConnection };
