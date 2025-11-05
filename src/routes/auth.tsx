import { type Context } from "hono";
import { Layout } from "../layout";
import { deleteCookie, setCookie } from "hono/cookie";
import { sql, type User } from "../database";
import { signUser, type DefaultContext, PermissionLevel } from "../utils";

const CredentialsForm = ({ error }: { error?: string }) => {
  return (
    <form method="post" class="px-4 py-3 max-w-lg">
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
  );
};

const RegisterForm = ({ error }: { error?: string }) => {
  return (
    <form method="post" class="px-4 py-3 max-w-lg">
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
          minlength={3}
          maxlength={255}
        />
        <p class="text-sm text-gray-500 mt-1">
          Username must be between 3-255 characters
        </p>
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
          minlength={6}
        />
        <p class="text-sm text-gray-500 mt-1">
          Password must be at least 6 characters
        </p>
      </div>
      <div class="mb-6">
        <label htmlFor="confirmPassword" class="block mb-1 font-medium">
          Confirm Password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
          required
          minlength={6}
        />
      </div>
      <button
        type="submit"
        class="px-4 py-2 text-white bg-green-600 rounded hover:bg-green-700 focus:outline-none"
      >
        Create Account
      </button>
    </form>
  );
};

export const handleLoginPage = async (c: DefaultContext) => {
  const user = c.get("user");

  if (user) return c.redirect("/");

  return c.render(
    <Layout user={user}>
      <main>
        <h1 class="text-3xl font-serif pb-2 mb-3 border-b">Login</h1>
        <CredentialsForm />
        <div class="px-4 py-3 max-w-lg">
          <p class="text-gray-600">
            Don't have an account?{" "}
            <a
              href="/register"
              class="text-blue-600 hover:text-blue-800 underline"
            >
              Create one here
            </a>
          </p>
        </div>
      </main>
    </Layout>,
  );
};

export const handleRegisterPage = async (c: DefaultContext) => {
  const user = c.get("user");

  if (user) return c.redirect("/");

  return c.render(
    <Layout user={user}>
      <main>
        <h1 class="text-3xl font-serif pb-2 mb-3 border-b">Create Account</h1>
        <RegisterForm />
        <div class="px-4 py-3 max-w-lg">
          <p class="text-gray-600">
            Already have an account?{" "}
            <a
              href="/login"
              class="text-blue-600 hover:text-blue-800 underline"
            >
              Log in here
            </a>
          </p>
        </div>
      </main>
    </Layout>,
  );
};

