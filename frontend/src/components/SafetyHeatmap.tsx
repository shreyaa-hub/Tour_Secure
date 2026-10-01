import {
  MapContainer,
  TileLayer,
  useMap,
  CircleMarker,
  Polygon,
  Popup,
} from "react-leaflet";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import { API_BASE } from "@/lib/api";
import { listZones, type Zone } from "@services/geofencing/geo";
import ScoreBreakdown, { type Breakdown } from "@/components/ScoreBreakdown";

type ScorePoint = { name?: string; lat: number; lng: number; safety_score: number; breakdown?: Breakdown };

const ZONE_COLORS: Record<string, string> = { high: "#dc2626", medium: "#d97706", low: "#059669" };

const API = API_BASE;
// Search radius for the location-based query. The seeded dataset covers North-East India.
const RADIUS_KM = 200;

/* ---------------- Heat layer ---------------- */
function HeatLayer({ points }: { points: ScorePoint[] }) {
  const map = useMap();
  const layerRef = useRef<any>(null);

  const tuples = useMemo(
    () => points.map((p) => [p.lat, p.lng, (100 - p.safety_score) / 100]), // lower safety = hotter
    [points]
  );

  useEffect(() => {
    (async () => {
      const L = (await import("leaflet")).default as any;
      // @ts-ignore
      await import("leaflet.heat");

      if (layerRef.current) {
        map.removeLayer(layerRef.current);
      }
      // weight = (100 - score) / 100, so less-safe areas glow hotter.
      // leaflet.heat divides intensity by 2^(maxZoom - zoom); maxZoom 6 keeps
      // full intensity at the regional zoom levels this map uses (6-12).
      // `max: 0.6` makes a score of 40 or lower render fully red.
      layerRef.current = L.heatLayer(tuples, {
        radius: 35,
        blur: 20,
        maxZoom: 6,
        max: 0.6,
      }).addTo(map);
    })();

    return () => {
      if (layerRef.current) map.removeLayer(layerRef.current);
    };
  }, [map, tuples]);

  return null;
}

/* ---------------- Keep the map centred on `center` ----------------
 * MapContainer only reads its `center` prop on first render, so later
 * changes (GPS fix, search result) must be applied imperatively. */
function Recenter({ center, zoom }: { center: [number, number]; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom ?? map.getZoom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, center]);
  return null;
}

/* ---------------- Zoom to a set of points ----------------
 * Used when there is no data near the user: show where the data actually is. */
function FitToPoints({ points }: { points: [number, number][] | null }) {
  const map = useMap();
  useEffect(() => {
    if (points && points.length) map.fitBounds(points, { padding: [40, 40], maxZoom: 10 });
  }, [map, points]);
  return null;
}

/* ---------------- Area markers (optional) ---------------- */
function scoreColor(score: number) {
  if (score >= 80) return "#1a9850"; // green
  if (score >= 60) return "#66bd63";
  if (score >= 40) return "#fee08b";
  if (score >= 20) return "#f46d43";
  return "#d73027"; // red
}

function AreaMarkers({ points, show }: { points: ScorePoint[]; show: boolean }) {
  if (!show) return null;
  return (
    <>
      {points.map((p, idx) => (
        <CircleMarker
          key={`${p.lat}-${p.lng}-${idx}`}
          center={[p.lat, p.lng]}
          radius={7}
          pathOptions={{ color: "#333", fillColor: scoreColor(p.safety_score), fillOpacity: 0.9, weight: 1 }}
        >
          <Popup>
            <div className="font-semibold mb-2">{p.name || "Unnamed area"}</div>
            <ScoreBreakdown score={p.safety_score} breakdown={p.breakdown} />
          </Popup>
        </CircleMarker>
      ))}
    </>
  );
}

