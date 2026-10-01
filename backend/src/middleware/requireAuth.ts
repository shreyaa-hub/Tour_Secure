// backend/src/middleware/requireAuth.ts

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { getEnv } from "../config/env";

/** Roles supported by the app */
export type Role = "user" | "admin";

/** What we attach to req.user once authenticated */
export interface AuthedUser {
  id: string;
  email?: string;
  name?: string;
  role?: Role;
}

/** Express request extended to carry the authenticated user */
export interface AuthedRequest extends Request {
  user?: AuthedUser;
}

/** The shape we accept from jwt.verify (string or payload with common fields) */
type JwtVerified =
  | (jwt.JwtPayload & { sub?: string; id?: string; email?: string; role?: Role })
  | string;

/**
 * requireAuth
 * -------------
 * Ensures the request is authenticated and attaches a normalized `req.user`.
 * Looks for a token in:
 *   - Authorization: Bearer <token>
 *   - Cookie: <AUTH_COOKIE_NAME>
 *   - X-Access-Token header (fallback)
 *
 * The token must be a JWT signed with JWT_SECRET and contain `sub` or `id`.
 */
export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const { AUTH_COOKIE_NAME, JWT_SECRET, NODE_ENV } = getEnv();

  // 1) Pull token from various places (keep forgiving order)
  const authHeader = (req.headers["authorization"] || req.headers["Authorization"]) as
    | string
    | undefined;

  const bearer =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;

  const cookieTok = (req.cookies && req.cookies[AUTH_COOKIE_NAME]) || null;
  const altTok = (req.headers["x-access-token"] as string) || null;

  const token = bearer || cookieTok || altTok;

  if (!token) {
    if (NODE_ENV !== "production") {
      console.warn(
        "requireAuth: no token present",
        JSON.stringify({
          hasCookie: !!cookieTok,
          hasBearer: !!bearer,
          hasAlt: !!altTok,
        })
      );
    }
    return res.status(401).json({ error: "Unauthorized", reason: "missing_token" });
  }

  // 2) Verify JWT
  let payload: jwt.JwtPayload;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtVerified;
    payload = typeof decoded === "string" ? ({} as jwt.JwtPayload) : decoded;
  } catch (e: any) {
    const kind =
      e?.name === "TokenExpiredError"
        ? "token_expired"
        : e?.name === "JsonWebTokenError"
        ? "invalid_token"
        : "verify_failed";
    if (NODE_ENV !== "production") {
      console.error("requireAuth: jwt verify error:", e?.name, e?.message);
    }
    return res.status(401).json({ error: "Unauthorized", reason: kind });
  }

  // 3) Extract a user id from payload
  const userId = String((payload as any).sub || (payload as any).id || "");
  if (!userId) {
    if (NODE_ENV !== "production") {
      console.error("requireAuth: token missing sub/id. payload=", payload);
    }
    return res.status(401).json({ error: "Unauthorized", reason: "bad_payload" });
  }

  // 4) Ensure the user still exists (minimal projection)
  const dbUser = await User.findById(userId)
    .select({ _id: 1, email: 1, name: 1, role: 1 })
    .lean();

  if (!dbUser) {
    return res.status(401).json({ error: "Unauthorized", reason: "user_not_found" });
  }

  // 5) Attach normalized user to request (and optionally res.locals)
  req.user = {
    id: dbUser._id.toString(),
    email: dbUser.email,
    name: dbUser.name,
    role: (dbUser.role as Role) || (payload as any).role || "user",
  };
  (res.locals as any).user = req.user;

  return next();
}

/**
 * requireAdmin
 * -------------
 * Must run after requireAuth. The role comes from the database (loaded in
 * requireAuth), not from the JWT payload, so a demoted admin loses access
 * immediately instead of when their token expires.
 */
export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  return next();
}

/* -------------------- Optional: Type augmentation for Express -------------------- */
/* If your TS setup complains about req.user not existing on Request, keep this. */
declare module "express-serve-static-core" {
  interface Request {
    user?: AuthedUser;
  }
}
