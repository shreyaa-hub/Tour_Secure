import { Router } from "express";
import Alert from "../models/Alert";
import { requireAuth, AuthedRequest } from "../middleware/requireAuth";

const r = Router();

const LOCATION_SOURCES = ["gps", "last-known", "manual", "default"] as const;

// user sends SOS (requires login; cookie or Bearer token)
r.post("/panic", requireAuth, async (req: AuthedRequest, res) => {
  const { lat, lon, locationSource } = req.body || {};
  const latN = Number(lat);
  const lonN = Number(lon);

  if (lat == null || lon == null || !Number.isFinite(latN) || !Number.isFinite(lonN)
      || latN < -90 || latN > 90 || lonN < -180 || lonN > 180) {
    return res.status(400).json({ error: "Valid lat (-90..90) and lon (-180..180) are required" });
  }

  const source = LOCATION_SOURCES.includes(locationSource) ? locationSource : "unknown";
  const a = await Alert.create({
    userId: req.user!.id,
    lat: latN,
    lon: lonN,
    meta: { locationSource: source },
  });
  res.status(201).json({ ok: true, id: a._id, createdAt: a.get("createdAt") });
});

export default r;
