// frontend/src/pages/Reviews.tsx
import { useEffect, useMemo, useState } from "react";
import { http } from "@/lib/http";

import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Select from "@/components/ui/Select";
import Loading from "@/components/ui/Loading";
import Badge from "@/components/ui/Badge";
import SafetyScoreCard from "@/components/SafetyScoreCard"; // keep if you use it elsewhere on this page
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";

/* ---------- types ---------- */
type Review = {
  _id: string;
  place: string;           // normalized name for UI
  rating: number;          // 1..5
  comment?: string;
  createdAt: string;
  userName?: string | null; // NEW: author display name
};

/* ---------- helpers (normalize API → UI) ---------- */
function toReviewUI(raw: any): Review | null {
  if (!raw) return null;

  const id = raw._id || raw.id;

  const place =
    raw.placeName ||
    raw.areaName ||
    raw.place ||
    raw?.area?.name ||
    "—";

  const createdAt =
    raw.createdAt ||
    raw.created_at ||
    new Date().toISOString();

  const comment =
    raw.comment ??
    raw.text ??
    raw.review ??
    "";

  const rating = Number(raw.rating ?? raw.value ?? raw.stars);

  // NEW: prefer backend's denormalized userName; fall back to nested user object if present
  const userName: string | null =
    (typeof raw.userName === "string" && raw.userName) ||
    (raw.user && (raw.user.name || raw.user.email)) ||
    null;

  if (!id || !Number.isFinite(rating)) return null;

  return {
    _id: String(id),
    place: String(place),
    rating,
    comment: comment ? String(comment) : "",
    createdAt: new Date(createdAt).toISOString(),
    userName,
  };
}

/* ---------- api helpers ---------- */
async function fetchReviews(): Promise<Review[]> {
  // IMPORTANT: baseURL already has /api, so use "/reviews"
  const { data } = await http.get("/reviews");

  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.reviews)
    ? data.reviews
    : Array.isArray(data?.items)
    ? data.items
    : [];

  const mapped = (list as any[]).map(toReviewUI).filter(Boolean) as Review[];

  return mapped.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

async function createReview(input: { place: string; rating: number; comment?: string }) {
  // IMPORTANT: baseURL already has /api, so use "/reviews"
  const { data } = await http.post("/reviews", {
    areaName: input.place,
    rating: input.rating,
    text: input.comment,
  });

  const raw = data?.review ?? data;
  // `area` is the matched safety-score area (null if the place is not a known area)
  const area = data?.area as
    | { name: string; safety_score: number; previous_safety_score: number | null }
    | null
    | undefined;
  return { review: toReviewUI(raw), area: area ?? null };
}

