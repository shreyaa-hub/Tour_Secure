import { Card, CardHeader, CardBody } from "@/components/ui/Card";

const features = [
  ["Safety map", "See how safe the areas around you are, based on local safety data and traveller reviews."],
  ["Risk zones", "Get told when your location falls inside a known risk zone, such as a busy market at night."],
  ["SOS", "Press SOS to share your location with the response team. You have 5 seconds to cancel."],
  ["Incident reports", "File an e-FIR for theft, harassment or other incidents and see your past reports."],
  ["Trip planner", "Keep your itinerary in one place and export it to your calendar."],
  ["Digital trip ID", "A QR code that proves your trip registration and expires when your trip ends."],
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
              Tour Secure helps travellers stay safe in unfamiliar places. Check an area before you go, keep your
              plans in one place, and get help quickly if something goes wrong.
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
          <CardHeader title="Please note" />
          <CardBody>
            <p className="text-sm text-neutral-700">
              Safety scores and risk zones are sample data. SOS alerts go to the Tour Secure response team, not to
              emergency services. In an emergency, call 112.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
