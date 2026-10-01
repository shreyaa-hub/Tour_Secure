// backend/src/utils/safety.ts

/**
 * Safety score for an area, 0 (least safe) .. 100 (safest).
 *
 * Weighted blend of the area's stored indicators:
 *   - crimeRate   0..100 (higher = more crime)   → contributes (100 - crimeRate), weight 0.5
 *   - infraScore  0..100 (lighting, transport…)  → contributes infraScore,        weight 0.3
 *   - sentiment  -1..+1  (community sentiment)   → mapped to 0..100,              weight 0.2
 */
export function calculateSafety(crimeRate: number, infraScore: number, sentiment: number): number {
  const crime = clamp(Number(crimeRate) || 0, 0, 100);
  const infra = clamp(Number(infraScore) || 0, 0, 100);
  const sent = clamp(Number(sentiment) || 0, -1, 1);

  const score = 0.5 * (100 - crime) + 0.3 * infra + 0.2 * ((sent + 1) * 50);
  return Math.round(clamp(score, 0, 100));
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
