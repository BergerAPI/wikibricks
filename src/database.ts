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
  review_status: 'pending' | 'approved' | 'rejected';
};

/**
 * Possible types of entities
 */
export type EntityType = 'set' | 'brand' | 'wiki';

/**
 * Conjuction of all possible views for each entity type
 */
export type EntityViewType<T extends EntityType> = (T extends 'set' ? SetView : (T extends 'brand' ? BrandView : WikiView));

/**
 * A column returned by the set_view view which joins entities, entity_versions, and sets
 */
export type SetView = {
  id: string;
  name: string;
  type: EntityType;
  created_at: Date;
  version_number: string;
  version_created_at: Date;
  created_by: string;
  description: string;
  pieces: number;
  issued: string;
  theme: string;
  size: string;
  manufacturer_id: string;
  brand_id: string;
};

/**
 * A column returned by the brand_view view which joins entities, entity_versions, and brands
 */
export type BrandView = {
  id: string;
  type: EntityType;
  name: string;
  description: string;
  country: string;
  website: string;
  created_at: Date
  version_number: string
  version_created_at: string
  created_by: string
};

/**
 * A column returned by the wiki_view view which joins entities, entity_versions
 */
export type WikiView = {
  id: string;
  type: EntityType;
  name: string;
  description: string;
  created_at: Date
  version_number: string
  version_created_at: string
  created_by: string
};

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

    -- Informations about changes in this version by the author
    change_message TEXT DEFAULT '',

    review_status VARCHAR(32) DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
    reviewed_at TIMESTAMP,
    reviewed_by INT REFERENCES users(id) ON DELETE SET NULL,
    review_comment TEXT DEFAULT '',

    -- Ensure version number uniqueness for an entity
    UNIQUE (entity_id, version_number)
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

CREATE OR REPLACE VIEW set_view AS
SELECT
    e.id AS id,
    e.name AS name,
    e.type AS type,
    e.created_at AS created_at,
    v.version_number AS version_number,
    v.created_at AS version_created_at,
    v.created_by AS created_by,
    v.description AS description,
    s.pieces AS pieces,
    s.issued AS issued,
    s.theme AS theme,
    s.size AS size,
    s.manufacturer_id AS manufacturer_id,
    s.brand_id AS brand_id
FROM entities e
JOIN entity_versions v ON e.head_version_id = v.id
JOIN sets s ON v.id = s.version_id
WHERE e.type = 'set';

CREATE OR REPLACE VIEW brand_view AS
SELECT
    e.id AS id,
    e.name AS name,
    e.type AS type,
    e.created_at AS created_at,
    v.version_number AS version_number,
    v.created_at AS version_created_at,
    v.created_by AS created_by,
    v.description AS description,
    b.country AS country,
    b.website AS website
FROM entities e
JOIN entity_versions v ON v.id = e.head_version_id
JOIN brands b ON v.id = b.version_id
WHERE e.type = 'brand';

CREATE OR REPLACE VIEW wiki_view AS
SELECT
    e.id AS id,
    e.name AS name,
    e.type AS type,
    e.created_at AS created_at,
    v.version_number AS version_number,
    v.created_at AS version_created_at,
    v.created_by AS created_by,
    v.description AS description
FROM entities e
JOIN entity_versions v ON v.id = e.head_version_id
WHERE e.type = 'wiki';
    `.simple();
};
