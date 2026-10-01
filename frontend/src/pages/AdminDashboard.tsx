import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import { http } from "@/lib/http";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import Loading from "@/components/ui/Loading";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import StatusBadge from "@/components/StatusBadge";

type Person = { _id: string; name?: string; email?: string } | string | null | undefined;
type EFIR = { _id: string; name?: string; contact?: string; summary?: string; status?: string; createdAt: string; user?: Person };
type Alert = { _id: string; userId?: Person; lat?: number; lon?: number; createdAt: string; meta?: { locationSource?: string } };

function sourceLabel(source: string) {
  return source === "gps" ? "live GPS"
    : source === "last-known" ? "last known location"
    : source === "manual" ? "entered by user"
    : "approximate location";
}

function personLabel(p: Person) {
  if (!p) return "Unknown user";
  if (typeof p === "string") return p;
  return p.name ? `${p.name}${p.email ? ` (${p.email})` : ""}` : p.email || p._id;
}

const DAY = 24 * 60 * 60 * 1000;

// Zoom the map so every alert is visible
function FitAlerts({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = points.map((p) => p.join(",")).join("|");
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) map.setView(points[0], 13);
    else map.fitBounds(points, { padding: [30, 30], maxZoom: 13 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: "red" | "amber" }) {
  const c = tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-600" : "text-neutral-900";
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className={`mt-1 text-3xl font-bold ${c}`}>{value}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const { notify } = useToast();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [efirs, setEfirs] = useState<EFIR[] | null>(null);
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  async function load() {
    setBusy(true);
    try {
      const [a, b] = await Promise.all([
        http.get<EFIR[]>("/admin/efir"),
        http.get<Alert[]>("/admin/alerts"),
      ]);
      setEfirs(a.data);
      setAlerts(b.data);
      setError(null);
      setUpdatedAt(new Date());
    } catch (e: any) {
      const status = e?.response?.status;
      setError(
        status === 401 ? "Your session expired. Please log in again."
        : status === 403 ? "Your account is not an admin."
        : "Couldn't load the latest data. Retrying…"
      );
    } finally {
      setBusy(false);
    }
  }

  // Load now, then poll every 10 s
  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  async function setStatus(id: string, status: string) {
    setSavingId(id);
    try {
      const { data } = await http.patch<EFIR>(`/admin/efir/${id}`, { status });
      setEfirs((list) => (list ? list.map((e) => (e._id === id ? { ...e, status: data.status } : e)) : list));
      notify({ tone: "success", message: `Report marked as ${status.toLowerCase()}.` });
    } catch (e: any) {
      notify({ tone: "error", message: e?.response?.data?.error || "Couldn't update the report." });
    } finally {
      setSavingId(null);
    }
  }

  const openReports = efirs ? efirs.filter((e) => e.status !== "Closed").length : null;
  const recentSos = alerts ? alerts.filter((a) => Date.now() - new Date(a.createdAt).getTime() < DAY).length : null;
  const sosPoints = useMemo(
    () => (alerts || []).filter((a) => a.lat != null && a.lon != null) as (Alert & { lat: number; lon: number })[],
    [alerts]
  );

  return (
    <>
      <h1 className="page-title">Admin Dashboard</h1>
      <div className="mt-4 flex items-center gap-3">
        <Button variant="outline" onClick={load} disabled={busy}>{busy ? "Refreshing…" : "Refresh"}</Button>
        <span className="text-xs text-neutral-500">
          Updates every 10 seconds{updatedAt ? `. Last updated ${updatedAt.toLocaleTimeString()}` : ""}
        </span>
      </div>
      {error && <div className="mt-3 text-sm text-red-600" role="alert">{error}</div>}

      <div className="mt-6 grid gap-4 grid-cols-2 md:grid-cols-4">
        <Stat label="Open reports" value={openReports ?? "…"} tone={openReports ? "amber" : undefined} />
        <Stat label="SOS in last 24 hours" value={recentSos ?? "…"} tone={recentSos ? "red" : undefined} />
        <Stat label="All reports" value={efirs ? efirs.length : "…"} />
        <Stat label="All SOS alerts" value={alerts ? alerts.length : "…"} />
      </div>

      <Card className="mt-6">
        <CardHeader title="Where SOS alerts came from" />
        <CardBody>
          <div className="h-72 w-full overflow-hidden rounded-xl border">
            <MapContainer center={[20.5937, 78.9629]} zoom={4} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
              <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <FitAlerts points={sosPoints.map((a) => [a.lat, a.lon] as [number, number])} />
              {sosPoints.map((a) => {
                const recent = Date.now() - new Date(a.createdAt).getTime() < DAY;
                return (
                  <CircleMarker
                    key={a._id}
                    center={[a.lat, a.lon]}
                    radius={recent ? 10 : 7}
                    pathOptions={{ color: recent ? "#dc2626" : "#f97316", fillOpacity: 0.6 }}
                  >
                    <Popup>
                      <div className="text-sm font-medium">{personLabel(a.userId)}</div>
                      <div className="text-xs">{new Date(a.createdAt).toLocaleString()}</div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>
          <div className="mt-2 text-xs text-neutral-500">Red: last 24 hours. Orange: older.</div>
        </CardBody>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 mt-6">
        <Card>
          <CardHeader title="SOS alerts" />
          <CardBody>
            {!alerts ? <Loading /> : alerts.length === 0 ? <div className="text-sm text-neutral-600">No SOS alerts.</div> : (
              <ul className="divide-y">
                {alerts.map(a => (
                  <li key={a._id} className="py-3">
                    <div className="text-sm font-medium">{personLabel(a.userId)}</div>
                    <div className="text-sm">
                      {a.lat != null && a.lon != null ? (
                        <a className="underline" target="_blank" rel="noreferrer"
                           href={`https://www.google.com/maps?q=${a.lat},${a.lon}`}>
                          {a.lat.toFixed(5)}, {a.lon.toFixed(5)}
                        </a>
                      ) : "No coordinates"}
                      {a.meta?.locationSource ? <span className="text-xs text-neutral-500"> · {sourceLabel(a.meta.locationSource)}</span> : null}
                    </div>
                    <div className="text-xs text-neutral-500">{new Date(a.createdAt).toLocaleString()}</div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Incident reports (e-FIR)" />
          <CardBody>
            {!efirs ? <Loading /> : efirs.length === 0 ? <div className="text-sm text-neutral-600">No reports yet.</div> : (
              <ul className="divide-y">
                {efirs.map(e => (
                  <li key={e._id} className="py-3">
                    <div className="font-medium">
                      {e.name || personLabel(e.user)}{" "}
                      {e.contact ? <span className="text-xs text-neutral-500">· {e.contact}</span> : null}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
                      <StatusBadge status={e.status} />
                      {new Date(e.createdAt).toLocaleString()}
                    </div>
                    <p className="mt-2 text-sm whitespace-pre-wrap">{e.summary}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {e.status !== "In progress" && e.status !== "Closed" && (
                        <Button variant="outline" disabled={savingId === e._id} onClick={() => setStatus(e._id, "In progress")}>
                          Mark in progress
                        </Button>
                      )}
                      {e.status !== "Closed" ? (
                        <Button variant="outline" disabled={savingId === e._id} onClick={() => setStatus(e._id, "Closed")}>
                          Close
                        </Button>
                      ) : (
                        <Button variant="outline" disabled={savingId === e._id} onClick={() => setStatus(e._id, "Pending")}>
                          Reopen
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
