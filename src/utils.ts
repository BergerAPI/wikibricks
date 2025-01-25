import type { Context, Env } from "hono";
import { sql, type User } from "./database";
import { sign, verify } from "hono/jwt";
import { getCookie } from "hono/cookie";

// Passing values between routes using middleware and shared context
export type Variables = {
    user: User;
}

// Default context with Variables
export type DefaultContext<T extends Variables = Variables> = Context<{ Variables: T }>;

const SECRET = "your-secret-here";

// Permission levels for all users
export enum PermissionLevel {
    USER = 0,
    MODERATOR = 5,
    ADMIN = 9
}

// Function to sign a user jwt (JSON Web Token)
export const signUser = async (user: User) => {
    return sign({ id: user.id }, SECRET);
};

// Middleware to verify authentication
export const attemptAuthentication = async (c: any, next: any) => {
    const token = getCookie(c, "auth");

    if (!token) {
        return await next();
    }

    try {
        const payload = await verify(token, SECRET);
        const [user] = await sql<User[]>`SELECT * FROM t_user WHERE id = ${payload.id as any} LIMIT 1`;

        if (!user) {
            return await next();
        }

        c.set("user", user);
        await next();
    } catch {
        return await next();
    }
};
