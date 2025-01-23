import "dotenv/config"
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { initDatabase } from './database';
import { handler } from "./routes/root";

(async () => {
    const app = new Hono()

    await initDatabase();

    app.get('/', handler)

    const port = 3000

    console.log(`Server is running on http://localhost:${port}`)

    serve({
        fetch: app.fetch,
        port
    })
})().then(() => {
    /* Do nothing */
});

