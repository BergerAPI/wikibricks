```
npm install
npm run dev
```

```
open http://localhost:3000
```

`npm run dev` watches the server, Tailwind CSS, and browser TypeScript.
The browser scripts in `src/client/pages/` are loaded only by the pages
that use them. Press Ctrl-C to stop all three watchers.

To add a browser script, create `src/client/pages/example.ts` and use
`<Layout script="example" ...>` on the page that needs it. The build,
watcher, and deployment discover the file automatically.

## Local database

Without a Postgres server, run a local one backed by PGlite:

```
npm run db
DB_CONN="postgres://postgres:postgres@127.0.0.1:5433/postgres?max=1" npm run dev
```

The first run fills it with sample brands, sets, a wiki page and two proposals
waiting for review. The users `admin`, `moderator` and `alice` all have the
password `password`. Data is kept in `.pglite/`, `npm run db -- --reset` starts over.

## CMS

The content model and its review workflow live in two workspace packages, which
know nothing about wikibricks:

- `packages/cms`: collections, fields, validation, versions, reviews and queries,
  built on a database adapter interface
- `packages/cms-postgres`: the PostgreSQL adapter, with a table per collection,
  a column per field, tables for the items of arrays and blocks, and views

Fields can be text, numbers, booleans, dates, selects, relations, arrays and
blocks. Per collection, `title` names the field that names an entry, `review`
and `versions` turn approval and history on or off, and `singleton` allows only
one entry. `cms.find` filters and sorts entries by their fields:

```ts
cms.find({ type: "set", where: { pieces: { gt: 1000 } }, sort: "-updatedAt", limit: 10 });
```

`npm test` runs the CMS tests against an in-memory PGlite.

Wikibricks defines its entity types in `src/collections.ts`. A field's `meta`
holds how wikibricks presents it, like its label, and is ignored by the CMS. On
startup, the tables, columns and views are created from these definitions, so
adding a type or a field needs no database work.

Changes to existing data, like renaming or removing a field, need a migration.
Add a numbered file to `src/migrations/` and list it in `src/migrations/index.ts`.
Each migration runs once, in order, and the server refuses to start if one fails.

# TODO

## Active

- [x] Unify Entity Pages
- [x] Change History Page
- [x] User Page
- [x] Improve safety of pages (Internal Server Errors)
- [x] Error pages (Not Found, Internal Server Error, ...)
- [ ] Account Settings
- [x] View specific versions of entities
- [x] Cleanup code (More comments, structure)
- [x] Entity change page
- [x] Entity add page
- [ ] Tags
- [x] Error Handling
- [ ] Admin Tools
  - [ ] Ban users
  - [ ] Force create pages
  - [ ] Modify users
- [x] Bcrypt for Passwords
- [x] Deploy to VPS
- [ ] CI/CD
  - [ ] View commit on production build
  - [ ] Maybe add staging
- [x] TypeScript build for page-specific browser scripts

## Future

- [ ] Rework database structure
