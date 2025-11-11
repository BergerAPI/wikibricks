import postgres from "postgres";

/**
 * A column in the user table
 */
export type User = {
  id: number;
  username: string;
  password: string;
  permission_level: number;
  created_at: Date;
};

/**
 * Represents all possible values of the entity version review_status row
 */
export type ReviewStatus = "pending" | "approved" | "rejected";

/**
 * A column in the entity versions table
 */
export type EntityVersion = {
  id: number;
  entity_id: number;
  version_number: string;
  is_active: boolean;
  created_at: Date;
  created_by: number;
  description: string;
  change_message: string;
  previous_version: number;
  review_status: ReviewStatus;
};

/**
 * A column in the brands table
 */
export type Brand = {
  version_id: number;
  country: string;
  website: string;
  created_at: Date;
};

/**
 * A column in the sets table
 */
export type Set = {
  version_id: number;
  pieces: number;
  issued: string;
  theme: string;
  size: string;
  manufacturer_id: string;
  brand_id: number;
  created_at: Date;
};

/**
 * A column in the images table
 */
export type Image = {
  id: number;
  filename: string;
  original_filename: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  width: number;
  height: number;
  uploaded_by: number;
  entity_id: number | null;
  version_id: number | null;
  s3_bucket: string | null;
  s3_key: string | null;
  storage_type: "local" | "s3";
  alt_text: string | null;
  created_at: Date;
  updated_at: Date;
};

/**
 * Possible types of entities
 */
export type DataEntityType = "set" | "brand";
export type RawEntityType = "wiki";
export type EntityType = DataEntityType | RawEntityType;

/**
 * Conjuction of all possible views for each entity type
 */
export type EntityViewType<T extends EntityType> = T extends "set"
  ? SetView
  : T extends "brand"
    ? BrandView
    : WikiView;

export type EntityVersionView = {
  id: string;
  version_id: number;
  type: EntityType;
  name: string;
  description: string;
  previous_version: number;
  change_message: string;
  review_status: ReviewStatus;
  reviewed_at: Date;
  reviewed_by: number;
  review_comment: string;
  created_at: Date;
  version_number: string;
  version_created_at: string;
  created_by: string;
};

/**
 * A column returned by the set_view view which joins entities, entity_versions, and sets
 */
export type SetView = {
  pieces: number;
  issued: string;
  theme: string;
  size: string;
  manufacturer_id: string;
  brand_id: string;
} & EntityVersionView;

/**
 * A column returned by the brand_view view which joins entities, entity_versions, and brands
 */
export type BrandView = {
  country: string;
  website: string;
} & EntityVersionView;

/**
 * A column returned by the wiki_view view which joins entities, entity_versions
 */
export type WikiView = EntityVersionView;

// Database connection
export const sql = postgres(process.env.DB_CONN ?? "");

// Initialize database
export const initDatabase = async () => {
  await sql`
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

CREATE INDEX IF NOT EXISTS idx_image_version ON images(version_id);
CREATE INDEX IF NOT EXISTS idx_image_storage ON images(storage_type, s3_bucket, s3_key);
CREATE INDEX IF NOT EXISTS idx_image_uploader ON images(uploaded_by);

CREATE TABLE IF NOT EXISTS entities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE,
    head_version_id INT,
    type VARCHAR(64) CHECK (type IN ('set', 'brand', 'brick', 'wiki')),
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

    -- Informations about changes in this version by the author
    change_message TEXT DEFAULT '',

    review_status VARCHAR(32) DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
    reviewed_at TIMESTAMP,
    reviewed_by INT REFERENCES users(id) ON DELETE SET NULL,
    review_comment TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_version ON entity_versions(entity_id, version_number, review_status);

-- Add the foreign key constraint for head_version_id after entity_versions exists
-- ALTER TABLE entities
-- ADD CONSTRAINT fk_head_version
-- FOREIGN KEY (head_version_id)
-- REFERENCES entity_versions(id)
-- ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS brands (
    version_id INT PRIMARY KEY REFERENCES entity_versions(id) ON DELETE CASCADE,
    country VARCHAR(255),
    website VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sets (
    version_id INT PRIMARY KEY REFERENCES entity_versions(id) ON DELETE CASCADE,
    pieces INTEGER,
    issued VARCHAR(64),
    theme VARCHAR(64),
    size VARCHAR(64),
    manufacturer_id VARCHAR(64),
    brand_id INT REFERENCES entities(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_set ON sets(brand_id, issued);

CREATE OR REPLACE VIEW set_versions_view AS
SELECT
    v.id AS version_id,
    e.id AS id,
    e.name AS name,
    e.type AS type,
    e.created_at AS created_at,
    v.version_number AS version_number,
    v.created_at AS version_created_at,
    v.created_by AS created_by,
    v.description AS description,
    v.previous_version as previous_version,
    v.change_message as change_message,
    v.review_status as review_status,
    v.reviewed_at as reviewed_at,
    v.reviewed_by as reviewed_by,
    v.review_comment as review_comment,
    v.image_id as image_id,
    s.pieces AS pieces,
    s.issued AS issued,
    s.theme AS theme,
    s.size AS size,
    s.manufacturer_id AS manufacturer_id,
    s.brand_id AS brand_id
FROM entity_versions v
JOIN entities e ON v.entity_id = e.id
JOIN sets s ON v.id = s.version_id
WHERE e.type = 'set';

CREATE OR REPLACE VIEW brand_versions_view AS
SELECT
    v.id AS version_id,
    e.id AS id,
    e.name AS name,
    e.type AS type,
    e.created_at AS created_at,
    v.version_number AS version_number,
    v.created_at AS version_created_at,
    v.created_by AS created_by,
    v.description AS description,
    v.previous_version as previous_version,
    v.change_message as change_message,
    v.review_status as review_status,
    v.reviewed_at as reviewed_at,
    v.reviewed_by as reviewed_by,
    v.review_comment as review_comment,
    v.image_id as image_id,
    b.country AS country,
    b.website AS website
FROM entity_versions v
JOIN entities e ON v.entity_id = e.id
JOIN brands b ON v.id = b.version_id
WHERE e.type = 'brand';

CREATE OR REPLACE VIEW wiki_versions_view AS
SELECT
    v.id AS version_id,
    e.id AS id,
    e.name AS name,
    e.type AS type,
    e.created_at AS created_at,
    v.version_number AS version_number,
    v.created_at AS version_created_at,
    v.created_by AS created_by,
    v.description AS description,
    v.previous_version as previous_version,
    v.change_message as change_message,
    v.review_status as review_status,
    v.reviewed_at as reviewed_at,
    v.reviewed_by as reviewed_by,
    v.review_comment as review_comment,
    v.image_id as image_id
FROM entity_versions v
JOIN entities e ON v.entity_id = e.id
WHERE e.type = 'wiki';

CREATE OR REPLACE VIEW set_view AS
SELECT v.*
FROM entities e
JOIN set_versions_view v ON v.version_id = e.head_version_id;

CREATE OR REPLACE VIEW brand_view AS
SELECT v.*
FROM entities e
JOIN brand_versions_view v ON v.version_id = e.head_version_id;

CREATE OR REPLACE VIEW wiki_view AS
SELECT v.*
FROM entities e
JOIN wiki_versions_view v ON v.version_id = e.head_version_id;
`.simple();
};
