'use strict';

const express = require('express');
const { z }   = require('zod');
const { pool } = require('../db');

const router = express.Router();

// ─── Cursor helpers ────────────────────────────────────────────────────────────
//
// A cursor is a base64url-encoded JSON blob: { c: <ISO created_at>, i: <id> }
// It is opaque to the client — they just pass it back on the next request.
//
// Why (created_at, id)?
//   created_at alone is not unique, so ties are broken by id (always unique).
//   Together they form a stable, collision-free position marker.

function encodeCursor(createdAt, id) {
  const payload = JSON.stringify({
    c: createdAt instanceof Date ? createdAt.toISOString() : createdAt,
    i: id,
  });
  return Buffer.from(payload).toString('base64url');
}

function decodeCursor(token) {
  try {
    const { c, i } = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    const createdAt = new Date(c);
    const id = parseInt(i, 10);
    if (isNaN(createdAt.getTime()) || isNaN(id)) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

// ─── Query validation ──────────────────────────────────────────────────────────

const querySchema = z.object({
  category: z.string().trim().min(1).optional(),
  limit:    z.coerce.number().int().min(1).max(100).default(50),
  cursor:   z.string().optional(),
});

// ─── GET /products ─────────────────────────────────────────────────────────────
//
// Returns a page of products ordered newest-first.
//
// Query params:
//   category  – optional exact-match filter
//   limit     – page size (1–100, default 50)
//   cursor    – opaque token from previous response's `nextCursor`
//
// Response:
//   {
//     data:       Product[],
//     meta: {
//       count:      number,   // items in this page
//       hasMore:    boolean,  // true if another page exists
//       nextCursor: string | null
//     }
//   }
//
// Pagination strategy: KEYSET (cursor-based)
// ─────────────────────────────────────────
// Standard OFFSET pagination has two fatal flaws for this use-case:
//   1. Performance: OFFSET N scans and discards N rows every time — O(N).
//   2. Stability:   If new rows are inserted while the user browses,
//                   rows shift, causing duplicates or gaps across pages.
//
// Keyset pagination fixes both:
//   • We record the (created_at, id) of the LAST row returned.
//   • The next query starts exactly after that row, using the index directly.
//   • New inserts don't affect the cursor position at all.
//   • Performance is O(log N) regardless of page depth.

router.get('/', async (req, res) => {
  // 1. Validate input
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error:   'Invalid query parameters',
      details: parsed.error.flatten().fieldErrors,
    });
  }

  const { category, limit, cursor } = parsed.data;

  // 2. Build WHERE clause dynamically
  const conditions = [];
  const params     = [];

  if (category) {
    conditions.push('category = ?');
    params.push(category);
  }

  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (!decoded) {
      return res.status(400).json({ error: 'Invalid or malformed cursor' });
    }

    // Keyset condition: give me rows that come AFTER the cursor in DESC order.
    //
    //   (created_at, id) < (cursor.createdAt, cursor.id)   [descending order]
    //
    // Expanded to the OR form for broad MySQL 8.0 compatibility and
    // to ensure the composite index (created_at DESC, id DESC) is used:
    //
    //   created_at < ?  OR  (created_at = ? AND id < ?)
    //
    conditions.push('(created_at < ? OR (created_at = ? AND id < ?))');
    params.push(decoded.createdAt, decoded.createdAt, decoded.id);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // 3. Fetch limit+1 rows — the extra row tells us if a next page exists
  //    without a separate COUNT query.
  const sql = `
    SELECT id, name, category, price, created_at, updated_at
    FROM   products
    ${where}
    ORDER  BY created_at DESC, id DESC
    LIMIT  ?
  `;
  params.push(limit + 1);

  try {
    const [rows] = await pool.execute(sql, params);

    const hasMore  = rows.length > limit;
    const data     = hasMore ? rows.slice(0, limit) : rows;
    const lastRow  = data.at(-1);
    const nextCursor = hasMore && lastRow
      ? encodeCursor(lastRow.created_at, lastRow.id)
      : null;

    return res.json({
      data,
      meta: { count: data.length, hasMore, nextCursor },
    });
  } catch (err) {
    console.error('[products] Query error:', err.message, '| SQL state:', err.sqlState, '| Code:', err.code);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

// ─── GET /products/categories ──────────────────────────────────────────────────
// Returns all distinct category values — useful for building filter dropdowns.

router.get('/categories', async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT DISTINCT category FROM products ORDER BY category'
    );
    return res.json({ categories: rows.map(r => r.category) });
  } catch (err) {
    console.error('[categories] Query error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
