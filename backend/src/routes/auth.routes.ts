// backend/src/routes/auth.routes.ts
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { requireAuth, AuthedRequest } from "../middleware/requireAuth";
import { getEnv } from "../config/env";

const r = Router();
const env = getEnv();
const isProd = env.NODE_ENV === "production";

/** Sign a JWT with standard subject (sub) and minimal payload.
 *  We also keep role/email in payload for convenience.
 */
function signJWTFor(userId: string, u: { email?: string; name?: string; role?: string }) {
  return jwt.sign(
    { email: u.email, name: u.name, role: u.role || "user" },
    env.JWT_SECRET,
    {
      subject: userId, // standard place for user id
      expiresIn: `${env.JWT_EXPIRES_DAYS}d`,
    }
  );
}

/** Legacy-compatible signer (keeps your original shape by also embedding id in payload).
 *  This preserves originality while ensuring `sub` is present for verifiers that prefer it.
 */
function signJWT(u: any) {
  const id = String(u._id || u.id);
  return jwt.sign(
    { id, email: u.email, name: u.name, role: u.role || "user" },
    env.JWT_SECRET,
    {
      subject: id,
      expiresIn: `${env.JWT_EXPIRES_DAYS}d`,
    }
  );
}

function setSessionCookie(res: any, token: string) {
  res.cookie(env.AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    maxAge: Number(env.JWT_EXPIRES_DAYS) * 24 * 60 * 60 * 1000,
    domain: process.env.COOKIE_DOMAIN || undefined,
    path: "/",
  });
}

function clearSessionCookie(res: any) {
  res.clearCookie(env.AUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    domain: process.env.COOKIE_DOMAIN || undefined,
    path: "/",
  });
}

// REGISTER
r.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const normEmail = String(email).toLowerCase().trim();
    const existing = await User.findOne({ email: normEmail });
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: String(name).trim(),
      email: normEmail,
      password: hash,
      role: "user",
    });

    // Prefer standardized token (with sub), but keep original shape via signJWT()
    const token = signJWT(user);
    setSessionCookie(res, token);

    return res.status(201).json({
      ok: true,
      user: { id: user._id, name: user.name, email: user.email, role: user.role || "user" },
      token,
    });
  } catch (e: any) {
    console.error("REGISTER error:", e?.message || e);
    return res.status(500).json({ error: "register_failed" });
  }
});

// LOGIN
r.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const normEmail = String(email).toLowerCase().trim();

    // Select the password even if schema has select:false
    const user = await User.findOne({ email: normEmail }).select("+password").lean();

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    if (!user.password) {
      // Document created without password (corrupt / social login mismatch).
      return res.status(401).json({ error: "Account not password-enabled. Please register again." });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // With .lean(), _id is a plain ObjectId: normalize to string for JWT subject
    const userId = String((user as any)._id);
    const token = signJWTFor(userId, user as any); // standardized signer

    setSessionCookie(res, token);

    return res.json({
      ok: true,
      user: { id: userId, name: (user as any).name, email: (user as any).email, role: (user as any).role || "user" },
      token,
    });
  } catch (e: any) {
    console.error("LOGIN error:", e?.message || e);
    return res.status(500).json({ error: "login_failed" });
  }
});

// WHOAMI
r.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  return res.json({ ok: true, user: req.user });
});

// LOGOUT
r.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  return res.json({ ok: true });
});

export default r;
