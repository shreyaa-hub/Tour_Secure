import {
  MapContainer,
  TileLayer,
  useMap,
  CircleMarker,
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

type ScorePoint = { name?: string; lat: number; lng: number; safety_score: number };

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
function Recenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [map, center]);
  return null;
}

/* ---------------- Debug overlay ---------------- */
function debugColor(score: number) {
  if (score >= 80) return "#1a9850"; // green
  if (score >= 60) return "#66bd63";
  if (score >= 40) return "#fee08b";
  if (score >= 20) return "#f46d43";
  return "#d73027"; // red
}

function DebugOverlay({ points, show }: { points: ScorePoint[]; show: boolean }) {
  if (!show) return null;
  return (
    <>
      {points.map((p, idx) => (
        <CircleMarker
          key={`${p.lat}-${p.lng}-${idx}`}
          center={[p.lat, p.lng]}
          radius={6}
          pathOptions={{
            color: "#333",
            fillColor: debugColor(p.safety_score),
            fillOpacity: 0.9,
            weight: 1,
          }}
        >
          <Popup>
            <div style={{ minWidth: 160 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                {p.name || "Unknown area"}
              </div>
              <div>
                Safety Score: <b>{p.safety_score}</b>/100
              </div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                Lat: {p.lat.toFixed(5)} • Lng: {p.lng.toFixed(5)}
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
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
  const [status, setStatus] = useState("Requesting your location…");

  const [showDebug, setShowDebug] = useState(false);

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
          setStatus(`Showing ${data.length} areas within ${RADIUS_KM} km of you`);
          return;
        }
      }
      const r = await fetch(`${API}/safety-scores?v=${v}`);
      const data = await r.json();
      setPoints(Array.isArray(data) ? data : []);
      setStatus(
        c
          ? `No data within ${RADIUS_KM} km of you — showing all ${Array.isArray(data) ? data.length : 0} areas`
          : `Location unavailable — showing all ${Array.isArray(data) ? data.length : 0} areas`
      );
    } catch {
      setStatus("Could not load safety data (is the backend running?)");
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

  // 🔁 Listen: refresh heatmap when reviews are submitted
  useEffect(() => {
    const handler = () => loadData();
    window.addEventListener("heatmap:refresh", handler);
    return () => window.removeEventListener("heatmap:refresh", handler);
  }, [loadData]);

  // 🔁 Also refresh when tab regains focus
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
          setResult({ name: "Not Found", lat: 0, lng: 0, safety_score: 0 });
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
          placeholder="Search area (e.g., Shillong)"
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
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-white/95 px-4 py-3 rounded-xl shadow text-center">
          <div className="font-semibold">{result.name}</div>
          <div className="text-sm">
            {result.name === "Not Found"
              ? "No data available"
              : `Safety Score: ${result.safety_score}/100`}
          </div>
        </div>
      )}

      <MapContainer center={center} zoom={8} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution="&copy; OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Recenter center={center} />
        <HeatLayer points={points} />
        <DebugOverlay points={points} show={showDebug} />
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
        <div className="font-semibold">Risk Heat Legend</div>
        <div>Red = Higher Risk (lower safety)</div>
        <div>Blue/Green = Lower Risk</div>

        <div className="h-px bg-neutral-200 my-1" />

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showDebug}
            onChange={(e) => setShowDebug(e.target.checked)}
          />
          <span>Debug: Points & Scores</span>
        </label>

        <div className="text-xs text-neutral-600 max-w-[220px]" role="status">{status}</div>
        <button
          onClick={() => loadData()}
          className="mt-1 w-full rounded-md bg-neutral-900 text-white px-3 py-1"
          title="Force refresh the heatmap"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
