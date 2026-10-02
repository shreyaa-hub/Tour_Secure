# TourSecure

A personal-safety web app for tourists: a location-aware safety heatmap, geofenced risk zones, an animated SOS with a cancel window, and user/admin access control.

## Stack (what actually runs)

| Layer | Tech |
|---|---|
| Frontend | React 18 + TypeScript, Vite, Tailwind, React Router 7, React Leaflet + leaflet.heat |
| Backend | Node.js + Express 4 (`backend/src/index.ts`) |
| Database | MongoDB via Mongoose (2dsphere indexes, `$near`, `$geoIntersects`) |
| Auth | bcrypt password hashing, JWT in an httpOnly cookie, `user` / `admin` roles enforced in Express middleware |

```
React SPA ──(axios/fetch, cookie)──► Express API ──Mongoose──► MongoDB
  AuthContext (/api/auth/me)           /api/auth           users (role)
  Geolocation API                      /api/safety-scores  safetyscores (2dsphere, $near)
  Leaflet map + heat layer             /api/geo            zones (2dsphere, $geoIntersects)
  SOS countdown ─────────────────────► /api/alerts/panic   alerts
                                       /api/admin (admin)
```

Not connected to the running app (prototypes kept in the repo): `blockchain/` (Hardhat + soulbound `TouristID` contract), `services/` (FastAPI geofencing/anomaly), `backend/src/server.ts` + `backend/prisma/` + `docker-compose.yml` (an earlier Postgres version).

## Run locally

Requirements: Node 20+ and a MongoDB instance (local `mongod`, Docker `mongo:7`, or Atlas).

```bash
# 1. Backend
cd backend
cp .env.example .env          # set MONGO_URI and JWT_SECRET
npm install
npm run seed:safety           # 25 safety-score areas (North-East India)
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='choose-a-password' npm run seed:demo   # risk zones, Chennai-region areas, admin user
npm run seed:sample           # sample reviews, e-FIRs, SOS alerts and a trip itinerary (see .env.example)
npm run dev                   # http://localhost:4000/api/health

# 2. Frontend (new terminal)
cd frontend
cp .env.example .env          # VITE_API_BASE=http://localhost:4000/api
npm install
npm run dev                   # http://localhost:5173
```

Notes:
- Geolocation only works on `localhost` or HTTPS.
- Sample data covers North-East India (`seed:safety`) and the Chennai region (`seed:demo`). Elsewhere, the heatmap zooms out to show all areas. To demo a specific spot, override your location in Chrome DevTools → Sensors (e.g. the high-risk zones at Paltan Bazaar `26.179, 91.752` or Chennai Central `13.0827, 80.2757`).
- Map tiles load from OpenStreetMap, so the browser needs internet access.

## Main API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | – | Create account / log in (sets httpOnly cookie) |
| GET | `/api/auth/me` | user | Current session |
| POST | `/api/auth/logout` | – | Clear cookie |
| GET | `/api/safety-scores`, `/nearby?lat&lng&radius`, `/search?q` | – | Safety scores (0–100); `nearby` uses `$near` |
| GET / POST | `/api/geo/zones` | POST: admin | List / create risk polygons |
| POST | `/api/geo/check` | – | Which risk zone contains a point (`$geoIntersects`) |
| POST | `/api/alerts/panic` | user | Record an SOS with coordinates |
| GET | `/api/admin/alerts`, `/api/admin/efir` | admin | Admin dashboard data |
| PATCH | `/api/admin/efir/:id` | admin | Set a report's status (Pending, In progress, Closed) |
| GET | `/api/digital-id/verify/:token` | – | Check a trip ID QR code (shown on the `/verify/:token` page) |
| * | `/api/reviews`, `/api/itinerary`, `/api/efir`, `/api/digital-id` | mixed | Reviews, itinerary, incident reports, QR trip ID |

The SOS stores a geotagged alert that admins can see; it does not send SMS/e-mail notifications.
