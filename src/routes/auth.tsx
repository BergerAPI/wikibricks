import { type Context } from "hono";
import { Layout } from "../layout";
import { deleteCookie, setCookie } from "hono/cookie";
import { sql, type User } from "../database";
import {
  signUser,
  type DefaultContext,
  PermissionLevel,
  isRateLimited,
  isAdmin,
} from "../utils";
import { TranslationFunctions, Translations, useTranslation } from "../translation";
import bcrypt from "bcryptjs";
import { Child, JSX } from "hono/jsx";

const SALT_ROUNDS = 12;
// Constant-time dummy hash to mitigate user-enumeration via timing
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEe.Qx8F5P5P5P5P5P5P5P5P5P5P5P5P5u";

const isProduction = process.env.NODE_ENV === "production";

const cookieOptions = {
  httpOnly: true,
  sameSite: "Strict" as const,
  path: "/",
  secure: isProduction,
  maxAge: 7 * 24 * 60 * 60,
};

const isSafeRedirect = (target: string | undefined | null): target is string => {
  if (!target) return false;
  return (
    target.startsWith("/") && !target.startsWith("//") && !target.includes(":")
  );
};

const USERNAME_RE = /^[A-Za-z0-9._-]{3,32}$/;

async function hashPassword(password: string) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

/* Reusable UI bits */
const ErrorBox = ({ message }: { message?: string }) =>
  message ? (
    <div class="mb-4 p-3 border border-red-400 bg-red-50 text-red-700">
      {message}
    </div>
  ) : null;

const TextInput = ({
  id,
  name,
  label,
  type = "text",
  required = false,
  autoComplete,
  maxLength,
}: {
  id: string;
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  maxLength?: number;
}) => (
  <div class="mb-4">
    <label htmlFor={id} class="block mb-1 font-medium">
      {label}
    </label>
    <input
      id={id}
      name={name}
      type={type}
      class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
      required={required}
      autocomplete={autoComplete}
      maxlength={maxLength}
    />
  </div>
);

const ActionButton = ({
  label,
  color = "blue",
}: {
  label: any;
  color?: "blue" | "green";
}) => {
  const bg =
    color === "green"
      ? "bg-green-600 hover:bg-green-700"
      : "bg-blue-600 hover:bg-blue-700";
  return (
    <button
      type="submit"
      class={`px-4 py-2 text-white ${bg} rounded focus:outline-none`}
    >
      {label}
    </button>
  );
};

/* Forms (simplified registration form as requested) */
const CredentialsForm = ({
  error,
  t,
}: {
  error?: string;
  t: TranslationFunctions["t"];
}) => {
  return (
    <form method="post" action="/login" class="px-4 py-3 max-w-lg">
      <ErrorBox message={error} />
      <TextInput id="username" name="username" label={t("auth.username")} required autoComplete="username" maxLength={32} />
      <TextInput id="password" name="password" label={t("auth.password")} type="password" required autoComplete="current-password" maxLength={128} />
      <ActionButton label={t("auth.loginButton")} />
    </form>
  );
};

const RegisterForm = ({
  error,
  t,
}: {
  error?: string;
  t: TranslationFunctions["t"];
}) => {
  // Simplified: only username, password, confirmPassword, minimal markup (no extra hints)
  return (
    <form method="post" action="/register" class="px-4 py-3 max-w-lg">
      <ErrorBox message={error} />
      <TextInput id="username" name="username" label={t("auth.username")} required autoComplete="username" maxLength={32} />
      <TextInput id="password" name="password" label={t("auth.password")} type="password" required autoComplete="new-password" maxLength={128} />
      <TextInput id="confirmPassword" name="confirmPassword" label={t("auth.confirmPassword")} type="password" required autoComplete="new-password" maxLength={128} />
      <ActionButton label={t("auth.createAccount")} color="green" />
    </form>
  );
};

/* Small helper to render auth pages and avoid duplication */
function renderAuthPage(
  c: DefaultContext | Context,
  opts: {
    titleKey: keyof Translations;
    user?: User | null;
    form: Child;
    bottom?: Child;
  },
) {
  const { titleKey, user, form, bottom } = opts;
  const { t } = useTranslation(c);
  return c.render(
    <Layout context={c} user={user}>
      <main>
        <h1 class="text-3xl font-serif pb-2 mb-3 border-b">{t(titleKey)}</h1>
        {form}
        {bottom}
      </main>
    </Layout>,
  );
}

