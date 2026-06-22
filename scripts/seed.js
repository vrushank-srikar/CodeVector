'use strict';

// ─── Seed Script ──────────────────────────────────────────────────────────────
//
// Generates 200,000 products fast using batched multi-row INSERTs.
//
// Strategy:
//   Instead of 200,000 individual INSERT statements (slow), we build
//   batches of BATCH_SIZE rows and send them as a single INSERT ... VALUES
//   (...), (...), ... statement. This reduces round-trips from 200,000
//   to just TOTAL / BATCH_SIZE = 200 queries.
//
//   Benchmark: ~4–8 seconds on a local Docker MySQL instance.
//
// Why not LOAD DATA INFILE?
//   LOAD DATA INFILE is faster but requires FILE privilege and a writable
//   path inside the container — more setup friction. Batched INSERT is
//   nearly as fast and requires no extra permissions.
//
// Usage:
//   node scripts/seed.js                    (uses .env)
//   DB_HOST=localhost node scripts/seed.js  (override via env)
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config();
const mysql = require('mysql2/promise');

// ─── Config ───────────────────────────────────────────────────────────────────

const TOTAL      = 200_000;
const BATCH_SIZE = 1_000;   // rows per INSERT — sweet spot for MySQL

const CATEGORIES = [
  'Electronics',
  'Clothing',
  'Books',
  'Sports & Outdoors',
  'Home & Garden',
  'Beauty',
  'Toys & Games',
  'Food & Grocery',
  'Automotive',
  'Health & Wellness',
];

const ADJECTIVES = [
  'Premium', 'Deluxe', 'Pro', 'Ultra', 'Smart',
  'Classic', 'Modern', 'Advanced', 'Essential', 'Elite',
  'Compact', 'Portable', 'Wireless', 'Ergonomic', 'Eco-Friendly',
];

const NOUNS = [
  'Widget', 'Gadget', 'Device', 'Kit', 'Set',
  'Bundle', 'Pack', 'Collection', 'Series', 'Edition',
  'Organizer', 'Tracker', 'Monitor', 'Charger', 'Holder',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Random integer in [min, max] */
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

/** Random element from an array */
const pick = (arr) => arr[randInt(0, arr.length - 1)];

/** Random DATETIME spread over the past 2 years, returned as a JS Date */
function randomDate() {
  const now        = Date.now();
  const twoYrsAgo  = now - 2 * 365 * 24 * 60 * 60 * 1000;
  return new Date(twoYrsAgo + Math.random() * (now - twoYrsAgo));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306', 10),
    user:     process.env.DB_USER     || 'appuser',
    password: process.env.DB_PASSWORD || 'apppassword',
    database: process.env.DB_NAME     || 'products_db',
    timezone: 'Z',
    // Allow large multi-row INSERT packets
    maxAllowedPacket: 64 * 1024 * 1024, // 64 MB
  });

  console.log('✔  Connected to MySQL');

  // Clear any existing data
  console.log('    Truncating products table...');
  await conn.execute('SET FOREIGN_KEY_CHECKS = 0');
  await conn.execute('TRUNCATE TABLE products');
  await conn.execute('SET FOREIGN_KEY_CHECKS = 1');

  console.log(`\n⏳  Seeding ${TOTAL.toLocaleString()} products`);
  console.log(`    (${TOTAL / BATCH_SIZE} batches × ${BATCH_SIZE} rows each)\n`);

  const startTime = Date.now();
  let totalInserted = 0;

  for (let batch = 0; batch < TOTAL / BATCH_SIZE; batch++) {
    // Build one flat params array and a matching placeholders string.
    // Each row = 5 values: (name, category, price, created_at, updated_at)
    const params       = [];
    const placeholders = [];

    for (let i = 0; i < BATCH_SIZE; i++) {
      const name      = `${pick(ADJECTIVES)} ${pick(NOUNS)} ${totalInserted + i + 1}`;
      const category  = pick(CATEGORIES);
      const price     = (randInt(100, 99900) / 100).toFixed(2); // $1.00 – $999.00
      const createdAt = randomDate();
      // updatedAt is the same as createdAt for freshly seeded rows
      const updatedAt = createdAt;

      params.push(name, category, price, createdAt, updatedAt);
      placeholders.push('(?, ?, ?, ?, ?)');
    }

    await conn.execute(
      `INSERT INTO products (name, category, price, created_at, updated_at)
       VALUES ${placeholders.join(',')}`,
      params,
    );

    totalInserted += BATCH_SIZE;

    // Progress every 10 %
    if (totalInserted % (TOTAL / 10) === 0) {
      const pct     = ((totalInserted / TOTAL) * 100).toFixed(0);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`    ${pct}%  — ${totalInserted.toLocaleString()} rows  (${elapsed}s)`);
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n✅  Done! ${TOTAL.toLocaleString()} products inserted in ${totalTime}s`);

  await conn.end();
}

seed().catch((err) => {
  console.error('❌  Seed failed:', err.message);
  process.exit(1);
});
