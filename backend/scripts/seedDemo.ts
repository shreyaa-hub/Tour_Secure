// backend/scripts/seedDemo.ts
// Seeds demo risk zones (Guwahati + Chennai), Chennai-region sample safety scores,
// and creates (or promotes) an admin user. All values are illustrative sample data.
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
import SafetyScore from "../src/models/SafetyScore";

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
  // Chennai region
  { name: "Chennai Central (night)", riskLevel: "high", riskScore: 75, lat: 13.0827, lng: 80.2757,
    description: "Busy rail hub; touts and pickpocketing reported late at night." },
  { name: "T. Nagar Market", riskLevel: "medium", riskScore: 55, lat: 13.0418, lng: 80.2341,
    description: "Very crowded shopping area; watch belongings." },
  { name: "Marina Beach (late night)", riskLevel: "medium", riskScore: 50, lat: 13.0500, lng: 80.2824,
    description: "Poorly lit stretches after dark." },
] as const;

// Chennai-region safety-score areas (sample values; same fields as seedSafety.ts)
const chennaiAreas = [
  { name: "Chennai Central, Tamil Nadu", lat: 13.0827, lng: 80.2757, crimeRate: 62, infraScore: 70, sentiment: -0.2 },
  { name: "T. Nagar, Tamil Nadu", lat: 13.0418, lng: 80.2341, crimeRate: 55, infraScore: 72, sentiment: 0.0 },
  { name: "Marina Beach, Tamil Nadu", lat: 13.0500, lng: 80.2824, crimeRate: 48, infraScore: 65, sentiment: 0.1 },
  { name: "Mylapore, Tamil Nadu", lat: 13.0339, lng: 80.2697, crimeRate: 30, infraScore: 75, sentiment: 0.5 },
  { name: "Adyar, Tamil Nadu", lat: 13.0012, lng: 80.2565, crimeRate: 25, infraScore: 80, sentiment: 0.6 },
  { name: "Guindy, Tamil Nadu", lat: 13.0067, lng: 80.2206, crimeRate: 40, infraScore: 70, sentiment: 0.2 },
  { name: "Velachery, Tamil Nadu", lat: 12.9815, lng: 80.2180, crimeRate: 38, infraScore: 68, sentiment: 0.2 },
  { name: "Tambaram, Tamil Nadu", lat: 12.9249, lng: 80.1000, crimeRate: 45, infraScore: 60, sentiment: 0.0 },
  { name: "Sholinganallur, Tamil Nadu", lat: 12.9010, lng: 80.2279, crimeRate: 28, infraScore: 78, sentiment: 0.4 },
  { name: "Chengalpattu, Tamil Nadu", lat: 12.6919, lng: 79.9757, crimeRate: 42, infraScore: 55, sentiment: 0.0 },
  { name: "Mahabalipuram, Tamil Nadu", lat: 12.6208, lng: 80.1945, crimeRate: 22, infraScore: 65, sentiment: 0.6 },
  { name: "Kanchipuram, Tamil Nadu", lat: 12.8342, lng: 79.7036, crimeRate: 35, infraScore: 58, sentiment: 0.3 },
  { name: "Puducherry", lat: 11.9416, lng: 79.8083, crimeRate: 30, infraScore: 72, sentiment: 0.5 },
];

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
  console.log(`Upserted ${zones.length} demo zones`);

  await SafetyScore.syncIndexes();
  for (const a of chennaiAreas) {
    await SafetyScore.updateOne(
      { name: a.name },
      {
        $set: {
          name: a.name,
          crimeRate: a.crimeRate,
          infraScore: a.infraScore,
          sentiment: a.sentiment,
          loc: { type: "Point", coordinates: [a.lng, a.lat] },
        },
      },
      { upsert: true }
    );
  }
  console.log(`Upserted ${chennaiAreas.length} Chennai-region safety areas`);

  const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    const existing = await User.findOne({ email });
    if (existing) {
      await User.updateOne({ email }, { $set: { role: "admin" } });
      console.log(`Promoted existing user to admin: ${email}`);
    } else {
      await User.create({ name: "Admin", email, password: await bcrypt.hash(password, 10), role: "admin" });
      console.log(`Created admin user: ${email}`);
    }
  } else {
    console.log("Skipped admin user (set ADMIN_EMAIL and ADMIN_PASSWORD to create one)");
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