/* Page handlers */
export const handleLoginPage = async (c: DefaultContext) => {
  const user = c.get("user");
  const { t } = useTranslation(c);

  if (user) return c.redirect("/");

  const bottom = (
    <div class="px-4 py-3 max-w-lg">
      <p class="text-gray-600">
        {t("auth.dontHaveAccount")}{" "}
        <a href="/register" class="text-blue-600 hover:text-blue-800 underline">
          {t("auth.createOneHere")}
        </a>
      </p>
    </div>
  );

  return renderAuthPage(c, {
    titleKey: "auth.login",
    user: null,
    form: <CredentialsForm t={t} />,
    bottom,
  });
};

export const handleRegisterPage = async (c: DefaultContext) => {
  const user = c.get("user");
  const { t } = useTranslation(c);

  if (user) return c.redirect("/");

  const bottom = (
    <div class="px-4 py-3 max-w-lg">
      <p class="text-gray-600">
        {t("auth.alreadyHaveAccount")}{" "}
        <a href="/login" class="text-blue-600 hover:text-blue-800 underline">
          {t("auth.logInHere")}
        </a>
      </p>
    </div>
  );

  return renderAuthPage(c, {
    titleKey: "auth.register",
    user: null,
    form: <RegisterForm t={t} />,
    bottom,
  });
};

/* Submission handlers */
export const handleRegisterSubmit = async (c: Context) => {
  const currentUser = (c as { get?: (key: string) => unknown }).get?.(
    "user",
  ) as User | null | undefined;
  const ip = c.req.header("x-forwarded-for") ?? "unknown";
  if (!isAdmin(currentUser) && isRateLimited(`register:${ip}`, 10, 60 * 60 * 1000)) {
    return c.text("Too many requests", 429);
  }
  const { username, password, confirmPassword } = await c.req.parseBody();
  const { t } = useTranslation(c);

  // Basic validation (keep server-side checks even if the form is simpler)
  if (!username || !password || !confirmPassword) {
    return renderAuthPage(c, {
      titleKey: "auth.register",
      form: <RegisterForm t={t} error={t("error.allFieldsRequired")} />,
      user: null,
      bottom: (
        <div class="px-4 py-3 max-w-lg">
          <p class="text-gray-600">
            {t("auth.alreadyHaveAccount")}{" "}
            <a href="/login" class="text-blue-600 hover:text-blue-800 underline">
              {t("auth.logInHere")}
            </a>
          </p>
        </div>
      ),
    });
  }

  const usernameStr =
    typeof username === "string" ? username.trim() : String(username).trim();
  const passwordStr = typeof password === "string" ? password : String(password);
  const confirmPasswordStr =
    typeof confirmPassword === "string"
      ? confirmPassword
      : String(confirmPassword);

  if (!USERNAME_RE.test(usernameStr)) {
    return renderAuthPage(c, {
      titleKey: "auth.register",
      form: <RegisterForm t={t} error={t("error.usernameLength")} />,
      user: null,
      bottom: (
        <div class="px-4 py-3 max-w-lg">
          <p class="text-gray-600">
            {t("auth.alreadyHaveAccount")}{" "}
            <a href="/login" class="text-blue-600 hover:text-blue-800 underline">
              {t("auth.logInHere")}
            </a>
          </p>
        </div>
      ),
    });
  }

  if (
    passwordStr.length < 8 ||
    passwordStr.length > 128 ||
    Buffer.byteLength(passwordStr, "utf8") > 72
  ) {
    return renderAuthPage(c, {
      titleKey: "auth.register",
      form: <RegisterForm t={t} error={t("error.passwordLength")} />,
      user: null,
      bottom: (
        <div class="px-4 py-3 max-w-lg">
          <p class="text-gray-600">
            {t("auth.alreadyHaveAccount")}{" "}
            <a href="/login" class="text-blue-600 hover:text-blue-800 underline">
              {t("auth.logInHere")}
            </a>
          </p>
        </div>
      ),
    });
  }

  if (passwordStr !== confirmPasswordStr) {
    return renderAuthPage(c, {
      titleKey: "auth.register",
      form: <RegisterForm t={t} error={t("error.passwordsDoNotMatch")} />,
      user: null,
      bottom: (
        <div class="px-4 py-3 max-w-lg">
          <p class="text-gray-600">
            {t("auth.alreadyHaveAccount")}{" "}
            <a href="/login" class="text-blue-600 hover:text-blue-800 underline">
              {t("auth.logInHere")}
            </a>
          </p>
        </div>
      ),
    });
  }

  try {
    const [existingUser] = await sql<User[]>`
      SELECT id FROM users WHERE username = ${usernameStr} LIMIT 1
    `;

    if (existingUser) {
      return renderAuthPage(c, {
        titleKey: "auth.register",
        form: <RegisterForm t={t} error={t("error.usernameExists")} />,
        user: null,
        bottom: (
          <div class="px-4 py-3 max-w-lg">
            <p class="text-gray-600">
              {t("auth.alreadyHaveAccount")}{" "}
              <a href="/login" class="text-blue-600 hover:text-blue-800 underline">
                {t("auth.logInHere")}
              </a>
            </p>
          </div>
        ),
      });
    }

    // Hash the password with bcrypt
    const hashedPassword = await hashPassword(passwordStr);

    const [newUser] = await sql<User[]>`
      INSERT INTO users (username, password, permission_level)
      VALUES (${usernameStr}, ${hashedPassword}, ${PermissionLevel.USER})
      RETURNING *
    `;

    const token = await signUser(newUser);
    setCookie(c, "auth", token, cookieOptions);

    return c.redirect("/");
  } catch (error) {
    console.error("Registration error:", error);
    // Unique violation (23505) means the username was taken in a race
    const isUnique =
      typeof error === "object" &&
      error !== null &&
      (error as { code?: string }).code === "23505";
    return renderAuthPage(c, {
      titleKey: "auth.register",
      form: (
        <RegisterForm
          t={t}
          error={t(
            isUnique ? "error.usernameExists" : "error.accountCreationError",
          )}
        />
      ),
      user: null,
      bottom: (
        <div class="px-4 py-3 max-w-lg">
          <p class="text-gray-600">
            {t("auth.alreadyHaveAccount")}{" "}
            <a href="/login" class="text-blue-600 hover:text-blue-800 underline">
              {t("auth.logInHere")}
            </a>
          </p>
        </div>
      ),
    });
  }
};

