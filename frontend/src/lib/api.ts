// frontend/src/lib/api.ts
// Single source of truth for the API base URL (must include the /api suffix).
// Default: same host the page was opened on, port 4000. Using the same host matters:
// the login cookie only travels if the page and API are on the same site
// (localhost:5173 → localhost:4000 works; 127.0.0.1:5173 → localhost:4000 does not).
export const API_BASE: string =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:4000/api`;
// Back-compat for modules that import { API_URL }
export const API_URL = API_BASE;

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j.error || j.message || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

// credentials: "include" sends the httpOnly session cookie (needed for admin-only calls)
export const get = async <T>(p: string) =>
  handle<T>(await fetch(`${API_BASE}${p}`, { credentials: "include" }));
export const post = async <T, B=unknown>(p: string, body?: B) =>
  handle<T>(await fetch(`${API_BASE}${p}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  }));
