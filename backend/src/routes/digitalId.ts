import { Router } from "express";
import { requireAuth, AuthedRequest } from "../middleware/requireAuth";
import User from "../models/User";
import DigitalId from "../models/DigitalId";
import jwt from "jsonwebtoken";
import QRCode from "qrcode";
import { ethers } from "ethers";
import multer from "multer";
import path from "path";
import fs from "fs";

const r = Router();

const JWT_SECRET = process.env.JWT_SECRET || "changeme";
// Where the web app runs: the QR code opens its /verify page
const CLIENT_BASE_URL = (process.env.CLIENT_BASE_URL || "http://localhost:5173").replace(/\/+$/, "");
const UPLOAD_DIR = process.env.FILE_STORAGE_DIR || path.join(process.cwd(), "secure_uploads");

// ensure upload dir
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Multer storage for document uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    cb(null, `doc_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB

// Helpers
async function ensureWalletAddress(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");
  if (!user.walletAddress) {
    const wallet = ethers.Wallet.createRandom();
    user.walletAddress = wallet.address;
    await user.save();
  }
  return user.walletAddress!;
}
function secondsUntil(date: Date) {
  const diffMs = new Date(date).getTime() - Date.now();
  return Math.max(1, Math.floor(diffMs / 1000));
}
function createQrToken(payload: { did: string; uid: string }, endAt: Date) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: secondsUntil(endAt) });
}
function buildVerifyUrl(token: string) {
  return `${CLIENT_BASE_URL}/verify/${token}`;
}
async function normalizeStatuses(uid: string) {
  await DigitalId.updateMany(
    { user: uid, status: "active", endAt: { $lt: new Date() } },
    { $set: { status: "expired" } }
  );
}
function toClient(doc: any, withQR = true) {
  return {
    id: String(doc._id),
    user: String(doc.user),
    walletAddress: doc.walletAddress,
    entrypoint: doc.entrypoint,
    docType: doc.docType,
    startAt: doc.startAt,
    endAt: doc.endAt,
    status: doc.status,
    docFilePath: doc.docFilePath || null,
    qr: withQR && doc.qrToken
      ? {
          verifyUrl: buildVerifyUrl(doc.qrToken),
          // The QR image is better delivered straight from backend generation on create/refresh;
          // here we provide the verifyUrl; your frontend can show the image it receives on create.
          // If you want to always send a dataUrl, you can regenerate: QRCode.toDataURL(buildVerifyUrl(doc.qrToken))
          // Doing that on every GET is wasteful; we only include on create/refresh endpoints.
        }
      : null,
  };
}

// ===== GET /api/digital-id/me =====
r.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const uid = req.user!.id;
  await normalizeStatuses(uid);
  const latest = await DigitalId.findOne({ user: uid }).sort({ createdAt: -1 }).lean();
  return res.json({ ok: true, digitalId: latest ? toClient(latest, false) : null });
});

// ===== POST /api/digital-id/create =====
r.post("/create", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const uid = req.user!.id;
    const entrypoint = (req.body.entrypoint || "").toString().trim() || null;
    const docType = (req.body.docType || "").toString().trim() || null;

    const startAt = new Date(req.body.startAt || Date.now());
    const endAt = new Date(req.body.endAt || Date.now() + 72 * 3600 * 1000);
    if (!(endAt.getTime() > startAt.getTime())) {
      return res.status(400).json({ error: "endAt must be after startAt" });
    }

    const walletAddress = await ensureWalletAddress(uid);

    const did = await DigitalId.create({
      user: uid,
      walletAddress,
      entrypoint,
      docType,
      startAt,
      endAt,
      status: "active",
    });

    const token = createQrToken({ did: did._id.toString(), uid }, endAt);
    did.qrToken = token;
    await did.save();

    const verifyUrl = buildVerifyUrl(token);
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1 });

    return res.status(201).json({
      ok: true,
      digitalId: {
        ...toClient(did.toObject(), false),
        qr: { verifyUrl, dataUrl: qrDataUrl, expiresAt: did.endAt },
      },
    });
  } catch (e: any) {
    console.error("digital-id/create error:", e);
    return res.status(500).json({ error: e?.message || "Failed to create Digital ID" });
  }
});

// ===== GET /api/digital-id/verify/:token =====
r.get("/verify/:token", async (req, res) => {
  const t = req.params.token;
  try {
    const payload = jwt.verify(t, JWT_SECRET) as { did: string; uid: string; iat: number; exp: number };
    const doc = await DigitalId.findById(payload.did).lean();
    if (!doc) return res.status(404).json({ ok: false, valid: false, reason: "not_found" });

    const now = Date.now();
    if (doc.status !== "active") return res.status(410).json({ ok: false, valid: false, reason: "revoked_or_expired" });
    if (!(new Date(doc.startAt).getTime() <= now && now <= new Date(doc.endAt).getTime())) {
      return res.status(410).json({ ok: false, valid: false, reason: "out_of_window" });
    }

    const holder = await User.findById(doc.user).select({ name: 1 }).lean<{ name?: string }>();
    // Public endpoint: return only what someone verifying the ID needs to see
    return res.json({
      ok: true,
      valid: true,
      holder: { name: holder?.name ?? null },
      digitalId: {
        status: doc.status,
        entrypoint: doc.entrypoint ?? null,
        docType: doc.docType ?? null,
        startAt: doc.startAt,
        endAt: doc.endAt,
      },
    });
  } catch {
    return res.status(401).json({ ok: false, valid: false, reason: "invalid_or_expired_token" });
  }
});

// ===== POST /api/digital-id/revoke =====
r.post("/revoke", requireAuth, async (req: AuthedRequest, res) => {
  const uid = req.user!.id;
  await DigitalId.updateMany({ user: uid, status: "active" }, { $set: { status: "revoked" } });
  return res.json({ ok: true });
});

// ===== POST /api/digital-id/:id/refresh-qr ===== (Extra 1)
r.post("/:id/refresh-qr", requireAuth, async (req: AuthedRequest, res) => {
  const uid = req.user!.id;
  const id = req.params.id;
  const doc = await DigitalId.findOne({ _id: id, user: uid });
  if (!doc) return res.status(404).json({ error: "Digital ID not found" });
  if (doc.status !== "active") return res.status(400).json({ error: "Only active Digital IDs can refresh QR" });
  if (doc.endAt.getTime() <= Date.now()) return res.status(400).json({ error: "Trip already expired" });

  const token = createQrToken({ did: doc._id.toString(), uid }, doc.endAt);
  doc.qrToken = token;
  await doc.save();

  const verifyUrl = buildVerifyUrl(token);
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1 });

  return res.json({
    ok: true,
    digitalId: {
      ...toClient(doc.toObject(), false),
      qr: { verifyUrl, dataUrl: qrDataUrl, expiresAt: doc.endAt },
    },
  });
});

// ===== POST /api/digital-id/:id/extend ===== (Extra 2)
r.post("/:id/extend", requireAuth, async (req: AuthedRequest, res) => {
  const uid = req.user!.id;
  const id = req.params.id;
  const newEndAt = new Date(req.body.endAt);
  if (!Number.isFinite(newEndAt.getTime())) return res.status(400).json({ error: "Invalid endAt" });

  const doc = await DigitalId.findOne({ _id: id, user: uid });
  if (!doc) return res.status(404).json({ error: "Digital ID not found" });
  if (newEndAt.getTime() <= doc.startAt.getTime()) return res.status(400).json({ error: "endAt must be after startAt" });

  doc.endAt = newEndAt;
  if (doc.status === "expired" && newEndAt.getTime() > Date.now()) {
    doc.status = "active";
  }
  const token = createQrToken({ did: doc._id.toString(), uid }, doc.endAt);
  doc.qrToken = token;
  await doc.save();

  const verifyUrl = buildVerifyUrl(token);
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1 });

  return res.json({
    ok: true,
    digitalId: {
      ...toClient(doc.toObject(), false),
      qr: { verifyUrl, dataUrl: qrDataUrl, expiresAt: doc.endAt },
    },
  });
});

// ===== POST /api/digital-id/:id/upload ===== (Extra 3 — file upload)
r.post("/:id/upload", requireAuth, upload.single("document"), async (req: AuthedRequest, res) => {
  const uid = req.user!.id;
  const id = req.params.id;
  const doc = await DigitalId.findOne({ _id: id, user: uid });
  if (!doc) return res.status(404).json({ error: "Digital ID not found" });

  if (!req.file) return res.status(400).json({ error: "document file is required" });
  doc.docFilePath = path.relative(process.cwd(), req.file.path);
  await doc.save();

  return res.json({ ok: true, digitalId: toClient(doc, false) });
});

export default r;