export const handleLoginSubmit = async (c: Context) => {
  const currentUser = (c as { get?: (key: string) => unknown }).get?.(
    "user",
  ) as User | null | undefined;
  const ip = c.req.header("x-forwarded-for") ?? "unknown";
  if (!isAdmin(currentUser) && isRateLimited(`login:${ip}`, 20, 10 * 60 * 1000)) {
    return c.text("Too many requests", 429);
  }
  const { username, password } = await c.req.parseBody();
  const { t } = useTranslation(c);

  if (!username || !password) {
    return renderAuthPage(c, {
      titleKey: "auth.login",
      form: <CredentialsForm t={t} error={t("error.usernamePasswordRequired")} />,
      user: c.get("user") as User | null | undefined,
    });
  }

  const usernameStr =
    typeof username === "string" ? username.trim() : String(username).trim();
  const passwordStr =
    typeof password === "string" ? password : String(password);

  if (
    usernameStr.length === 0 ||
    usernameStr.length > 64 ||
    passwordStr.length > 128
  ) {
    return renderAuthPage(c, {
      titleKey: "auth.login",
      form: <CredentialsForm t={t} error={t("error.invalidCredentials")} />,
      user: null,
    });
  }

  const [user] = await sql<User[]>`
    SELECT * FROM users WHERE username = ${usernameStr} LIMIT 1;
  `;

  if (!user) {
    await verifyPassword(passwordStr, DUMMY_HASH).catch(() => false);
    return renderAuthPage(c, {
      titleKey: "auth.login",
      form: <CredentialsForm t={t} error={t("error.invalidCredentials")} />,
      user: null,
    });
  }

  const isValid = await verifyPassword(passwordStr, user.password);
  if (!isValid) {
    return renderAuthPage(c, {
      titleKey: "auth.login",
      form: <CredentialsForm t={t} error={t("error.invalidCredentials")} />,
      user: null,
    });
  }

  const token = await signUser(user);
  setCookie(c, "auth", token, cookieOptions);

  const redirect = c.req.query("redirect");
  return c.redirect(isSafeRedirect(redirect) ? redirect : "/");
};

export const handleLogoutSubmit = async (c: Context) => {
  deleteCookie(c, "auth", { path: "/" });
  return c.redirect("/");
};