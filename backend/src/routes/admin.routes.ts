import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/requireAuth";
import EFIR from "../models/efir.model";
import Alert from "../models/Alert";

const r = Router();
r.use(requireAuth, requireAdmin);

r.get("/efir", async (_req, res) => {
  const items = await EFIR.find()
    .sort({ createdAt: -1 })
    .limit(200)
    .populate("user", "name email")
    .lean();
  res.json(items);
});

// Update an e-FIR's status (admins only, enforced by r.use above)
const EFIR_STATUSES = ["Pending", "In progress", "Closed"];
r.patch("/efir/:id", async (req, res) => {
  const status = String(req.body?.status || "");
  if (!EFIR_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${EFIR_STATUSES.join(", ")}` });
  }
  const item = await EFIR.findByIdAndUpdate(req.params.id, { $set: { status } }, { new: true })
    .populate("user", "name email")
    .lean();
  if (!item) return res.status(404).json({ error: "Report not found" });
  res.json(item);
});

r.get("/alerts", async (_req, res) => {
  const items = await Alert.find()
    .sort({ createdAt: -1 })
    .limit(100)
    .populate("userId", "name email")
    .lean();
  res.json(items);
});

export default r;
