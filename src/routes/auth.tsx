import type { HttpBindings } from "@hono/node-server";
import bcrypt from "bcryptjs";
import { deleteCookie, setCookie } from "hono/cookie";
import type { Child } from "hono/jsx";
import { isIP } from "node:net";
import { sql, type User } from "../database";
import { Layout } from "../layout";
import { parseLocalUrl } from "../local-url";
import { useTranslation, type Translations } from "../translation";
import { isAdmin, isRateLimited, PermissionLevel, signUser, type DefaultContext } from "../utils";

const SALT_ROUNDS = 12;
// Compared against when the username is unknown, so both cases take equally long
const DUMMY_HASH = "$2b$12$6eXafv3SS7lUSoTCPean4eEGsHZRcjHM0Hm/kcKopTu3dGovFymA2";
const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,32}$/;

const cookieOptions = {
  httpOnly: true,
  sameSite: "Strict" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60,
};

const getLoginRedirect = (c: DefaultContext) => {
  const url = parseLocalUrl(c.req.query("redirect"));
  return url && url.pathname + url.search + url.hash;
};

const normalizeAddress = (address?: string) =>
  address?.replace(/^::ffff:(?=\d+\.)/i, "").toLowerCase();

const trustedProxy = normalizeAddress(process.env.TRUSTED_PROXY_IP?.trim());

// The client address, taken from X-Forwarded-For only when the request comes through our proxy
const getClientAddress = (c: DefaultContext) => {
  const peer = normalizeAddress((c.env as HttpBindings | undefined)?.incoming?.socket.remoteAddress);
  if (peer && peer === trustedProxy) {
    const client = normalizeAddress(c.req.header("x-forwarded-for")?.split(",").pop()?.trim());
    if (client && isIP(client)) return client;
  }
  return peer ?? "unknown";
};

const formValue = (value: unknown) => (typeof value === "string" ? value : "");

const TextInput = ({
  name,
  label,
  type = "text",
  autoComplete,
  maxLength,
}: {
  name: string;
  label: string;
  type?: string;
  autoComplete: string;
  maxLength: number;
}) => (
  <div class="mb-4">
    <label htmlFor={name} class="block mb-1 font-medium">
      {label}
    </label>
    <input
      id={name}
      name={name}
      type={type}
      class="w-full px-3 py-2 border border-gray-300 rounded focus:border-blue-500"
      required
      autocomplete={autoComplete}
      maxlength={maxLength}
    />
  </div>
);

const AuthPage = ({
  c,
  title,
  action,
  error,
  footer,
  children,
}: {
  c: DefaultContext;
  title: keyof Translations;
  action: string;
  error?: string;
  footer: Child;
  children: Child;
}) => {
  const { t } = useTranslation(c);

  return (
    <Layout context={c}>
      <main>
        <h1 class="text-3xl font-serif pb-2 mb-3 border-b">{t(title)}</h1>
        <form method="post" action={action} class="py-3 max-w-lg">
          {error && (
            <div class="mb-4 p-3 border border-red-400 bg-red-50 text-red-700">{error}</div>
          )}
          {children}
        </form>
        <p class="py-3 max-w-lg text-gray-600">{footer}</p>
      </main>
    </Layout>
  );
};

const renderLogin = (c: DefaultContext, error?: string) => {
  const { t } = useTranslation(c);
  const redirect = getLoginRedirect(c);

  return c.render(
    <AuthPage
      c={c}
      title="auth.login"
      action={redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : "/login"}
      error={error}
      footer={
        <>
          {t("auth.dontHaveAccount")}{" "}
          <a href="/register" class="text-blue-600 hover:text-blue-800 underline">
            {t("auth.createOneHere")}
          </a>
        </>
      }
    >
      <TextInput name="username" label={t("auth.username")} autoComplete="username" maxLength={32} />
      <TextInput
        name="password"
        label={t("auth.password")}
        type="password"
        autoComplete="current-password"
        maxLength={128}
      />
      <button type="submit" class="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded">
        {t("auth.loginButton")}
      </button>
    </AuthPage>,
  );
};

