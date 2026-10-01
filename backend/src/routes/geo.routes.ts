import { Router } from "express";
import { createZone, listZones, checkPoint } from "../controllers/geo.controller";
import { requireAuth, requireAdmin } from "../middleware/requireAuth";

const router = Router();

router.post("/zones", requireAuth, requireAdmin, createZone); // only admins define risk zones
router.get("/zones", listZones);
router.post("/check", checkPoint);

export default router;
