# 📦 Product Catalog API

A production-ready REST API for browsing **200,000 products** with fast, stable pagination.

## ✨ Features

- **Keyset (cursor) pagination** — O(log N) at any page depth, no slowdown on deep pages
- **Stable pagination** — new inserts/updates never cause duplicates or skipped rows
- **Category filtering** — composite indexes make filtered + paginated queries equally fast
- **Docker-first** — one command to run everything

---

## 🚀 Quick Start

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)

### 1. Clone the repo

```bash
git clone <your-repo-url>
cd product-catalog-api
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env if you want to change ports or passwords
```

### 3. Start MySQL + API

```bash
docker compose up -d
```

This will:
- Pull MySQL 8.0 and build the Node.js image
- Create the `products` table with the correct indexes
- Start the API on `http://localhost:3000`

> **First run?** MySQL takes ~15–20 seconds to initialise. The API waits for it automatically.

### 4. Seed the database (once)

```bash
docker compose exec api npm run seed
```

This inserts **200,000 products in ~5–8 seconds** using batched multi-row INSERTs.

### 5. Hit the API

```bash
curl http://localhost:3000/products
curl "http://localhost:3000/products?category=Electronics&limit=20"
```

---

## 🛠 Running Locally (without Docker)

### Prerequisites
- Node.js ≥ 18
- A running MySQL 8.0 instance

```bash
npm install
cp .env.example .env   # fill in your local DB credentials
npm run seed           # seed 200k products
npm start              # or: npm run dev  (hot-reload with nodemon)
```

---

## 📖 API Reference

### `GET /health`
Returns server status.

```json
{ "status": "ok", "ts": "2024-01-01T00:00:00.000Z" }
```

---

### `GET /products`

Browse products ordered **newest first**.

| Query param | Type   | Default | Description                             |
|-------------|--------|---------|-----------------------------------------|
| `category`  | string | —       | Filter by exact category name           |
| `limit`     | number | `50`    | Page size (1–100)                       |
| `cursor`    | string | —       | Opaque token from previous `nextCursor` |

**First page:**
```
GET /products?limit=50
GET /products?category=Electronics&limit=20
```

**Next page (use `nextCursor` from the previous response):**
```
GET /products?cursor=eyJjIjoiMjAyNC0...&limit=50
GET /products?category=Electronics&cursor=eyJjIjoiMjAyNC0...&limit=20
```

**Response:**
```json
{
  "data": [
    {
      "id": 123456,
      "name": "Premium Gadget 42",
      "category": "Electronics",
      "price": 149.99,
      "created_at": "2024-06-15T10:30:00.000Z",
      "updated_at": "2024-06-15T10:30:00.000Z"
    }
  ],
  "meta": {
    "count": 50,
    "hasMore": true,
    "nextCursor": "eyJjIjoiMjAyNC0wNi0xNVQxMDozMDowMC4wMDBaIiwi..."
  }
}
```

When `hasMore` is `false`, `nextCursor` is `null` — you've reached the last page.

---

### `GET /products/categories`

Returns all available category names (for building filter dropdowns).

```json
{
  "categories": [
    "Automotive",
    "Beauty",
    "Books",
    "Clothing",
    "Electronics"
  ]
}
```

---

## 🔑 How Cursor Pagination Works

### The problem with OFFSET

```sql
-- Page 1001 (50 per page) means:
SELECT * FROM products ORDER BY created_at DESC LIMIT 50 OFFSET 50000;
-- MySQL scans 50,050 rows and throws 50,000 away → gets slower the deeper you go.
-- Also: if 50 new products are added, every offset shifts — causing duplicates/gaps.
```

### The solution: keyset pagination

Instead of counting rows, we bookmark the last row we saw by its `(created_at, id)`:

```sql
-- Next page after the last seen row:
SELECT * FROM products
WHERE (created_at < '2024-06-15 10:30:00' OR (created_at = '2024-06-15 10:30:00' AND id < 123456))
ORDER BY created_at DESC, id DESC
LIMIT 50;
```

MySQL jumps directly to that position in the index — **O(log N)** always.  
New inserts don't shift anything — the cursor points to an exact row, not a position number.

### Index strategy

```sql
-- No filter: uses idx_cursor
INDEX idx_cursor (created_at DESC, id DESC)

-- With category filter: uses idx_category_cursor
INDEX idx_category_cursor (category, created_at DESC, id DESC)
```

Both queries scan **at most `limit` rows** regardless of how many products exist.

---

## 🗂 Project Structure

```
├── docker-compose.yml       Docker services (MySQL + API)
├── Dockerfile               Node.js API image
├── init.sql                 Schema + indexes (auto-run by MySQL on first start)
├── .env.example             Environment variable template
├── package.json
│
├── src/
│   ├── index.js             Express app entry point
│   ├── db.js                mysql2 connection pool
│   └── routes/
│       └── products.js      GET /products + GET /products/categories
│
└── scripts/
    └── seed.js              Generates 200,000 products fast
```

---

## 🔧 Configuration

All config is via environment variables (copy `.env.example` → `.env`):

| Variable             | Default        | Description              |
|----------------------|----------------|--------------------------|
| `DB_HOST`            | `localhost`    | MySQL host               |
| `DB_USER`            | `appuser`      | MySQL username           |
| `DB_PASSWORD`        | `apppassword`  | MySQL password           |
| `DB_NAME`            | `products_db`  | MySQL database name      |
| `MYSQL_ROOT_PASSWORD`| `rootpassword` | MySQL root password      |
| `MYSQL_PORT`         | `3306`         | MySQL exposed port       |
| `PORT`               | `3000`         | API server port          |

---

## 🛑 Teardown

```bash
docker compose down          # stop containers, keep DB data
docker compose down -v       # stop containers AND delete DB volume
```
