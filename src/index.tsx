import "dotenv/config"
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { initDatabase } from './database';
import { handleRootPage } from "./routes/root";
import { attemptAuthentication, type Variables } from "./utils";
import { handleLoginPage, handleLoginSubmit } from "./routes/auth";

(async () => {
    const app = new Hono<{ Variables: Variables }>()

    await initDatabase();

    app.use(attemptAuthentication)

    app.get('/', handleRootPage)
    app.get('/login', handleLoginPage)
    app.post('/login', handleLoginSubmit)

    const port = 3000

    console.log(`Server is running on http://localhost:${port}`)

    serve({
        fetch: app.fetch,
        port
    })
})().then(() => {
    /* Do nothing */
});

