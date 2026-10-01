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

r.get("/alerts", async (_req, res) => {
  const items = await Alert.find()
    .sort({ createdAt: -1 })
    .limit(100)
    .populate("userId", "name email")
    .lean();
  res.json(items);
});

export default r;
