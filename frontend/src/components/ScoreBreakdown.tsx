// Shows how an area's safety score is made up (see backend/src/utils/safety.ts).
export type Breakdown = {
  crimeRate: number;     // 0..100, higher = more crime
  infraScore: number;    // 0..100
  sentiment: number;     // -1..+1
  baseScore: number;     // score from the three indicators above
  reviewCount: number;
  reviewAverage: number | null;
  reviewScore: number | null;
  reviewWeight: number;  // % of the final score that comes from reviews
};

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-neutral-600">{label}</span>
      <span className="font-medium text-right">
        {value}
        {hint ? <span className="ml-1 text-xs font-normal text-neutral-500">{hint}</span> : null}
      </span>
    </div>
  );
}

export default function ScoreBreakdown({ score, breakdown }: { score: number; breakdown?: Breakdown | null }) {
  if (!breakdown) return null;
  const b = breakdown;
  const sentimentLabel = b.sentiment > 0.2 ? "positive" : b.sentiment < -0.2 ? "negative" : "neutral";
  return (
    <div className="text-xs space-y-1 min-w-[220px]">
      <Row label="Crime level" value={`${b.crimeRate}/100`} hint="lower is better" />
      <Row label="Infrastructure" value={`${b.infraScore}/100`} hint="lighting, transport" />
      <Row label="Local sentiment" value={sentimentLabel} />
      <Row label="Score from local data" value={`${b.baseScore}`} />
      <Row
        label="Traveller reviews"
        value={b.reviewCount ? `${b.reviewAverage}★ (${b.reviewCount})` : "none yet"}
        hint={b.reviewWeight ? `${b.reviewWeight}% of score` : undefined}
      />
      <div className="pt-1 mt-1 border-t flex justify-between font-semibold">
        <span>Safety score</span>
        <span>{score}/100</span>
      </div>
    </div>
  );
}
