import { Router } from "express";
import { requireAuth, AuthedRequest } from "../middleware/requireAuth";
import Efir from "../models/efir.model";

const router = Router();

/** Coerce any incoming body shape to a normalized object. */
function normalizeBody(anyBody: any) {
  const b = (anyBody && typeof anyBody === "object") ? anyBody : {};

  // Accept all common synonyms users/code might send
  const summaryFallback =
    b.summary ??
    b.description ??
    b.text ??
    b.message ??
    b.body ??
    b.content ??
    b.desc ??
    "";

  const name = b.name ?? "";
  const contact = b.contact ?? "";
  const attachments = Array.isArray(b.attachments) ? b.attachments : [];
  const location = (b.location && typeof b.location === "object") ? b.location : undefined;

  // Final normalized shape
  return {
    name: String(name || "").trim() || undefined,
    contact: String(contact || "").trim() || undefined,
    summary: String(summaryFallback || "").trim(), // may be empty; model default will still accept
    attachments: attachments.map((x: any) => String(x)),
    location: location
      ? {
          lat: (location.lat != null ? Number(location.lat) : undefined),
          lng: (location.lng != null ? Number(location.lng) : undefined),
        }
      : undefined,
  };
}

/**
 * POST /api/efir
 * Create a user-specific e-FIR (always stores a summary, even if empty).
 */
router.post("/", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const norm = normalizeBody(req.body);

    // If truly nothing was provided, make a defensive fallback
    const finalSummary =
      norm.summary && norm.summary.length > 0 ? norm.summary : "(no summary provided)";

    const item = await Efir.create({
      name: norm.name,
      contact: norm.contact,
      summary: finalSummary,          // guaranteed present now
      attachments: norm.attachments,
      location: norm.location,
      user: req.user!.id,             // owner is the logged in user
      status: "Pending",
    });

    return res.status(201).json({ ok: true, item });
  } catch (err) {
    console.error("Error in POST /api/efir:", err, "body:", req.body);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * GET /api/efir
 * Return ONLY the current user's e-FIR submissions
 */
router.get("/", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const items = await Efir.find({ user: req.user!.id })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ ok: true, items });
  } catch (err) {
    console.error("Error in GET /api/efir:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
