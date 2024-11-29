create table if not exists t_brand(
    id serial primary key,
    name varchar(255),
    description text
);

create table if not exists t_set(
    id serial primary key,
    name varchar(255),
    description text,
    pieces integer,
    brand_id integer references t_brand(id) on delete cascade
);