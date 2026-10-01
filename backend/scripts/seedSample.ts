// backend/scripts/seedSample.ts
// Adds sample activity so every page has something to show: reviews (which also
// update area safety scores), e-FIR reports and SOS alerts. All content is sample data.
//
// Usage (after seed:safety and seed:demo):
//   npm run seed:sample
//
// e-FIRs and SOS alerts belong to SAMPLE_USER_EMAIL (set it in .env to your own
// account so they appear under "Your reports"). Reviews come from that user plus a
// few sample travellers. Safe to re-run: records that already exist are skipped.
import "dotenv/config";
import crypto from "crypto";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../src/models/User";
import Review from "../src/models/Review";
import Efir from "../src/models/efir.model";
import Alert from "../src/models/Alert";
import SafetyScore from "../src/models/SafetyScore";
import { recomputeAreaFromReviews } from "../src/services/reviews.service";
import { looseNamePattern } from "../src/utils/search";

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (d: number, hour = 18) => {
  const t = new Date(Date.now() - d * DAY);
  t.setHours(hour, 15, 0, 0);
  return t;
};

// Sample travellers who wrote reviews (they cannot log in: random passwords)
const travellers = [
  { key: "ananya", name: "Ananya R.", email: "ananya.sample@toursecure.test" },
  { key: "rahul", name: "Rahul M.", email: "rahul.sample@toursecure.test" },
  { key: "meera", name: "Meera K.", email: "meera.sample@toursecure.test" },
];

// who: "me" = SAMPLE_USER_EMAIL, otherwise a traveller key
const reviews = [
  { who: "me", place: "T Nagar", rating: 2, text: "Very crowded in the evening, watch your bag near the bus stand.", days: 2 },
  { who: "rahul", place: "T Nagar", rating: 3, text: "Busy but okay during the day. Lots of police around Ranganathan Street.", days: 9 },
  { who: "me", place: "Adyar", rating: 5, text: "Safe and well lit, felt comfortable walking at night.", days: 3 },
  { who: "meera", place: "Mylapore", rating: 5, text: "Peaceful area around the temple, friendly shopkeepers.", days: 12 },
  { who: "me", place: "Marina Beach", rating: 3, text: "Fine in the day, poorly lit stretches after 9 pm.", days: 5 },
  { who: "ananya", place: "Chennai Central", rating: 2, text: "Touts outside the station at night, use prepaid autos.", days: 6 },
  { who: "rahul", place: "Velachery", rating: 4, text: "Good roads and the mall area feels safe.", days: 15 },
  { who: "meera", place: "Mahabalipuram", rating: 5, text: "Calm, tourist police near the Shore Temple.", days: 20 },
  { who: "me", place: "Shillong", rating: 4, text: "Friendly locals, regular police patrols near Police Bazar.", days: 25 },
  { who: "ananya", place: "Guwahati", rating: 3, text: "Okay overall, avoid the railway station area late at night.", days: 18 },
  { who: "rahul", place: "Gangtok", rating: 5, text: "Very safe and clean, MG Marg is great in the evening.", days: 30 },
  { who: "meera", place: "Dimapur", rating: 2, text: "Felt unsafe near the market after dark.", days: 22 },
];

const efirs = [
  {
    summary: "Phone stolen near T Nagar bus stand around 7 pm. Black Samsung phone with a blue cover.",
    location: { lat: 13.0418, lng: 80.2341 }, status: "Pending", days: 2,
  },
  {
    summary: "Auto driver from Chennai Central demanded ₹800 for a ₹150 trip and refused to stop until I paid.",
    location: { lat: 13.0827, lng: 80.2757 }, status: "Pending", days: 6,
  },
  {
    summary: "Wallet lost on the Marina Beach promenade. Contained a driving licence and two bank cards.",
    location: { lat: 13.05, lng: 80.2824 }, status: "Closed", days: 14,
  },
] as const;

