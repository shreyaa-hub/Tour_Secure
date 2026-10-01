// backend/scripts/seedDemo.ts
// Seeds demo risk zones around Guwahati and creates (or promotes) an admin user.
//
// Usage:
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-strong-password' npm run seed:demo
//
// Safe to re-run: zones are upserted by name; the admin user is created or promoted.
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import Zone from "../src/models/zone.model";
import User from "../src/models/User";

/** Closed square ring around a point, in GeoJSON [lng, lat] order. */
function square(lat: number, lng: number, half = 0.006): number[][][] {
  return [[
    [lng - half, lat - half],
    [lng + half, lat - half],
    [lng + half, lat + half],
    [lng - half, lat + half],
    [lng - half, lat - half],
  ]];
}

const zones = [
  { name: "Paltan Bazaar (night)", riskLevel: "high", riskScore: 80, lat: 26.1790, lng: 91.7520,
    description: "Crowded transit hub; pickpocketing reported after dark." },
  { name: "Fancy Bazaar", riskLevel: "medium", riskScore: 55, lat: 26.1860, lng: 91.7390,
    description: "Busy market; watch belongings." },
  { name: "Dispur Government Area", riskLevel: "low", riskScore: 20, lat: 26.1400, lng: 91.7900,
    description: "Patrolled administrative area." },
] as const;

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGO_URL || process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGO_URI missing in .env");
  await mongoose.connect(uri);
  await Zone.syncIndexes();

  for (const z of zones) {
    await Zone.updateOne(
      { name: z.name },
      {
        $set: {
          name: z.name,
          description: z.description,
          riskLevel: z.riskLevel,
          riskScore: z.riskScore,
          polygon: { type: "Polygon", coordinates: square(z.lat, z.lng) },
        },
      },
      { upsert: true }
    );
  }
  console.log(`✅ Upserted ${zones.length} demo zones`);

  const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    const existing = await User.findOne({ email });
    if (existing) {
      await User.updateOne({ email }, { $set: { role: "admin" } });
      console.log(`✅ Promoted existing user to admin: ${email}`);
    } else {
      await User.create({ name: "Admin", email, password: await bcrypt.hash(password, 10), role: "admin" });
      console.log(`✅ Created admin user: ${email}`);
    }
  } else {
    console.log("ℹ️  Skipped admin user (set ADMIN_EMAIL and ADMIN_PASSWORD to create one)");
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
