import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { Layout } from './layout'

const app = new Hono()

app.get('/', (c) => {
    return c.render(
        <Layout>
            <div>
                <h1>Welcome to WikiBricks</h1>
                <p>This is a simple Hono route with JSX</p>
            </div>
        </Layout>
    )
})

const port = 3000
console.log(`Server is running on http://localhost:${port}`)

serve({
    fetch: app.fetch,
    port
})