const renderRegister = (c: DefaultContext, error?: string) => {
  const { t } = useTranslation(c);

  return c.render(
    <AuthPage
      c={c}
      title="auth.register"
      action="/register"
      error={error}
      footer={
        <>
          {t("auth.alreadyHaveAccount")}{" "}
          <a href="/login" class="text-blue-600 hover:text-blue-800 underline">
            {t("auth.logInHere")}
          </a>
        </>
      }
    >
      <TextInput name="username" label={t("auth.username")} autoComplete="username" maxLength={32} />
      <TextInput
        name="password"
        label={t("auth.password")}
        type="password"
        autoComplete="new-password"
        maxLength={128}
      />
      <TextInput
        name="confirmPassword"
        label={t("auth.confirmPassword")}
        type="password"
        autoComplete="new-password"
        maxLength={128}
      />
      <button type="submit" class="px-4 py-2 text-white bg-green-600 hover:bg-green-700 rounded">
        {t("auth.createAccount")}
      </button>
    </AuthPage>,
  );
};

export const handleLoginPage = (c: DefaultContext) =>
  c.get("user") ? c.redirect("/") : renderLogin(c);

export const handleRegisterPage = (c: DefaultContext) =>
  c.get("user") ? c.redirect("/") : renderRegister(c);

export const handleRegisterSubmit = async (c: DefaultContext) => {
  if (!isAdmin(c.get("user")) && isRateLimited(`register:${getClientAddress(c)}`, 10, 60 * 60 * 1000))
    return c.text("Too many requests", 429);

  const { t } = useTranslation(c);
  const body = await c.req.parseBody();
  const username = formValue(body.username).trim();
  const password = formValue(body.password);

  if (!username || !password || !body.confirmPassword)
    return renderRegister(c, t("error.allFieldsRequired"));
  if (!USERNAME_PATTERN.test(username)) return renderRegister(c, t("error.usernameLength"));
  // bcrypt only uses the first 72 bytes
  if (password.length < 8 || Buffer.byteLength(password) > 72)
    return renderRegister(c, t("error.passwordLength"));
  if (password !== body.confirmPassword) return renderRegister(c, t("error.passwordsDoNotMatch"));

  try {
    const [newUser] = await sql<User[]>`
      INSERT INTO users (username, password, permission_level)
      VALUES (${username}, ${await bcrypt.hash(password, SALT_ROUNDS)}, ${PermissionLevel.USER})
      RETURNING *
    `;

    setCookie(c, "auth", await signUser(newUser), cookieOptions);
    return c.redirect("/");
  } catch (error) {
    // 23505 is the unique violation on the username
    if ((error as { code?: string }).code === "23505")
      return renderRegister(c, t("error.usernameExists"));

    console.error("Registration error:", error);
    return renderRegister(c, t("error.accountCreationError"));
  }
};

export const handleLoginSubmit = async (c: DefaultContext) => {
  if (!isAdmin(c.get("user")) && isRateLimited(`login:${getClientAddress(c)}`, 20, 10 * 60 * 1000))
    return c.text("Too many requests", 429);

  const { t } = useTranslation(c);
  const body = await c.req.parseBody();
  const username = formValue(body.username).trim();
  const password = formValue(body.password);

  if (!username || !password) return renderLogin(c, t("error.usernamePasswordRequired"));

  const [user] = await sql<User[]>`SELECT * FROM users WHERE username = ${username}`;
  const valid = await bcrypt.compare(password, user?.password || DUMMY_HASH);
  if (!user || !valid) return renderLogin(c, t("error.invalidCredentials"));

  setCookie(c, "auth", await signUser(user), cookieOptions);
  return c.redirect(getLoginRedirect(c) ?? "/");
};

export const handleLogoutSubmit = (c: DefaultContext) => {
  deleteCookie(c, "auth", { path: "/" });
  return c.redirect("/", 303);
};