export const handleRegisterSubmit = async (c: Context) => {
  const { username, password, confirmPassword } = await c.req.parseBody();

  // Validation
  if (!username || !password || !confirmPassword) {
    return c.render(
      <Layout>
        <main>
          <h1 class="text-3xl font-serif pb-2 mb-3 border-b">Create Account</h1>
          <RegisterForm error="All fields are required" />
          <div class="px-4 py-3 max-w-lg">
            <p class="text-gray-600">
              Already have an account?{" "}
              <a
                href="/login"
                class="text-blue-600 hover:text-blue-800 underline"
              >
                Log in here
              </a>
            </p>
          </div>
        </main>
      </Layout>,
    );
  }

  const usernameStr = username.toString().trim();
  const passwordStr = password.toString();
  const confirmPasswordStr = confirmPassword.toString();

  // Check username length
  if (usernameStr.length < 3 || usernameStr.length > 255) {
    return c.render(
      <Layout>
        <main>
          <h1 class="text-3xl font-serif pb-2 mb-3 border-b">Create Account</h1>
          <RegisterForm error="Username must be between 3-255 characters" />
          <div class="px-4 py-3 max-w-lg">
            <p class="text-gray-600">
              Already have an account?{" "}
              <a
                href="/login"
                class="text-blue-600 hover:text-blue-800 underline"
              >
                Log in here
              </a>
            </p>
          </div>
        </main>
      </Layout>,
    );
  }

  // Check password length
  if (passwordStr.length < 6) {
    return c.render(
      <Layout>
        <main>
          <h1 class="text-3xl font-serif pb-2 mb-3 border-b">Create Account</h1>
          <RegisterForm error="Password must be at least 6 characters" />
          <div class="px-4 py-3 max-w-lg">
            <p class="text-gray-600">
              Already have an account?{" "}
              <a
                href="/login"
                class="text-blue-600 hover:text-blue-800 underline"
              >
                Log in here
              </a>
            </p>
          </div>
        </main>
      </Layout>,
    );
  }

  // Check password confirmation
  if (passwordStr !== confirmPasswordStr) {
    return c.render(
      <Layout>
        <main>
          <h1 class="text-3xl font-serif pb-2 mb-3 border-b">Create Account</h1>
          <RegisterForm error="Passwords do not match" />
          <div class="px-4 py-3 max-w-lg">
            <p class="text-gray-600">
              Already have an account?{" "}
              <a
                href="/login"
                class="text-blue-600 hover:text-blue-800 underline"
              >
                Log in here
              </a>
            </p>
          </div>
        </main>
      </Layout>,
    );
  }

  try {
    // Check if username already exists
    const [existingUser] = await sql<User[]>`
            SELECT id FROM users WHERE username = ${usernameStr} LIMIT 1
        `;

    if (existingUser) {
      return c.render(
        <Layout>
          <main>
            <h1 class="text-3xl font-serif pb-2 mb-3 border-b">
              Create Account
            </h1>
            <RegisterForm error="Username already exists" />
            <div class="px-4 py-3 max-w-lg">
              <p class="text-gray-600">
                Already have an account?{" "}
                <a
                  href="/login"
                  class="text-blue-600 hover:text-blue-800 underline"
                >
                  Log in here
                </a>
              </p>
            </div>
          </main>
        </Layout>,
      );
    }

    // Create new user
    const [newUser] = await sql<User[]>`
            INSERT INTO users (username, password, permission_level)
            VALUES (${usernameStr}, ${passwordStr}, ${PermissionLevel.USER})
            RETURNING *
        `;

    // Sign the user in automatically
    const token = await signUser(newUser);
    setCookie(c, "auth", token, {
      httpOnly: true,
      sameSite: "Strict",
    });

    // Redirect to home page
    return c.redirect("/");
  } catch (error) {
    console.error("Registration error:", error);
    return c.render(
      <Layout>
        <main>
          <h1 class="text-3xl font-serif pb-2 mb-3 border-b">Create Account</h1>
          <RegisterForm error="An error occurred while creating your account. Please try again." />
          <div class="px-4 py-3 max-w-lg">
            <p class="text-gray-600">
              Already have an account?{" "}
              <a
                href="/login"
                class="text-blue-600 hover:text-blue-800 underline"
              >
                Log in here
              </a>
            </p>
          </div>
        </main>
      </Layout>,
    );
  }
};

export const handleLoginSubmit = async (c: Context) => {
  const { username, password } = await c.req.parseBody();

  if (!username || !password) {
    return c.render(
      <Layout>
        <main>
          <h1 class="text-3xl font-serif pb-2 mb-3 border-b">Login</h1>
          <CredentialsForm error="Username and password are required" />
        </main>
      </Layout>,
    );
  }

  const [user] = await sql<
    User[]
  >`SELECT password, id FROM users WHERE username = ${username.toString()} LIMIT 1;`;

  if (!user || user.password !== password) {
    return c.render(
      <Layout>
        <main>
          <h1 class="text-3xl font-serif pb-2 mb-3 border-b">Login</h1>
          <CredentialsForm error="Invalid username or password" />
        </main>
      </Layout>,
    );
  }

  const token = await signUser(user);
  setCookie(c, "auth", token, {
    httpOnly: true,
    sameSite: "Strict",
  });

  // Checking if there is a specific route to redirect to
  const redirect = c.req.query("redirect");

  return c.redirect(redirect ?? "/");
};

export const handleLogoutSubmit = async (c: Context) => {
  deleteCookie(c, "auth");
  return c.redirect("/");
};
