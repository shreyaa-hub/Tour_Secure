// frontend/src/pages/Itinerary.tsx
import { useEffect, useMemo, useState } from "react";
import { http } from "@/lib/http";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Select from "@/components/ui/Select";
import Loading from "@/components/ui/Loading";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { MapPin } from "lucide-react";

/* ------------ types & API ------------ */
type Item = {
  _id: string;
  title: string;
  date?: string;        // "YYYY-MM-DD"
  location?: string;
  notes?: string;
  createdAt: string;
};

async function fetchItems(): Promise<Item[]> {
  const { data } = await http.get("/itinerary"); // use shared client
  const arr = Array.isArray(data) ? data : (data?.items ?? []); // always an array
  return (arr as Item[]).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

async function createItem(input: { title: string; date?: string; location?: string; notes?: string }) {
  const { data } = await http.post("/itinerary", input); // use shared client
  return (data?.item ?? data) as Item; // accept either shape
}

/* ------------ page ------------ */
export default function Itinerary() {
  const { notify } = useToast();

  // list
  const [items, setItems] = useState<Item[] | null>(null);
  const [loading, setLoading] = useState(true);

  // add form
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // filters
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<"date-asc" | "date-desc" | "created-desc">("date-asc");

  // client-only “done” status
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const list = await fetchItems();
        if (!alive) return;
        setItems(list);
      } catch (e: any) {
        notify({ tone: "error", message: "Couldn't load your itinerary." });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [notify]);

  const filteredSorted = useMemo(() => {
    const data = (items ?? []).slice();
    // filter
    const ql = q.trim().toLowerCase();
    const inRange = (d?: string) => {
      if (!d) return true;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    };
    const filtered = data.filter(it =>
      (ql ? it.title.toLowerCase().includes(ql) || it.location?.toLowerCase().includes(ql) || it.notes?.toLowerCase().includes(ql) : true) &&
      inRange(it.date)
    );
    // sort
    filtered.sort((a, b) => {
      if (sort === "created-desc") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      const da = a.date ?? "";
      const db = b.date ?? "";
      if (sort === "date-asc")  return da.localeCompare(db) || a.title.localeCompare(b.title);
      return db.localeCompare(da) || a.title.localeCompare(b.title);
    });
    return filtered;
  }, [items, q, from, to, sort]);

  const groupedByDate = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const it of filteredSorted) {
      const key = it.date || "No date";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredSorted]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      notify({ tone: "warning", message: "Give this stop a title." });
      return;
    }
    try {
      setSubmitting(true);
      const created = await createItem({
        title: title.trim(),
        date: date || undefined,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setItems((s) => [created, ...(s ?? [])]);
      setTitle(""); setDate(""); setLocation(""); setNotes("");
      notify({ tone: "success", title: "Added to your itinerary", message: title.trim() });
    } catch (e: any) {
      notify({ tone: "error", message: e?.response?.data?.error || "Couldn't add this stop. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  function quickToday() {
    setDate(new Date().toISOString().slice(0, 10));
  }

  function mapsUrl(loc?: string) {
    return loc ? `https://www.google.com/maps/search/${encodeURIComponent(loc)}` : "#";
  }

  /* ---------- export helpers ---------- */
  function download(filename: string, content: string, mime = "text/plain") {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportCSV() {
    const rows = [["Title", "Date", "Location", "Notes"]];
    (filteredSorted).forEach(it => {
      rows.push([it.title, it.date ?? "", it.location ?? "", (it.notes ?? "").replace(/\n/g, " ")]);
    });
    const csv = rows.map(r => r.map(x => `"${(x ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    download("itinerary.csv", csv, "text/csv");
  }

  function exportICS() {
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Tour Secure//Itinerary//EN",
    ];
    filteredSorted.forEach((it, i) => {
      if (!it.date) return;
      const dt = it.date.replace(/-/g, "");
      const uid = `${i}-${dt}@tour-secure`;
      lines.push(
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${toUTCString(new Date())}`,
        `DTSTART;VALUE=DATE:${dt}`,
        `SUMMARY:${escapeICS(it.title)}`,
        it.location ? `LOCATION:${escapeICS(it.location)}` : "",
        it.notes ? `DESCRIPTION:${escapeICS(it.notes)}` : "",
        "END:VEVENT"
      );
    });
    lines.push("END:VCALENDAR");
    download("itinerary.ics", lines.filter(Boolean).join("\r\n"), "text/calendar");
  }

  function toUTCString(d: Date) {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return (
      d.getUTCFullYear().toString() +
      pad(d.getUTCMonth() + 1) +
      pad(d.getUTCDate()) +
      "T" +
      pad(d.getUTCHours()) +
      pad(d.getUTCMinutes()) +
      pad(d.getUTCSeconds()) +
      "Z"
    );
  }
  function escapeICS(s: string) {
    return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  }

  return (
    <>
      <h1 className="page-title">Itinerary</h1>

      {/* Top row: Add + Filters/Export */}
      <div className="grid gap-6 md:grid-cols-3 mt-6">
        <Card className="md:col-span-1">
          <CardHeader title="Add a stop" />
          <CardBody>
            <form onSubmit={onSubmit} className="space-y-3">
              <Input placeholder="What, e.g. Visit Kamakhya Temple" value={title} onChange={(e) => setTitle(e.target.value)} required />
              <div className="flex gap-3">
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                <Button variant="outline" type="button" onClick={quickToday}>Today</Button>
              </div>
              <Input placeholder="Where (optional)" value={location} onChange={(e) => setLocation(e.target.value)} />
              <Textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <Button type="submit" disabled={submitting}>{submitting ? "Adding…" : "Add"}</Button>
            </form>
          </CardBody>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader title="Find & export" />
          <CardBody>
            <div className="flex flex-wrap items-end gap-3">
              <Input className="w-60" placeholder="Search your plans" value={q} onChange={(e) => setQ(e.target.value)} />
              <div className="flex items-center gap-2">
                <div className="text-xs text-neutral-500">From</div>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <div className="text-xs text-neutral-500">To</div>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <Select value={sort} onChange={(e) => setSort(e.target.value as any)}>
                <option value="date-asc">Date: earliest first</option>
                <option value="date-desc">Date: latest first</option>
                <option value="created-desc">Recently added</option>
              </Select>

              <div className="flex-1" />
              <Button variant="outline" onClick={exportCSV}>Download CSV</Button>
              <Button variant="outline" onClick={exportICS}>Add to calendar</Button>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Timeline */}
      <Card className="mt-6">
        <CardHeader title="Your itinerary" />
        <CardBody>
          {loading ? (
            <Loading />
          ) : !items || items.length === 0 ? (
            <div className="text-sm text-neutral-600">Nothing planned yet. Add your first stop on the left.</div>
          ) : (
            <div className="relative">
              {/* timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-[2px] bg-neutral-200" aria-hidden />
              <div className="space-y-6">
                {groupedByDate.map(([day, list]) => (
                  <section key={day} className="pl-10">
                    <header className="mb-2">
                      <Badge tone="neutral">{day}</Badge>
                    </header>
                    <ul className="space-y-3">
                      {list.map((it) => {
                        const isDone = !!done[it._id];
                        return (
                          <li key={it._id} className="relative">
                            {/* dot */}
                            <span
                              className={`absolute left-[-23px] top-5 -translate-x-1/2 w-3 h-3 rounded-full border ${isDone ? "bg-emerald-500 border-emerald-500" : "bg-white border-neutral-300"}`}
                              aria-hidden
                            />
                            <div className="rounded-xl border p-4 bg-white">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className={`font-semibold truncate ${isDone ? "line-through text-neutral-500" : ""}`}>
                                    {it.title}
                                  </div>
                                  <div className="text-xs text-neutral-500">
                                    {it.location ? (
                                      <a
                                        href={mapsUrl(it.location)}
                                        target="_blank"
                                        className="inline-flex items-center gap-1 underline underline-offset-2"
                                        rel="noreferrer"
                                      >
                                        <MapPin size={14} /> {it.location}
                                      </a>
                                    ) : (
                                      <span>No location</span>
                                    )}
                                    {" · "}
                                    {new Date(it.createdAt).toLocaleString()}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    onClick={() => setDone((s) => ({ ...s, [it._id]: !s[it._id] }))}
                                    title={isDone ? "Mark as not done" : "Mark as done"}
                                  >
                                    {isDone ? "Undo" : "Done"}
                                  </Button>
                                </div>
                              </div>
                              {it.notes && (
                                <p className={`mt-2 text-sm whitespace-pre-wrap ${isDone ? "line-through text-neutral-500" : "text-neutral-700"}`}>
                                  {it.notes}
                                </p>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </>
  );
}
