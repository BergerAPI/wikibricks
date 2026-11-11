# WikiBricks

Requires Node.js 26+. Production also needs PostgreSQL.

```sh
npm install
npm run dev
```

Open http://localhost:3000. This starts a local database with sample data, the
server and the client build. Local users `admin`, `moderator`, and `alice` use the
password `password`. Data stays in `.pglite/`; `npm run dev -- --reset` recreates it.

Settings live in one `.env` file, see `.env.example`. None are needed for
development. Set `DB_CONN` there to use an existing database instead of the local one.

```sh
npm test       # tests
npm run build  # typecheck and production build
npm start      # run the production build
```

For production, set `NODE_ENV=production`, `DB_CONN`, and a unique `JWT_SECRET`
of at least 32 characters.

Collections live in `src/collections.ts`. Migrations live in `src/migrations/`.

Components keep their markup, `script.ts`, and styles together under
`src/components/`. `data-include-script="components/select"` loads that component's
script through `src/client/site.ts`. Page scripts live in `src/client/pages/`.

`dependencies` contains server runtime packages; `devDependencies` contains build,
browser, and test packages. Build before installing production dependencies only.
