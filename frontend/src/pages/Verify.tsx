import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, XCircle } from "lucide-react";
import { API_BASE } from "@/lib/api";
import { Card, CardBody } from "@/components/ui/Card";
import Loading from "@/components/ui/Loading";

// Public page opened by scanning a trip ID's QR code
type VerifyResp = {
  valid: boolean;
  reason?: string;
  holder?: { name: string | null };
  digitalId?: { status: string; entrypoint: string | null; docType: string | null; startAt: string; endAt: string };
};

const REASONS: Record<string, string> = {
  not_found: "This trip ID doesn't exist.",
  revoked_or_expired: "This trip ID has been cancelled or has expired.",
  out_of_window: "This trip ID is not valid today. It only works during the trip dates.",
  invalid_or_expired_token: "This QR code has expired or is not genuine. Ask the traveller to show a fresh code.",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-neutral-500">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

export default function Verify() {
  const { token = "" } = useParams();
  const [data, setData] = useState<VerifyResp | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/digital-id/verify/${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setFailed(true));
  }, [token]);

  const fmt = (d: string) => new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="mx-auto max-w-md">
      <h1 className="page-title">Trip ID check</h1>
      <Card className="mt-4">
        <CardBody>
          {failed ? (
            <div className="text-sm text-red-600">Couldn't reach the server. Try again in a moment.</div>
          ) : !data ? (
            <Loading />
          ) : data.valid && data.digitalId ? (
            <>
              <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-800">
                <CheckCircle2 size={28} />
                <div>
                  <div className="text-lg font-semibold">Valid trip ID</div>
                  <div className="text-sm">This traveller is registered for the dates below.</div>
                </div>
              </div>
              <div className="mt-4 divide-y">
                <Row label="Name" value={data.holder?.name || "Not given"} />
                {data.digitalId.entrypoint && <Row label="Arrived via" value={data.digitalId.entrypoint} />}
                {data.digitalId.docType && <Row label="ID document" value={data.digitalId.docType} />}
                <Row label="Valid from" value={fmt(data.digitalId.startAt)} />
                <Row label="Valid until" value={fmt(data.digitalId.endAt)} />
              </div>
              <p className="mt-4 text-xs text-neutral-500">
                Check the name against the traveller's passport or ID card.
              </p>
            </>
          ) : (
            <div className="flex items-center gap-3 rounded-xl bg-red-50 p-4 text-red-800">
              <XCircle size={28} />
              <div>
                <div className="text-lg font-semibold">Not valid</div>
                <div className="text-sm">{REASONS[data.reason || ""] || "This trip ID could not be verified."}</div>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
