import { type Context } from 'hono'
import { Layout } from '../layout'
import { setCookie } from 'hono/cookie'
import { sql, type User } from '../database'
import { signUser, type DefaultContext } from '../utils'

const CredentialsForm = ({ error }: { error?: string }) => {
    return <form method="post" class="px-4 py-3 max-w-lg">
        {error && (
            <div class="mb-4 p-3 border border-red-400 bg-red-50 text-red-700">
                {error}
            </div>
        )}

        <div class="mb-4">
            <label htmlFor="username" class="block mb-1 font-medium">
                Username
            </label>
            <input
                id="username"
                name="username"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                required
            />
        </div>
        <div class="mb-4">
            <label htmlFor="password" class="block mb-1 font-medium">
                Password
            </label>
            <input
                id="password"
                name="password"
                type="password"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                required
            />
        </div>
        <button
            type="submit"
            class="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 focus:outline-none"
        >
            Log in
        </button>
    </form>
}

export const handleLoginPage = async (c: DefaultContext) => {
    const user = c.get("user");

    if (user) return c.redirect("/");

    return c.render(
        <Layout user={user}>
            <main>
                <h1 class="text-3xl font-serif pb-2 mb-3 border-b">Login</h1>
                <CredentialsForm />
            </main>
        </Layout>
    )
}

export const handleLoginSubmit = async (c: Context) => {
    const { username, password } = await c.req.parseBody();

    if (!username || !password) {
        return c.render(
            <Layout>
                <main>
                    <h1 class="text-3xl font-serif pb-2 mb-3 border-b">Login</h1>
                    <CredentialsForm error="Username and password are required" />
                </main>
            </Layout>
        )
    }

    const [user] = await sql<User[]>`SELECT password, id FROM t_user WHERE username = ${username.toString()} LIMIT 1;`

    if (!user || user.password !== password) {
        return c.render(
            <Layout>
                <main>
                    <h1 class="text-3xl font-serif pb-2 mb-3 border-b">Login</h1>
                    <CredentialsForm error="Invalid username or password" />
                </main>
            </Layout>
        )
    }

    const token = await signUser(user);
    setCookie(c, "auth", token, {
        httpOnly: true,
        sameSite: "Strict",
    });

    return c.redirect('/')
}