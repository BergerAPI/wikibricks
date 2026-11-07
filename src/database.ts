import postgres from "postgres";
import type { EntityType } from "./entity-types";

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
  version_number: number;
  created_at: Date;
  created_by: number | null;
  description: string;
  change_message: string;
  previous_version: number | null;
  review_status: ReviewStatus;
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
  s3_bucket: string | null;
  s3_key: string | null;
  storage_type: "local" | "s3";
  alt_text: string | null;
  created_at: Date;
  updated_at: Date;
};

export type EntityVersionView = {
  id: number;
  version_id: number;
  type: EntityType;
  name: string;
  image_id: number | null;
  description: string;
  previous_version: number | null;
  change_message: string;
  review_status: ReviewStatus;
  reviewed_at: Date | null;
  reviewed_by: number | null;
  review_comment: string;
  created_at: Date;
  version_number: number;
  version_created_at: Date;
  created_by: number | null;
};

/**
 * A row returned by a <type>_view or <type>_versions_view view.
 * The type-specific columns are described by the fields in src/entity-types.ts.
 */
export type EntityView = EntityVersionView & { [field: string]: unknown };

// `infer` keeps the v3 parameter typing for Dates, booleans, and arrays.
// Notices are only Postgres saying things like "already exists, skipping" during setup.
export const sql = postgres(process.env.DB_CONN ?? "", { infer: true, onnotice: () => {} });

// Either the pool or a transaction.
export type Queryable = postgres.ISql;

