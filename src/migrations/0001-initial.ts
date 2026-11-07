import type { Queryable } from "../database";

// Uses IF NOT EXISTS, because databases from before migrations already have these tables
export default (sql: Queryable) => sql`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE,
    password VARCHAR(255),
    permission_level INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_user ON users(username);

  CREATE TABLE IF NOT EXISTS images (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    width INTEGER,
    height INTEGER,
    uploaded_by INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    s3_bucket VARCHAR(255),
    s3_key VARCHAR(500),
    storage_type VARCHAR(10) DEFAULT 'local' CHECK (storage_type IN ('local', 's3')),
    alt_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_image_storage ON images(storage_type, s3_bucket, s3_key);
  CREATE INDEX IF NOT EXISTS idx_image_uploader ON images(uploaded_by);

  CREATE TABLE IF NOT EXISTS entities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE,
    head_version_id INT,
    type VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_entity ON entities(name, type, head_version_id);

  CREATE TABLE IF NOT EXISTS entity_versions (
    id SERIAL PRIMARY KEY,
    entity_id INT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    previous_version INT REFERENCES entity_versions(id) ON DELETE SET NULL DEFAULT NULL,
    description TEXT,
    image_id INT REFERENCES images(id) ON DELETE SET NULL DEFAULT NULL,
    change_message TEXT DEFAULT '',
    review_status VARCHAR(32) DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
    reviewed_at TIMESTAMP,
    reviewed_by INT REFERENCES users(id) ON DELETE SET NULL,
    review_comment TEXT DEFAULT ''
  );

  CREATE INDEX IF NOT EXISTS idx_version ON entity_versions(entity_id, version_number, review_status);
`.simple();
