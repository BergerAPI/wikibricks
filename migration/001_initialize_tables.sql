create table if not exists t_brand(
    id serial primary key,
    name varchar(255) unique,
    description text
);

create index if not exists idx_brand on t_brand(name);

create table if not exists t_set(
    id serial primary key,
    name varchar(255),
    description text,
    pieces integer,
    issued varchar(64),
    manufacturer_id varchar(64),
    brand_id integer references t_brand(id) on delete cascade
);

create index if not exists idx_set on t_set(name, brand_id, issued);

