import type { Context } from "hono";
import { sql, type User } from "./database";
import { sign, verify } from "hono/jwt";
import { getCookie } from "hono/cookie";
import { type Language, isLanguageSupported } from "./translation";

// Passing values between routes using middleware and shared context
export type Variables = {
  user?: User | null;
  language?: Language;
};

// Default context with Variables
export type DefaultContext<T extends Variables = Variables> = Context<{
  Variables: T;
}>;

const DEV_JWT_SECRET = "dev-only-insecure-secret-change-me";
const EXAMPLE_JWT_SECRET = "change-me-to-at-least-32-chars-long-random-string";

const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  const trimmed = secret?.trim() ?? "";
  if (
    process.env.NODE_ENV === "production" &&
    (trimmed.length < 32 || trimmed === EXAMPLE_JWT_SECRET ||
      trimmed === DEV_JWT_SECRET)
  ) {
    throw new Error("Set JWT_SECRET to a unique secret of at least 32 characters");
  }
  if (secret) return secret;
  console.warn("JWT_SECRET not set, using insecure dev fallback");
  return DEV_JWT_SECRET;
};

const SECRET = getSecret();

const rateLimitBuckets = new Map<string, { hits: number[]; expiresAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateLimitBuckets) {
    if (bucket.expiresAt <= now) rateLimitBuckets.delete(key);
  }
}, 60_000).unref();

export const isRateLimited = (
  key: string,
  max: number,
  windowMs: number,
): boolean => {
  const now = Date.now();
  const hits = (rateLimitBuckets.get(key)?.hits ?? []).filter(
    (t) => now - t < windowMs,
  );
  if (hits.length >= max) return true;
  hits.push(now);
  rateLimitBuckets.set(key, { hits, expiresAt: now + windowMs });
  return false;
};

// Function to sign a user jwt (JSON Web Token)
export const signUser = async (user: User) => {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    { id: user.id, iat: now, exp: now + 7 * 24 * 60 * 60 },
    SECRET,
  );
};

// Permission levels for all users
export enum PermissionLevel {
  USER = 0,
  MODERATOR = 5,
  ADMIN = 9,
}

export const isAdmin = (
  user?: { permission_level?: number } | null,
): boolean => (user?.permission_level ?? 0) >= PermissionLevel.ADMIN;

// Middleware to verify authentication
export const attemptAuthentication = async (
  c: DefaultContext,
  next: () => Promise<void>,
) => {
  const token = getCookie(c, "auth");

  if (!token) {
    return await next();
  }

  try {
    const payload = await verify(token, SECRET);
    if (typeof payload.id !== "number" || !Number.isInteger(payload.id)) {
      throw new Error("Invalid token payload");
    }
    const [user] = await sql<
      User[]
    >`SELECT * FROM users WHERE id = ${payload.id} LIMIT 1`;

    if (!user) {
      const { deleteCookie } = await import("hono/cookie");
      deleteCookie(c, "auth", { path: "/" });
      return await next();
    }

    c.set("user", user);
    await next();
  } catch {
    try {
      const { deleteCookie } = await import("hono/cookie");
      deleteCookie(c, "auth", { path: "/" });
    } catch {
      // ignore
    }
    return await next();
  }
};

// Middleware to detect and set language
export const detectLanguage = async (
  c: DefaultContext,
  next: () => Promise<void>,
) => {
  // Check for language preference in query parameter
  let language = c.req.query("lang");

  // If not in query, check Accept-Language header
  if (!language) {
    const acceptLanguage = c.req.header("Accept-Language");
    if (acceptLanguage) {
      // Simple language detection from Accept-Language header
      const languages = acceptLanguage
        .split(",")
        .map((lang) => lang.trim().split(";")[0].split("-")[0]);
      language = languages.find((lang) => isLanguageSupported(lang)) || "en";
    }
  }

  // Default to English if not supported
  if (!language || !isLanguageSupported(language)) {
    language = "en";
  }

  // Set global language context
  c.set("language", language as Language);

  await next();
};