/* ---------------- Risk zones (polygons from the database) ---------------- */
function ZoneLayer({ zones, show }: { zones: Zone[]; show: boolean }) {
  if (!show) return null;
  return (
    <>
      {zones.map((z) => {
        const ring = z.polygon?.coordinates?.[0] ?? [];
        const positions = ring.map(([lng, lat]) => [lat, lng] as [number, number]); // GeoJSON is [lng, lat]
        const color = ZONE_COLORS[z.riskLevel] ?? "#6b7280";
        return (
          <Polygon key={z._id} positions={positions} pathOptions={{ color, weight: 2, fillColor: color, fillOpacity: 0.25 }}>
            <Popup>
              <div className="font-semibold">{z.name}</div>
              <div className="text-xs mt-1" style={{ color }}>
                {z.riskLevel.charAt(0).toUpperCase() + z.riskLevel.slice(1)} risk · score {z.riskScore}/100
              </div>
              {z.description ? <div className="text-xs mt-1 text-neutral-600">{z.description}</div> : null}
            </Popup>
          </Polygon>
        );
      })}
    </>
  );
}

/* ---------------- Main component ---------------- */
export default function SafetyHeatmap() {
  const [center, setCenter] = useState<[number, number]>([26.1445, 91.7362]); // default: Guwahati
  const [points, setPoints] = useState<ScorePoint[]>([]);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ScorePoint | null>(null);

  // user's position (null until the browser grants and returns a fix)
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const [status, setStatus] = useState("Finding your location…");

  const [showDebug, setShowDebug] = useState(false);
  const [zones, setZones] = useState<Zone[]>([]);
  const [showZones, setShowZones] = useState(true);

  // Risk zones are drawn on top of the heatmap
  useEffect(() => {
    listZones().then(setZones).catch(() => setZones([]));
  }, []);

  // Bounds to zoom to when falling back to all areas (done once, so refreshes don't move the map)
  const [fitTo, setFitTo] = useState<[number, number][] | null>(null);
  const fittedOnce = useRef(false);

  // Load scores near the user (MongoDB $near), or every area if we have no location.
  // `v` is a cache-buster so refreshes always hit the server.
  const loadData = useCallback(async () => {
    try {
      const c = coordsRef.current;
      const v = Date.now();
      if (c) {
        const r = await fetch(`${API}/safety-scores/nearby?lat=${c.lat}&lng=${c.lng}&radius=${RADIUS_KM}&v=${v}`);
        const data = await r.json();
        if (Array.isArray(data) && data.length > 0) {
          setPoints(data);
          setStatus(`${data.length} areas within ${RADIUS_KM} km of you`);
          return;
        }
      }
      const r = await fetch(`${API}/safety-scores?v=${v}`);
      const data = await r.json();
      const all: ScorePoint[] = Array.isArray(data) ? data : [];
      setPoints(all);
      if (all.length && !fittedOnce.current) {
        fittedOnce.current = true;
        setFitTo(all.map((p) => [p.lat, p.lng] as [number, number]));
      }
      setStatus(
        c
          ? `No areas within ${RADIUS_KM} km of you. Showing all ${all.length} areas.`
          : `Location is off. Showing all ${all.length} areas.`
      );
    } catch {
      setStatus("Couldn't load safety data. Try Refresh.");
    }
  }, []);

  // Initial load: ask for the user's location once, then load nearby (or all) areas
  useEffect(() => {
    if (!navigator.geolocation) {
      loadData();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        coordsRef.current = here;
        setUserPos(here);
        setCenter([here.lat, here.lng]);
        loadData();
      },
      () => loadData(), // permission denied / timeout → show all areas
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [loadData]);

  // Listen: refresh heatmap when reviews are submitted
  useEffect(() => {
    const handler = () => loadData();
    window.addEventListener("heatmap:refresh", handler);
    return () => window.removeEventListener("heatmap:refresh", handler);
  }, [loadData]);

  // Also refresh when tab regains focus
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") loadData();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [loadData]);

  // search handler
  const onSearch = () => {
    if (!query.trim()) return;
    fetch(`${API}/safety-scores/search?q=${encodeURIComponent(query.trim())}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.message || !Array.isArray(data) || data.length === 0) {
          setResult({ name: "", lat: 0, lng: 0, safety_score: 0 });
          return;
        }
        const best: ScorePoint = data[0];
        setResult(best);
        setCenter([best.lat, best.lng]);
        setPoints((prev) =>
          prev.some(
            (p) =>
              Math.abs(p.lat - best.lat) < 1e-6 &&
              Math.abs(p.lng - best.lng) < 1e-6
          )
            ? prev
            : [...prev, best]
        );
      })
      .catch(() => {});
  };

  return (
    <div className="relative h-[70vh] min-h-[420px] w-full rounded-xl overflow-hidden border">
      {/* Search bar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white shadow rounded-xl overflow-hidden flex">
        <input
          className="px-3 py-2 text-sm outline-none min-w-[260px]"
          placeholder="Search a place, e.g. T Nagar"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
        />
        <button
          onClick={onSearch}
          className="px-4 py-2 text-white bg-blue-600"
        >
          Search
        </button>
      </div>

      {/* Result card */}
      {result && (
        <div className="absolute left-4 bottom-4 z-[1000] bg-white/95 px-4 py-3 rounded-xl shadow max-w-[280px]">
          <button
            className="absolute top-1 right-2 text-neutral-400 hover:text-neutral-700"
            onClick={() => setResult(null)}
            aria-label="Close"
          >
            ×
          </button>
          {result.name ? (
            <>
              <div className="font-semibold mb-2 pr-4">{result.name}</div>
              {result.breakdown ? (
                <ScoreBreakdown score={result.safety_score} breakdown={result.breakdown} />
              ) : (
                <div className="text-sm">Safety score: {result.safety_score}/100</div>
              )}
            </>
          ) : (
            <div className="text-sm pr-4">No matching area. Try another name.</div>
          )}
        </div>
      )}

      <MapContainer center={center} zoom={8} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution="&copy; OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Recenter center={center} zoom={result?.name ? 13 : undefined} />
        <FitToPoints points={fitTo} />
        <HeatLayer points={points} />
        <ZoneLayer zones={zones} show={showZones} />
        <AreaMarkers points={points} show={showDebug} />
        {userPos && (
          <CircleMarker
            center={[userPos.lat, userPos.lng]}
            radius={8}
            pathOptions={{ color: "#fff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }}
          >
            <Popup>You are here</Popup>
          </CircleMarker>
        )}
      </MapContainer>

      {/* Legend + controls */}
      <div className="absolute right-4 bottom-4 z-[1000] bg-white/90 rounded-xl p-3 shadow text-sm space-y-2">
        <div className="font-semibold">Heatmap</div>
        <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-red-500" /> Less safe</div>
        <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-500" /> Safer</div>

        <div className="font-semibold pt-1">Risk zones</div>
        <div className="flex items-center gap-3 text-xs">
          {(["high", "medium", "low"] as const).map((lvl) => (
            <span key={lvl} className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm border-2" style={{ borderColor: ZONE_COLORS[lvl], background: `${ZONE_COLORS[lvl]}40` }} />
              {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
            </span>
          ))}
        </div>

        <div className="h-px bg-neutral-200 my-1" />

        <label className="flex items-center gap-2">
          <input type="checkbox" checked={showZones} onChange={(e) => setShowZones(e.target.checked)} />
          <span>Show risk zones</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={showDebug} onChange={(e) => setShowDebug(e.target.checked)} />
          <span>Show area scores</span>
        </label>

        <div className="text-xs text-neutral-600 max-w-[220px]" role="status">{status}</div>
        <button
          onClick={() => loadData()}
          className="mt-1 w-full rounded-md bg-neutral-900 text-white px-3 py-1"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
