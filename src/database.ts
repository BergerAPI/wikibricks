import postgres from 'postgres'

/**
 * Represents a user in the system
 */
export type User = {
  id: number;
  username: string;
  password: string;
  permission_level: number;
  created_at: string;
};

// Database connection
export const sql = postgres(process.env.DB_CONN ?? "");

// Initialize database
export const initDatabase = async () => {
  await sql`
  create table if not exists t_user(
    id serial primary key,
    username varchar(255) unique,
    password varchar(255),
    permission_level integer default 0,
    created_at timestamp default current_timestamp
  );

  create index if not exists idx_user on t_user(username);

  create table if not exists t_brand(
    id serial primary key,
    name varchar(255) unique,
    description text,
    country varchar(255),
    website varchar(255),
    created_at timestamp default current_timestamp
  );

  create index if not exists idx_brand on t_brand(name);

  create table if not exists t_set(
      id serial primary key,
      name varchar(255),
      description text,
      pieces integer,
      issued varchar(64),
      theme varchar(64),
      size varchar(64),
      manufacturer_id varchar(64),
      brand_id integer references t_brand(id) on delete cascade,
      created_at timestamp default current_timestamp
  );

  create index if not exists idx_set on t_set(name, brand_id, issued);

  create table if not exists t_set_change(
      id serial primary key,
      set_id integer references t_set(id) on delete cascade,
      user_id integer references t_user(id) on delete cascade,
      status varchar(64),
      old_value jsonb,
      new_value jsonb,
      created_at timestamp default current_timestamp
  );

  create index if not exists idx_set_change on t_set_change(set_id, user_id, created_at);
    `.simple();
};