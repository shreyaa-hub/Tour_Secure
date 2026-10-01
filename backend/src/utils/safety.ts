// backend/src/utils/safety.ts

/**
 * Safety score for an area, 0 (least safe) .. 100 (safest).
 *
 * 1. Base score: weighted blend of the area's stored indicators
 *    - crimeRate   0..100 (higher = more crime)   → contributes (100 - crimeRate), weight 0.5
 *    - infraScore  0..100 (lighting, transport…)  → contributes infraScore,        weight 0.3
 *    - sentiment  -1..+1  (community sentiment)   → mapped to 0..100,              weight 0.2
 *
 * 2. Community reviews: if the area has reviews, the review score (0..100, computed in
 *    services/reviews.service.ts) is blended in. Its weight grows with the number of
 *    reviews — count / (count + 3), capped at 0.6 — so one review nudges the score and
 *    many reviews move it substantially, but seeded data always keeps some influence.
 */
export function calculateSafety(
  crimeRate: number,
  infraScore: number,
  sentiment: number,
  reviews?: { score?: number | null; count?: number }
): number {
  const crime = clamp(Number(crimeRate) || 0, 0, 100);
  const infra = clamp(Number(infraScore) || 0, 0, 100);
  const sent = clamp(Number(sentiment) || 0, -1, 1);

  let score = 0.5 * (100 - crime) + 0.3 * infra + 0.2 * ((sent + 1) * 50);

  const count = Number(reviews?.count) || 0;
  const reviewScore = reviews?.score;
  if (count > 0 && typeof reviewScore === "number" && Number.isFinite(reviewScore)) {
    const weight = Math.min(0.6, count / (count + 3));
    score = score * (1 - weight) + clamp(reviewScore, 0, 100) * weight;
  }

  return Math.round(clamp(score, 0, 100));
}

/** Convenience: compute the safety score straight from a SafetyScore document. */
export function safetyOf(doc: any): number {
  return calculateSafety(doc?.crimeRate ?? 50, doc?.infraScore ?? 50, doc?.sentiment ?? 0, {
    score: doc?.reviewScore,
    count: doc?.ratingCount,
  });
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
