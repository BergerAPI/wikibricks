import { parseId } from "@wikibricks/cms";
import type { Context, Next } from "hono";
import { deleteCookie, getCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";
import { sql, type User } from "./database";
import type { Language } from "./translation";

export type Variables = {
  user?: User | null;
  language?: Language;
  /** How many notifications are new, set for users who are logged in */
  notifications?: number;
};

export type DefaultContext = Context<{ Variables: Variables }>;

export enum PermissionLevel {
  USER = 0,
  MODERATOR = 5,
  ADMIN = 9,
}

type Permissions = Pick<User, "permission_level">;

export const isModerator = (user?: Permissions | null) =>
  !!user && user.permission_level >= PermissionLevel.MODERATOR;

export const isAdmin = (user?: Permissions | null) =>
  !!user && user.permission_level >= PermissionLevel.ADMIN;

export const ROLES = {
  user: PermissionLevel.USER,
  moderator: PermissionLevel.MODERATOR,
  admin: PermissionLevel.ADMIN,
};

export type Role = keyof typeof ROLES;

export const roleOf = (user: Permissions): Role => (isAdmin(user) ? "admin" : isModerator(user) ? "moderator" : "user");

// Reads a path parameter that the handler's route always defines.
export const routeParam = (c: Context, name: string) => {
  const value = c.req.param(name);
  if (value === undefined) throw new Error(`Missing route parameter: ${name}`);
  return value;
};

export { parseId };

const invalid = Symbol("invalid");

/** Turns a value of a request into what the handler works with, or marks it invalid */
type Parser<T> = (value: unknown) => T | typeof invalid;

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

/**
 * The values requests may contain. Each one accepts its kind of value and nothing else.
 */
export const is = {
  /** Required text must contain something besides whitespace. */
  text: ({ max = Infinity, required = false } = {}): Parser<string> => (value) =>
    typeof value === "string" && value.length <= max && (!required || value.trim()) ? value : invalid,
  id: (value: unknown) => parseId(value) ?? invalid,
  oneOf: <const T extends string>(...options: T[]): Parser<T> => (value) =>
    options.includes(value as T) ? (value as T) : invalid,
  /** Collection fields are validated by the CMS once the collection is known. */
  fields: (value: unknown) => isObject(value) ? value : invalid,
  optional: <T>(parse: Parser<T>): Parser<T | undefined> => (value) => (value === undefined ? undefined : parse(value)),
  nullable: <T>(parse: Parser<T>): Parser<T | null> => (value) => (value == null ? null : parse(value)),
};

/**
 * Reads a JSON request body with a parser for each key. Returns undefined when any value doesn't fit.
 */
export const readJson = async <S extends Record<string, Parser<unknown>>>(c: Context, shape: S) => {
  const body: unknown = await c.req.json().catch(() => undefined);
  if (!isObject(body)) return;

  const result: Record<string, unknown> = {};
  for (const [key, parse] of Object.entries(shape)) {
    const value = parse(Object.hasOwn(body, key) ? body[key] : undefined);
    if (value === invalid) return;
    result[key] = value;
  }
  return result as { [K in keyof S]: Exclude<ReturnType<S[K]>, typeof invalid> };
};

const DEV_SECRET = "dev-only-insecure-secret-change-me";
const EXAMPLE_SECRET = "change-me-to-at-least-32-chars-long-random-string";

const getSecret = () => {
  const secret = process.env.JWT_SECRET?.trim();

  if (process.env.NODE_ENV === "production") {
    if (!secret || secret.length < 32 || secret === EXAMPLE_SECRET || secret === DEV_SECRET)
      throw new Error("Set JWT_SECRET to a unique secret of at least 32 characters");
    return secret;
  }

  if (!secret) console.warn("JWT_SECRET not set, using insecure dev fallback");
  return secret || DEV_SECRET;
};

const SECRET = getSecret();
const SESSION_SECONDS = 7 * 24 * 60 * 60;

export const signUser = (user: User) => {
  const now = Math.floor(Date.now() / 1000);
  return sign({ id: user.id, iat: now, exp: now + SESSION_SECONDS }, SECRET, "HS256");
};

// Requests per key, dropped once their window has passed
const rateLimitBuckets = new Map<string, { hits: number[]; expiresAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateLimitBuckets) {
    if (bucket.expiresAt <= now) rateLimitBuckets.delete(key);
  }
}, 60_000).unref();

export const isRateLimited = (key: string, max: number, windowMs: number) => {
  const now = Date.now();
  const hits = (rateLimitBuckets.get(key)?.hits ?? []).filter((hit) => now - hit < windowMs);
  if (hits.length >= max) return true;

  hits.push(now);
  rateLimitBuckets.set(key, { hits, expiresAt: now + windowMs });
  return false;
};

// Sets the user from the auth cookie, dropping the cookie if it is no longer valid
export const attemptAuthentication = async (c: DefaultContext, next: Next) => {
  const token = getCookie(c, "auth");
  if (!token) return next();

  try {
    const { id } = await verify(token, SECRET, "HS256");
    const [user] = await sql<User[]>`SELECT * FROM users WHERE id = ${Number(id)}`;
    if (user) c.set("user", user);
    else deleteCookie(c, "auth", { path: "/" });
  } catch {
    deleteCookie(c, "auth", { path: "/" });
  }

  await next();
};
