import { useEffect, useMemo, useState } from "react";
import { listZones, createZone, checkPoint } from "@services/geofencing/geo";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import Badge from "@/components/ui/Badge";
import Loading from "@/components/ui/Loading";
import { useToast } from "@/components/ui/Toast";
import { MapPin } from "lucide-react";
import SafetyHeatmap from "@/components/SafetyHeatmap";
import { useAuth } from "@/context/AuthContext";

type RiskLevel = "low" | "medium" | "high";
type Zone = {
  _id: string;
  name: string;
  riskLevel: RiskLevel;
  riskScore: number;
  polygon: { type: "Polygon"; coordinates: [number, number][][] };
};

export default function Heatmap() {
  const { notify } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // lists
  const [zones, setZones] = useState<Zone[]>([]);
  const [loadingZones, setLoadingZones] = useState(true);

  // check
  const [lat, setLat] = useState<number>(13.09);
  const [lng, setLng] = useState<number>(80.28);
  const [checkMsg, setCheckMsg] = useState<string>("");
  const [checkTone, setCheckTone] = useState<RiskLevel | "info">("info");
  const [checking, setChecking] = useState(false);

  // create zone
  const [name, setName] = useState("");
  const [riskLevel, setRiskLevel] = useState<RiskLevel>("medium");
  const [riskScore, setRiskScore] = useState(50);
  const [coords, setCoords] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingZones(true);
        const data = await listZones();
        if (!alive) return;
        setZones(data as any);
      } catch (e: any) {
        notify({ tone: "error", message: e?.message ?? "Failed to load zones" });
      } finally {
        if (alive) setLoadingZones(false);
      }
    })();
    return () => { alive = false; };
  }, [notify]);

  function parseNum(v: string): number | null {
    if (v === "") return null;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }

  function buildRing(input: string): [number, number][] {
    const parts = input.split(";").map(s => s.trim()).filter(Boolean);
    const ring: [number, number][] = [];
    for (const p of parts) {
      const [lngStr, latStr] = p.split(",").map(s => (s || "").trim());
      const x = parseNum(lngStr ?? ""), y = parseNum(latStr ?? "");
      if (x === null || y === null) throw new Error(`Invalid pair: "${p}". Use "lng,lat;lng,lat;..."`);
      ring.push([x, y]);
    }
    if (ring.length < 3) throw new Error("Polygon needs at least 3 coordinate pairs.");
    const [fx, fy] = ring[0], [lx, ly] = ring[ring.length - 1];
    if (fx !== lx || fy !== ly) ring.push([fx, fy]); // close
    return ring;
  }

  async function onCheck() {
    try {
      setChecking(true);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error("Lat/Lng required.");
      const res = await checkPoint(lat, lng);
      if (!res) throw new Error("No response");
      const level = (res.riskLevel ?? "low") as RiskLevel;
      setCheckMsg(
        res.inside
          ? `Inside zone: ${level.toUpperCase()} (score ${res.riskScore ?? "?"})`
          : "Outside zones"
      );
      setCheckTone(res.inside ? level : "info");
    } catch (e: any) {
      setCheckMsg(`Error: ${e?.message ?? "check failed"}`);
      setCheckTone("info");
    } finally {
      setChecking(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      notify({ tone: "warning", message: "Geolocation not supported in this browser." });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => { setLat(pos.coords.latitude); setLng(pos.coords.longitude); },
      err => notify({ tone: "error", message: err.message })
    );
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      setCreating(true);
      if (!name.trim()) throw new Error("Name is required.");
      const ring = buildRing(coords);
      const band = Math.max(0, Math.min(100, riskScore));
      const z = await createZone({
        name: name.trim(),
        riskLevel,
        riskScore: band,
        polygon: { type: "Polygon", coordinates: [ring] },
      });
      setZones(s => [z as any, ...s]);
      setName(""); setCoords(""); setRiskLevel("medium"); setRiskScore(50);
      notify({ tone: "success", title: "Zone added", message: "New zone created successfully." });
    } catch (e: any) {
      notify({ tone: "error", message: e?.message ?? "Failed to create zone" });
    } finally {
      setCreating(false);
    }
  }

  // Nearby (Top 5) by centroid distance from current point
  const nearest = useMemo(() => {
    if (!zones?.length) return [];
    return zones
      .map(z => {
        const ring = z.polygon?.coordinates?.[0] || [];
        const c = centroidFromRing(ring);
        const d = haversine(lat, lng, c.lat, c.lng);
        return { ...z, _distKm: d, _centroid: c };
      })
      .sort((a, b) => a._distKm - b._distKm)
      .slice(0, 5);
  }, [zones, lat, lng]);

  function toneClass(level: RiskLevel) {
    return level === "high" ? "text-red-600"
      : level === "medium" ? "text-yellow-600"
      : "text-emerald-600";
  }

  function badgeTone(level: RiskLevel) {
    return level === "high" ? "danger"
      : level === "medium" ? "warning"
      : "success";
  }

  function generateSquare(centerLat: number, centerLng: number, meters = 300): string {
    // naive local square ~ meters around center (not geodesic-accurate but fine for admin demo)
    const d = meters / 111320; // deg per meter approx for lat
    const dx = d, dy = d / Math.cos(centerLat * Math.PI / 180); // adjust lon by latitude
    const pts = [
      [centerLng - dy, centerLat - dx],
      [centerLng + dy, centerLat - dx],
      [centerLng + dy, centerLat + dx],
      [centerLng - dy, centerLat + dx],
      [centerLng - dy, centerLat - dx],
    ];
    return pts.map(p => `${p[0].toFixed(6)},${p[1].toFixed(6)}`).join(";");
    // returns "lng,lat;lng,lat;..."
  }

  return (
    <>
      <h1 className="page-title">Heatmap</h1>

      {/* ✅ NEW: AI Safety Score Heat Map (GPS + Search) */}
      <div className="mt-6">
        <div className="section-title mb-2">Safety Score Heat Map</div>
        <SafetyHeatmap />
      </div>

      <div className="grid gap-6 md:grid-cols-2 mt-6">
        {/* Check card */}
        <Card>
          <CardHeader title="Check Risk at a Point" />
          <CardBody>
            <div className="flex flex-wrap gap-3 items-center">
              <Input
                className="w-40"
                type="number" step="0.0001"
                value={Number.isFinite(lat) ? lat : "" as any}
                onChange={e => setLat(parseNum(e.target.value) ?? NaN)}
                placeholder="lat"
              />
              <Input
                className="w-40"
                type="number" step="0.0001"
                value={Number.isFinite(lng) ? lng : "" as any}
                onChange={e => setLng(parseNum(e.target.value) ?? NaN)}
                placeholder="lng"
              />
              <Button onClick={onCheck} disabled={checking}>Check</Button>
              <Button variant="outline" onClick={useMyLocation}>
                <MapPin size={16} className="mr-1" /> Use my location
              </Button>
            </div>

            <div className="mt-4">
              {checking ? (
                <Loading label="Checking…" />
              ) : checkMsg ? (
                <div className="flex items-center gap-2 text-sm">
                  <Badge tone={checkTone === "high" ? "danger" : checkTone === "medium" ? "warning" : checkTone === "low" ? "success" : "neutral"}>
                    {checkTone === "info" ? "INFO" : String(checkTone).toUpperCase()}
                  </Badge>
                  <span className={checkTone !== "info" ? toneClass(checkTone as RiskLevel) : "text-neutral-700"}>
                    {checkMsg}
                  </span>
                </div>
              ) : (
                <div className="text-sm text-neutral-600">Enter coordinates and press Check.</div>
              )}
            </div>

            {/* Nearest zones */}
            <div className="mt-6">
              <div className="section-title mb-2">Nearby Zones (Top 5)</div>
              {loadingZones ? (
                <Loading />
              ) : nearest.length === 0 ? (
                <div className="text-sm text-neutral-600">No zones found.</div>
              ) : (
                <ul className="divide-y">
                  {nearest.map(z => (
                    <li key={z._id} className="py-3 flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{z.name}</div>
                        <div className="text-xs text-neutral-500">
                          {z._distKm.toFixed(2)} km away
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-sm ${toneClass(z.riskLevel)}`}>{z.riskLevel.toUpperCase()}</span>
                        <span className="text-sm text-neutral-600">Score: {z.riskScore}</span>
                        <Button
                          variant="outline"
                          onClick={() => { setLat(z._centroid.lat); setLng(z._centroid.lng); }}
                          title="Center check point to this zone"
                        >
                          Center here
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Create zone (admin only — also enforced by the API) */}
        <Card>
          <CardHeader title="Add Zone (Admin)" />
          <CardBody>
            {!isAdmin ? (
              <p className="text-sm text-neutral-600">
                Only administrators can define risk zones. Log in with an admin account to add one.
              </p>
            ) : (
            <form onSubmit={onCreate} className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Input className="w-56" placeholder="Name" value={name} onChange={e => setName(e.target.value)} required />
                <Select value={riskLevel} onChange={e => setRiskLevel(e.target.value as RiskLevel)}>
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </Select>
                <Input className="w-28" type="number" min={0} max={100} value={riskScore}
                       onChange={e => setRiskScore(parseInt(e.target.value || "0", 10))} />
              </div>

              <Textarea
                className="h-24"
                placeholder="lng,lat;lng,lat;... (first=last optional; will auto-close)"
                value={coords}
                onChange={e => setCoords(e.target.value)}
                required
              />

              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={creating}>{creating ? "Saving…" : "Create"}</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCoords(generateSquare(lat, lng, 400))}
                  title="Create a quick square around current point"
                >
                  Generate square @ point
                </Button>
              </div>

              <p className="text-xs text-neutral-500">
                Tip: format is <code>lng,lat;lng,lat;…</code>. Use “Generate square” to get a valid polygon fast.
              </p>
            </form>
            )}
          </CardBody>
        </Card>
      </div>

      {/* All zones */}
      <Card className="mt-6">
        <CardHeader title="All Zones" />
        <CardBody>
          {loadingZones ? (
            <Loading />
          ) : zones.length === 0 ? (
            <div className="text-sm text-neutral-600">No zones yet.</div>
          ) : (
            <ul className="grid md:grid-cols-2 gap-3">
              {zones.map((z) => (
                <li key={z._id} className="border rounded-xl p-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{z.name}</div>
                    <div className="text-xs text-neutral-500">
                      {z.polygon?.coordinates?.[0]?.length ?? 0} points
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge tone={badgeTone(z.riskLevel)}>{z.riskLevel}</Badge>
                    <div className="text-xs text-neutral-500">Score {z.riskScore}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </>
  );
}

/* ---------- helpers ---------- */

function centroidFromRing(ring: [number, number][]) {
  if (!ring?.length) return { lat: 0, lng: 0 };
  let sx = 0, sy = 0, n = 0;
  for (const [lng, lat] of ring) {
    if (Number.isFinite(lat) && Number.isFinite(lng)) { sx += lng; sy += lat; n++; }
  }
  return { lat: sy / Math.max(1, n), lng: sx / Math.max(1, n) };
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
