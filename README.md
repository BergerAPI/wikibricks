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

## Entity types and migrations

Entity types and their fields are defined in `src/entity-types.ts`. On startup,
their tables, columns and views are created from these definitions, so adding a
type or a field needs no database work.

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
