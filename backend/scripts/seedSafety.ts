// backend/scripts/seedSafety.ts
import mongoose from "mongoose";
import "dotenv/config";
import SafetyScore from "../src/models/SafetyScore";

// ---- sample NE India points (25) ----
const points = [
  { name: "Dibrugarh, Assam", lat: 27.4728, lng: 94.9120, crimeRate: 35, infraScore: 60, sentiment: 0.2 },
  { name: "Tinsukia, Assam", lat: 27.2950, lng: 94.5710, crimeRate: 40, infraScore: 55, sentiment: -0.1 },
  { name: "Guwahati, Assam", lat: 26.1445, lng: 91.7362, crimeRate: 50, infraScore: 65, sentiment: 0.3 },
  { name: "Dispur, Assam", lat: 26.1390, lng: 91.7882, crimeRate: 42, infraScore: 70, sentiment: 0.1 },
  { name: "Duliajan, Assam", lat: 27.4667, lng: 95.3167, crimeRate: 38, infraScore: 50, sentiment: -0.2 },
  { name: "Digboi, Assam", lat: 27.2500, lng: 94.5500, crimeRate: 55, infraScore: 45, sentiment: -0.3 },
  { name: "Shillong, Meghalaya", lat: 25.5788, lng: 91.8933, crimeRate: 30, infraScore: 75, sentiment: 0.5 },
  { name: "Cherrapunji, Meghalaya", lat: 25.5120, lng: 91.2990, crimeRate: 33, infraScore: 70, sentiment: 0.4 },
  { name: "Gangtok, Sikkim", lat: 27.3333, lng: 88.6167, crimeRate: 28, infraScore: 80, sentiment: 0.6 },
  { name: "Rumtek, Sikkim", lat: 27.3200, lng: 88.6050, crimeRate: 35, infraScore: 75, sentiment: 0.4 },
  { name: "Dimapur, Nagaland", lat: 25.6700, lng: 94.1167, crimeRate: 60, infraScore: 55, sentiment: -0.4 },
  { name: "Kohima, Nagaland", lat: 25.6600, lng: 94.1100, crimeRate: 58, infraScore: 50, sentiment: -0.3 },
  { name: "Aizawl, Mizoram", lat: 23.8400, lng: 92.4376, crimeRate: 25, infraScore: 72, sentiment: 0.5 },
  { name: "Lunglei, Mizoram", lat: 23.7300, lng: 92.7200, crimeRate: 32, infraScore: 65, sentiment: 0.2 },
  { name: "Imphal, Manipur", lat: 24.8167, lng: 93.9500, crimeRate: 55, infraScore: 60, sentiment: -0.2 },
  { name: "Moreh, Manipur", lat: 24.8200, lng: 94.0000, crimeRate: 48, infraScore: 65, sentiment: -0.1 },
  { name: "Silchar, Assam", lat: 24.5000, lng: 92.7167, crimeRate: 40, infraScore: 68, sentiment: 0.2 },
  { name: "Sivasagar, Assam", lat: 27.4833, lng: 94.5500, crimeRate: 37, infraScore: 60, sentiment: 0.1 },
  { name: "Ziro, Arunachal Pradesh", lat: 27.5833, lng: 93.8500, crimeRate: 42, infraScore: 58, sentiment: -0.1 },
  { name: "Itanagar, Arunachal Pradesh", lat: 27.1000, lng: 93.6167, crimeRate: 30, infraScore: 70, sentiment: 0.3 },
  { name: "Tawang, Arunachal Pradesh", lat: 27.3667, lng: 91.6000, crimeRate: 28, infraScore: 75, sentiment: 0.4 },
  { name: "Tezpur, Assam", lat: 26.6333, lng: 92.8000, crimeRate: 35, infraScore: 65, sentiment: 0.3 },
  { name: "Jorhat, Assam", lat: 26.7500, lng: 94.2167, crimeRate: 50, infraScore: 55, sentiment: -0.2 },
  { name: "Majuli, Assam", lat: 27.0000, lng: 94.2167, crimeRate: 45, infraScore: 60, sentiment: 0.0 },
  { name: "Diphu, Assam", lat: 25.8400, lng: 93.4300, crimeRate: 42, infraScore: 62, sentiment: -0.1 },
];

async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI missing in .env");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB Atlas");

  // dynamic import so script runs standalone
  // Ensure model index exists
  await SafetyScore.syncIndexes?.().catch(() => {});

  // wipe + insert
  await SafetyScore.deleteMany({});
  await SafetyScore.insertMany(points.map(p => ({
    name: p.name,
    crimeRate: p.crimeRate,
    infraScore: p.infraScore,
    sentiment: p.sentiment,
    loc: { type: "Point", coordinates: [p.lng, p.lat] },
    timestamp: new Date(),
  })));

  console.log(`✅ Seeded ${points.length} locations into safetyscores`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error("Seed error:", err);
  process.exit(1);
});
