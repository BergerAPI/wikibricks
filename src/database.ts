import postgres from 'postgres'

/**
 * Represents a user in the database
 */
export type User = {
  id: number;
  username: string;
  password: string;
  permission_level: number;
  created_at: string;
};


/**
 * Represents a change of a set in the database
 */
export type SetVersion = {
  version_id: string
  set_id: string
  edited_by: string
  approved_by: string
  approved_at: string
  approval_status: string
  change_message: string
  previous_version: string
  value: string
  created_at: string
};

/**
 * Represents a set in the database
 */
export type Set = {
  id: number
  name: string
  brand_name: string
  brand_id: number
  pieces: number
  manufacturer_id: string
  issued: string
}

// Database connection
export const sql = postgres(process.env.DB_CONN ?? "");

// Initialize database
export const initDatabase = async () => {
  await sql`
  create table if not exists users(
    id serial primary key,
    username varchar(255) unique,
    password varchar(255),
    permission_level integer default 0,
    created_at timestamp default current_timestamp
  );

  create index if not exists idx_user on users(username);

  create table if not exists brands(
    id serial primary key,
    name varchar(255) unique,
    description text,
    country varchar(255),
    website varchar(255),
    created_at timestamp default current_timestamp
  );

  create index if not exists idx_brand on brands(name);

  create table if not exists sets(
      id serial primary key,
      name varchar(255),
      description text,
      pieces integer,
      issued varchar(64),
      theme varchar(64),
      size varchar(64),
      manufacturer_id varchar(64),
      brand_id integer references brands(id) on delete cascade,
      created_at timestamp default current_timestamp
  );

  create index if not exists idx_set on sets(name, brand_id, issued);

  create table if not exists set_versions(
      version_id serial primary key,
      set_id integer references sets(id) on delete cascade,
      edited_by integer references users(id) on delete set null,
      approved_by integer references users(id) on delete set null,
      approved_at timestamp,
      approval_status varchar(64),
      change_message text,
      previous_version integer references set_versions(version_id) on delete set null,
      value jsonb,
      created_at timestamp default current_timestamp
  );

  create index if not exists idx_set_change on set_versions(set_id, edited_by, created_at);
    `.simple();
};