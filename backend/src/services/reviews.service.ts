import mongoose from "mongoose";
import Review from "../models/Review";
import SafetyScore from "../models/SafetyScore";

/**
 * Advanced algorithm:
 * - More weight to recent reviews
 * - Sentiment boost from text
 * - Confidence grows with number of reviews
 * - Trend (improving / declining / stable)
 */
export async function recomputeAreaFromReviews(areaKey: string) {
  const key = String(areaKey || "").trim();
  if (!key) return;

  // Find area by id or by name
  const area = mongoose.isValidObjectId(key)
    ? await SafetyScore.findById(key)
    : await SafetyScore.findOne({ name: { $regex: `^${escapeRegex(key)}$`, $options: "i" } });

  if (!area) return;

  const reviews = await Review.find({
    $or: [{ areaId: area._id }, { areaName: { $regex: `^${escapeRegex(area.name)}$`, $options: "i" } }],
  }).sort({ createdAt: -1 }).lean();

  if (!reviews.length) {
    await SafetyScore.updateOne(
      { _id: area._id },
      { $set: { score: 50, confidence: 0, trend: "stable", ratingCount: 0, ratingSum: 0 } }
    );
    return;
  }

  const now = Date.now();
  let weightedSum = 0;
  let weightTotal = 0;

  for (const r of reviews) {
    const ageDays = (now - new Date(r.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    const recencyWeight = Math.max(0.3, 1 - ageDays / 180); // 6 months decay

    // Keyword sentiment boost from text (negative wins; word boundaries so "unsafe" ≠ "safe")
    const text = (r.text ?? "").toLowerCase();
    let sentimentBoost = 0;
    if (/\b(good|safe|secure)\b/.test(text)) sentimentBoost = +0.2;
    if (/\b(bad|unsafe|danger|dangerous)\b/.test(text)) sentimentBoost = -0.5;

    weightedSum += (r.rating + sentimentBoost) * recencyWeight;
    weightTotal += recencyWeight;
  }

  const avgRating = weightedSum / weightTotal; // 1..5
  const score = Math.max(0, Math.min(100, (avgRating - 1) / 4 * 100));

  // Confidence: grows with number of reviews
  const confidence = Math.min(1, Math.log10(reviews.length + 1) / 2);

  // Trend detection (compare last 30d vs older)
  const recent = reviews.filter(r => (now - new Date(r.createdAt).getTime()) < 30 * 86400000);
  const old = reviews.filter(r => (now - new Date(r.createdAt).getTime()) >= 30 * 86400000);
  const recentAvg = recent.reduce((a, r) => a + r.rating, 0) / (recent.length || 1);
  const oldAvg = old.reduce((a, r) => a + r.rating, 0) / (old.length || 1);
  let trend: "improving" | "declining" | "stable" = "stable";
  if (recentAvg > oldAvg + 0.5) trend = "improving";
  else if (recentAvg < oldAvg - 0.5) trend = "declining";

  // Update SafetyScore doc
  await SafetyScore.updateOne(
    { _id: area._id },
    {
      $set: {
        ratingCount: reviews.length,
        ratingSum: reviews.reduce((a, r) => a + r.rating, 0),
        score,
        confidence,
        trend,
        reviewUpdatedAt: new Date(),
      },
    }
  );
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
