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
