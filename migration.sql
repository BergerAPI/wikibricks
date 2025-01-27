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
    description TEXT,
    type VARCHAR(64) CHECK (type IN ('set', 'brand', 'brick')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS entity_versions (
    id SERIAL PRIMARY KEY,
    entity_id INT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Ensure only one active version per entity
    UNIQUE (entity_id, is_active),
    -- Ensure version number uniqueness for an entity
    UNIQUE (entity_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_entity ON entities(name, type);

CREATE TABLE IF NOT EXISTS brands (
    version_id INT PRIMARY KEY REFERENCES entity_versions(id) ON DELETE CASCADE,
    country VARCHAR(255),
    website VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_brand ON brands(name);

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

CREATE INDEX IF NOT EXISTS idx_set ON sets(name, brand_id, issued);