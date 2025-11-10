import type { Context, Env } from "hono";
import { sql, type User } from "./database";
import { sign, verify } from "hono/jwt";
import { getCookie } from "hono/cookie";
import { type Language, isLanguageSupported } from "./translation";

// Passing values between routes using middleware and shared context
export type Variables = {
  user: User;
  language: Language;
};

// Default context with Variables
export type DefaultContext<T extends Variables = Variables> = Context<{
  Variables: T;
}>;

const SECRET = "your-secret-here";

// Permission levels for all users
export enum PermissionLevel {
  USER = 0,
  MODERATOR = 5,
  ADMIN = 9,
}

// Function to sign a user jwt (JSON Web Token)
export const signUser = async (user: User) => {
  return sign({ id: user.id }, SECRET);
};

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
    const [user] = await sql<
      User[]
    >`SELECT * FROM users WHERE id = ${payload.id as any} LIMIT 1`;

    if (!user) {
      return await next();
    }

    c.set("user", user);
    await next();
  } catch {
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
