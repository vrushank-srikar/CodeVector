-- ──────────────────────────────────────────────────────────────
-- Schema: products catalog
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS products (
  id          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  name        VARCHAR(255)    NOT NULL,
  category    VARCHAR(100)    NOT NULL,
  price       DECIMAL(10, 2)  NOT NULL,
  created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),

  -- Supports: ORDER BY created_at DESC, id DESC  (no category filter)
  INDEX idx_cursor (created_at DESC, id DESC),

  -- Supports: WHERE category = ? ORDER BY created_at DESC, id DESC
  INDEX idx_category_cursor (category, created_at DESC, id DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
