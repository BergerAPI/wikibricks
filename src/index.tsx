import "dotenv/config"
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { initDatabase } from './database';
import { handleRootPage } from "./routes/root";
import { attemptAuthentication, type Variables } from "./utils";
import { handleLoginPage, handleLoginSubmit } from "./routes/auth";
import { handleSetsPage } from "./routes/sets";
import { handleChangeSubmit, handleSetChangesPage } from "./routes/sets/changes";
import { handleNewSetPage, handleNewSetSubmit } from "./routes/sets/new-set";

(async () => {
    const app = new Hono<{ Variables: Variables }>()

    await initDatabase();

    app.use(attemptAuthentication)

    app.get('/', handleRootPage)

    // Auth routes
    app.get('/login', handleLoginPage)
    app.post('/login', handleLoginSubmit)

    // Set routes
    app.get('/sets', handleSetsPage)
    app.get('/sets/new', handleNewSetPage)
    app.post('/sets/new', handleNewSetSubmit)
    app.get("/sets/changes", handleSetChangesPage)
    app.post("/sets/changes/:id", handleChangeSubmit)

    const port = 3000

    console.log(`Server is running on http://localhost:${port}`)

    serve({
        fetch: app.fetch,
        port
    })
})().then(() => {
    /* Do nothing */
});

