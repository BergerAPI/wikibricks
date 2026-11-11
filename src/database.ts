import postgres from "postgres";

/**
 * A row of the users table
 */
export type User = {
  id: number;
  username: string;
  password: string;
  permission_level: number;
  created_at: Date;
};

/**
 * A row of the images table
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

// `infer` keeps the v3 parameter typing for Dates, booleans, and arrays.
// Notices are only Postgres saying things like "already exists, skipping" during setup.
export const sql = postgres(process.env.DB_CONN ?? "", { infer: true, onnotice: () => {} });

