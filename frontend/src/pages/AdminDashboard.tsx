import { useEffect, useState } from "react";
import { http } from "@/lib/http";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import Loading from "@/components/ui/Loading";
import Button from "@/components/ui/Button";

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

export default function AdminDashboard() {
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
                    <div className="text-xs text-neutral-500">
                      {new Date(e.createdAt).toLocaleString()}{e.status ? ` · ${e.status}` : ""}
                    </div>
                    <p className="mt-2 text-sm whitespace-pre-wrap">{e.summary}</p>
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