/* ---------- rating stars input ---------- */
function StarInput({
  value,
  onChange,
  size = 22,
  readOnly = false,
}: {
  value: number;
  onChange: (n: number) => void;
  size?: number;
  readOnly?: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={filled}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => !readOnly && onChange(n)}
            disabled={readOnly}
            className={`transition ${filled ? "text-yellow-500" : "text-neutral-300 hover:text-neutral-400"} ${readOnly ? "cursor-default" : ""}`}
          >
            <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M10 15.27l-5.18 3.05 1.64-5.64L1 8.97l5.91-.5L10 3l3.09 5.47 5.91.5-5.46 3.71 1.64 5.64L10 15.27z" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- rating badge ---------- */
function RatingBadge({ rating }: { rating: number }) {
  const tone = rating >= 4 ? "success" : rating === 3 ? "warning" : "danger";
  return <Badge tone={tone}>{rating}/5</Badge>;
}

/* ---------- page ---------- */
export default function Reviews() {
  const { notify } = useToast();
  const { user } = useAuth();

  // list state
  const [items, setItems] = useState<Review[] | null>(null);
  const [loading, setLoading] = useState(true);

  // form state
  const [place, setPlace] = useState("");
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // filters/sort
  const [minStars, setMinStars] = useState<0 | 1 | 2 | 3 | 4 | 5>(0);
  const [search, setSearch] = useState("");

  // pagination
  const [page, setPage] = useState(1);
  const pageSize = 6;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const list = await fetchReviews();
        if (!alive) return;
        setItems(list);
      } catch (e: any) {
        notify({ tone: "error", message: e?.message ?? "Failed to load reviews" });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [notify]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (items ?? [])
      .filter((r) => r.rating >= minStars)
      .filter((r) =>
        q ? r.place.toLowerCase().includes(q) || r.comment?.toLowerCase().includes(q) : true
      );
  }, [items, minStars, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!user) {
      notify({ tone: "warning", message: "Please login to submit a review." });
      return;
    }

    if (!place.trim()) {
      notify({ tone: "warning", message: "Place is required." });
      return;
    }
    try {
      setSubmitting(true);
      const { review: created, area } = await createReview({
        place: place.trim(),
        rating,
        comment: comment.trim() || undefined,
      });

      if (created) {
        setItems((s) => [created, ...(s ?? [])]); // optimistic add
      }

      setPlace("");
      setRating(5);
      setComment("");
      setPage(1);
      notify({
        tone: "success",
        title: "Thanks! Your review has been added.",
        message: area
          ? area.previous_safety_score != null && area.previous_safety_score !== area.safety_score
            ? `${area.name} safety score: ${area.previous_safety_score} → ${area.safety_score}/100`
            : `${area.name} safety score: ${area.safety_score}/100`
          : `"${place.trim()}" isn't a known area yet, so no safety score changed.`,
      });
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || "Failed to submit review";
      notify({ tone: "error", message: msg });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <h1 className="page-title">Reviews</h1>

      <div className="grid gap-6 md:grid-cols-3 mt-6">
        {/* form */}
        <Card className="md:col-span-1">
          <CardHeader title="Add Review" />
          <CardBody>
            <form onSubmit={onSubmit} className="space-y-4">
              <Input
                placeholder="Place"
                value={place}
                onChange={(e) => setPlace(e.target.value)}
                required
              />

              <div className="space-y-1">
                <div className="text-xs text-neutral-500">Rating</div>
                <StarInput value={rating} onChange={setRating} />
              </div>

              <Textarea
                placeholder="Comment (optional)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />

              <Button type="submit" disabled={submitting || !user}>
                {submitting ? "Submitting…" : user ? "Submit" : "Login to submit"}
              </Button>

              {!user && (
                <div className="text-xs text-neutral-500">
                  You must be logged in to post a review.
                </div>
              )}
            </form>
          </CardBody>
        </Card>

        {/* list + filters */}
        <Card className="md:col-span-2">
          <CardHeader title="Recent Reviews" />
          <CardBody>
            {/* filters */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <Input
                className="w-56"
                placeholder="Search place or text…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
              <Select
                value={String(minStars)}
                onChange={(e) => {
                  setMinStars(Number(e.target.value) as any);
                  setPage(1);
                }}
              >
                <option value="0">All ratings</option>
                <option value="5">5★ only</option>
                <option value="4">≥ 4★</option>
                <option value="3">≥ 3★</option>
                <option value="2">≥ 2★</option>
                <option value="1">≥ 1★</option>
              </Select>
            </div>

            {loading ? (
              <Loading />
            ) : filtered.length === 0 ? (
              <div className="text-sm text-neutral-600">
                {items && items.length > 0 ? "No reviews match your search or rating filter." : "No reviews yet."}
              </div>
            ) : (
              <>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {pageItems.map((r) => (
                    <li key={r._id} className="border rounded-xl p-4 bg-white">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{r.place || "—"}</div>
                          <div className="text-xs text-neutral-500">
                            {/* NEW: show author name if present */}
                            {r.userName ? (
                              <>
                                by <span className="font-medium">{r.userName}</span> ·{" "}
                              </>
                            ) : null}
                            {new Date(r.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <RatingBadge rating={r.rating} />
                          <div className="mt-1">
                            {/* read-only stars */}
                            <StarInput value={r.rating} onChange={() => {}} size={16} readOnly />
                          </div>
                        </div>
                      </div>
                      {r.comment ? (
                        <p className="mt-3 text-sm text-neutral-700 whitespace-pre-wrap break-words">
                          {r.comment}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>

                {/* pagination */}
                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-xs text-neutral-500">
                      Page {page} of {totalPages} • {filtered.length} total
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        disabled={page === 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        Prev
                      </Button>
                      <Button
                        variant="outline"
                        disabled={page === totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
