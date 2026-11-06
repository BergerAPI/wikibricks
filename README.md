```
npm install
npm run dev
```

```
open http://localhost:3000
```

Run `npm run dev:css` or `npm run dev:client` in a separate terminal to watch
stylesheet or browser TypeScript changes. The browser scripts in
`src/client/pages/` are loaded only by the pages that use them.

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
