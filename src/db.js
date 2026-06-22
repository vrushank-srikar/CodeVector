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

// ─── Schema Init ───────────────────────────────────────────────────────────────
// Creates the products table + indexes if they don't exist.
// Runs automatically on every startup — safe to call repeatedly (IF NOT EXISTS).
// This means no manual SQL steps are needed on any deployment target.
async function initSchema() {
  // Must use query() not execute() — DDL cannot use prepared statements
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
      name        VARCHAR(255)    NOT NULL,
      category    VARCHAR(100)    NOT NULL,
      price       DECIMAL(10, 2)  NOT NULL,
      created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      INDEX idx_cursor (created_at DESC, id DESC),
      INDEX idx_category_cursor (category, created_at DESC, id DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('[db] Schema ready');
}

// ─── Connectivity Check ────────────────────────────────────────────────────────
// Called once at startup; exits if the DB is unreachable.
async function testConnection() {
  const conn = await pool.getConnection();
  await conn.ping();
  conn.release();
  console.log('[db] Connected to MySQL');
  await initSchema();
}

module.exports = { pool, testConnection };