const alerts = [
  { lat: 13.0835, lon: 80.2749, source: "gps", days: 1 },
  { lat: 13.0425, lon: 80.2338, source: "gps", days: 4 },
];

async function findArea(place: string) {
  const q = looseNamePattern(place);
  return (
    (await SafetyScore.findOne({ name: { $regex: `^${q}$`, $options: "i" } })) ||
    (await SafetyScore.findOne({ name: { $regex: `^${q}`, $options: "i" } })) ||
    (await SafetyScore.findOne({ name: { $regex: q, $options: "i" } }))
  );
}

async function ensureUser(name: string, email: string, password?: string) {
  const existing = await User.findOne({ email });
  if (existing) return { user: existing, created: false, password: undefined as string | undefined };
  const pw = password || crypto.randomBytes(12).toString("base64url");
  const user = await User.create({ name, email, password: await bcrypt.hash(pw, 10), role: "user" });
  return { user, created: true, password: password ? undefined : pw };
}

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGO_URL || process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGO_URI missing in .env");
  await mongoose.connect(uri);

  if ((await SafetyScore.countDocuments()) === 0) {
    throw new Error("No safety areas found. Run `npm run seed:safety` and `npm run seed:demo` first.");
  }

  // The account that owns the sample e-FIRs and SOS alerts
  const meEmail = (process.env.SAMPLE_USER_EMAIL || "traveller@toursecure.test").toLowerCase().trim();
  const me = await ensureUser("Sample Traveller", meEmail, process.env.SAMPLE_USER_PASSWORD);
  if (me.created) {
    console.log(`Created user ${meEmail}` + (me.password ? ` with password: ${me.password}` : ""));
  }
  const people: Record<string, any> = { me: me.user };
  for (const t of travellers) people[t.key] = (await ensureUser(t.name, t.email)).user;

  // Reviews
  let added = 0;
  const touched = new Set<string>();
  for (const r of reviews) {
    const author = people[r.who];
    const area = await findArea(r.place);
    const areaName = area?.name ?? r.place;
    if (await Review.exists({ userId: author._id, areaName, text: r.text })) continue;
    await Review.create(
      [{
        rating: r.rating, text: r.text, areaId: area?._id ?? null, areaName,
        userId: author._id, userName: author.name,
        createdAt: daysAgo(r.days), updatedAt: daysAgo(r.days),
      }],
      { timestamps: false }
    );
    added++;
    if (area) touched.add(String(area._id));
  }
  for (const id of touched) await recomputeAreaFromReviews(id);
  console.log(`Reviews: added ${added} (${reviews.length - added} already existed); updated ${touched.size} area scores`);

  // e-FIRs
  added = 0;
  for (const e of efirs) {
    if (await Efir.exists({ user: me.user._id, summary: e.summary })) continue;
    await Efir.create(
      [{
        name: me.user.name, contact: me.user.email, summary: e.summary, attachments: [],
        location: e.location, status: e.status, user: me.user._id,
        createdAt: daysAgo(e.days, 19), updatedAt: daysAgo(e.days, 19),
      }],
      { timestamps: false }
    );
    added++;
  }
  console.log(`e-FIR reports: added ${added} (${efirs.length - added} already existed) for ${meEmail}`);

  // SOS alerts
  added = 0;
  for (const a of alerts) {
    if (await Alert.exists({ userId: me.user._id, lat: a.lat, lon: a.lon })) continue;
    await Alert.create(
      [{
        userId: me.user._id, lat: a.lat, lon: a.lon, meta: { locationSource: a.source },
        createdAt: daysAgo(a.days, 21), updatedAt: daysAgo(a.days, 21),
      }],
      { timestamps: false }
    );
    added++;
  }
  console.log(`SOS alerts: added ${added} (${alerts.length - added} already existed) for ${meEmail}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Seed error:", err.message || err);
  process.exit(1);
});
