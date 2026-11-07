import type { Context, Next } from "hono";
import { deleteCookie, getCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";
import { sql, type User } from "./database";
import type { Language } from "./translation";

export type Variables = {
  user?: User | null;
  language?: Language;
};

export type DefaultContext = Context<{ Variables: Variables }>;

export enum PermissionLevel {
  USER = 0,
  MODERATOR = 5,
  ADMIN = 9,
}

export const isModerator = (user?: User | null) =>
  !!user && user.permission_level >= PermissionLevel.MODERATOR;

export const isAdmin = (user?: User | null) =>
  !!user && user.permission_level >= PermissionLevel.ADMIN;

// Reads a path parameter that the handler's route always defines.
export const routeParam = (c: Context, name: string) => {
  const value = c.req.param(name);
  if (value === undefined) throw new Error(`Missing route parameter: ${name}`);
  return value;
};

/**
 * Parses a database ID from a route parameter or request body.
 * Returns undefined for anything that isn't a positive integer.
 */
export const parseId = (value: unknown) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
};

/**
 * Reads a JSON object from the request body. Anything else, including invalid JSON, yields an empty object.
 */
export const readJson = async <T>(c: Context): Promise<Partial<T>> => {
  const body = await c.req.json().catch(() => undefined);
  return body && typeof body === "object" && !Array.isArray(body) ? body : {};
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
