// Coloured label for an e-FIR status
export default function StatusBadge({ status }: { status?: string }) {
  const s = status || "Pending";
  const c =
    s === "Closed" ? "bg-emerald-100 text-emerald-800"
    : s === "In progress" ? "bg-blue-100 text-blue-800"
    : "bg-amber-100 text-amber-800";
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${c}`}>{s}</span>;
}
