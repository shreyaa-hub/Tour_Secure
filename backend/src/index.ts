// backend/src/index.ts
import express, { type Request, type Response, type NextFunction } from "express";
// Forwards rejected promises from async route handlers to the error middleware
// (Express 4 does not do this on its own; without it, one bad request crashes the process).
import "express-async-errors";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { getEnv } from "./config/env";
import { connectMongo } from "./config/db";

// ---- Routers ----
import authRoutes from "./routes/auth.routes";
import alertsRoutes from "./routes/alerts.routes";
import adminRoutes from "./routes/admin.routes";
import userWalletRouter from "./routes/userWallet.routes";
import efirRouter from "./routes/efir.routes";
import geoRouter from "./routes/geo.routes";
import digitalIdRouter from "./routes/digitalId";
import safetyRouter from "./routes/safety.routes";
import reviewsRouter from "./routes/reviews.routes";
import debugRouter from "./routes/debug.routes"; // ✅ use existing file name (no underscore)
import itineraryRoutes from "./routes/itinerary.routes"; // ✅ user-specific itinerary

async function start() {
  const env = getEnv();
  const app = express();

  // If you're behind a proxy (e.g., Vercel/Nginx) and using secure cookies
  app.set("trust proxy", 1);

  // ---- Core middleware (order matters) ----
  app.use(morgan("dev"));
  app.use(cookieParser());
  app.use(express.urlencoded({ extended: true })); // support form posts
  app.use(express.json({ limit: "1mb" }));

  // ---- CORS (must be before routes) ----
  const origins = Array.isArray(env.CORS_ORIGINS)
    ? env.CORS_ORIGINS
    : String(env.CORS_ORIGINS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

  app.use(
    cors({
      origin: origins.length ? origins : false,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Access-Token", "Cache-Control"],
      exposedHeaders: ["Set-Cookie"],
    })
  );
  // Preflight
  app.options("*", cors({ origin: origins.length ? origins : false, credentials: true }));

  // ---- Health ----
  app.get("/api/health", (_req, res) =>
    res.json({ status: "ok", time: new Date().toISOString() })
  );

  // ---- Routes ----
  app.use("/api/geo", geoRouter);
  app.use("/api/auth", authRoutes);
  app.use("/api/alerts", alertsRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/safety-scores", safetyRouter);
  app.use("/api/reviews", reviewsRouter);
  app.use("/api/user", userWalletRouter);
  app.use("/api/efir", efirRouter);
  app.use("/api/digital-id", digitalIdRouter);
  app.use("/api/itinerary", itineraryRoutes); // ✅ itinerary routes

  // ---- Debug (only in dev) ----
  if (env.NODE_ENV !== "production") {
    app.use("/api/debug", debugRouter);
  }

  // ---- 404 for unknown API routes ----
  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

  // ---- Error handler (must be last) ----
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    // Invalid ObjectId / bad types / schema validation are client errors
    if (err?.name === "CastError" || err?.name === "ValidationError") {
      return res.status(400).json({ error: "Invalid request", details: err.message });
    }
    console.error("Unhandled error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  });

  // ---- DB then listen ----
  await connectMongo();

  const port = Number(env.PORT) || 4000;
  app.listen(port, () => {
    console.log(`✅ API running at http://localhost:${port}`);
    console.log(`🔐 CORS origins: ${origins.join(", ") || "(none)"}`);
  });
}

start();
