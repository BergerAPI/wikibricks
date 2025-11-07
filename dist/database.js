"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDatabase = exports.sql = void 0;
const postgres_1 = __importDefault(require("postgres"));
// Database connection
exports.sql = (0, postgres_1.default)((_a = process.env.DB_CONN) !== null && _a !== void 0 ? _a : "");
// Initialize database
const initDatabase = () => __awaiter(void 0, void 0, void 0, function* () {
    yield (0, exports.sql) `
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
    v.review_comment as review_comment
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
});
exports.initDatabase = initDatabase;
