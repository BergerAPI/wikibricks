import "dotenv/config"
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { Layout } from './layout'
import { initDatabase } from './database';

(async () => {
    const app = new Hono()

    await initDatabase();

    app.get('/', (c) => {
        return c.render(
            <Layout>
                <main>
                    <h1 class="text-3xl font-serif pb-2 mb-3 border-b">Wikibricks</h1>

                    <p class="font-bold">Welcome to Wikibricks!</p>

                    <p class="text-pretty">
                        Discover a world of creativity and engineering with Brick Wiki, the ultimate resource for toy brick enthusiasts.
                        Whether you're a seasoned builder or a curious newcomer, we've got everything you need to explore the
                        fascinating universe of toy bricks.
                    </p>

                    <ul class="mt-2">
                        <li>
                            <span class="font-semibold">Browse Sets: </span>
                            Explore detailed information on iconic sets from your favorite brands.
                        </li>
                        <li>
                            <span class="font-semibold">Learn About Brands: </span>
                            Dive into the history and legacy of major brands like LEGO, BlueBrixx, and more.
                        </li>
                        <li>
                            <span class="font-semibold">Explore Bricks: </span>
                            Discover unique brick types, their uses, and how they bring your creations to life.
                        </li>
                    </ul>

                    <section id="sets" class="mt-8">
                        <div class="pb-2 mb-3 border-b flex items-center gap-4">
                            <h2 class="text-2xl font-serif">Latest Sets</h2>
                            <a class="text-sm" href="/sets">See all</a>
                        </div>
                        <ul>
                            <li>Test</li>
                        </ul>
                    </section>

                    <section id="brands" class="mt-8">
                        <div class="pb-2 mb-3 border-b flex items-center gap-4">
                            <h2 class="text-2xl font-serif">Brands</h2>
                            <a class="text-sm" href="/brands">See all</a>
                        </div>
                        <ul>
                            <li>Test</li>
                        </ul>
                    </section>
                </main>
            </Layout>
        )
    })

    const port = 3000

    console.log(`Server is running on http://localhost:${port}`)

    serve({
        fetch: app.fetch,
        port
    })
})().then(() => {
    /* Do nothing */
});

