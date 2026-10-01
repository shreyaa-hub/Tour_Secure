import { Card, CardHeader, CardBody } from "@/components/ui/Card";

const features = [
  ["Safety heatmap", "Areas near your location, coloured by safety score, using MongoDB geospatial queries ($near)."],
  ["Risk zones", "Checks whether your position falls inside a defined risk zone ($geoIntersects). Admins can add zones."],
  ["SOS", "An SOS button with a 5-second cancel window that records your location for responders."],
  ["Admin dashboard", "Admins see recent SOS alerts and incident reports, refreshed every 10 seconds."],
  ["e-FIR, itinerary, reviews", "File incident reports, plan your trip (CSV / calendar export) and review places."],
  ["Digital trip ID", "A time-limited, revocable QR code that can be verified until your trip ends."],
];

export default function About() {
  return (
    <>
      <h1 className="page-title">About</h1>

      <div className="grid gap-6 mt-6">
        <Card>
          <CardHeader title="Tour Secure" />
          <CardBody>
            <p className="text-sm text-neutral-700">
              A personal-safety web app for tourists: see how safe the areas around you are, know when you enter a
              risk zone, and raise an SOS that responders can see.
            </p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {features.map(([title, text]) => (
                <li key={title} className="rounded-xl border p-4">
                  <div className="font-medium">{title}</div>
                  <div className="text-sm text-neutral-600 mt-1">{text}</div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Built with" />
          <CardBody>
            <p className="text-sm text-neutral-700">
              React + TypeScript (Vite, Tailwind, React Router, React Leaflet) · Node.js + Express · MongoDB ·
              JWT authentication in an httpOnly cookie with user / admin roles.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Disclaimer" />
          <CardBody>
            <p className="text-sm text-neutral-700">
              This is a demonstration project. Safety scores and risk zones are sample data, and SOS alerts are
              recorded for the admin dashboard only — they do not contact emergency services. In an emergency, call
              your local emergency number.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
