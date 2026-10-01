import { useEffect, useMemo, useState } from "react";
import useLocalWallet from "@/hooks/useLocalWallet";
import { downloadFile } from "@/utils/download";

type Props = {
  userId: string;
  value?: string;
  onChange?: (addr: string) => void;
};

export default function WalletAddressInline({ userId, value = "", onChange }: Props) {
  const { mnemonic, address, generate12, encryptToKeystore, clearWalletFromMemory } = useLocalWallet();
  const [confirmed, setConfirmed] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmIdx, setConfirmIdx] = useState<number[]>([]);
  const [confirmWords, setConfirmWords] = useState<string[]>(["", "", ""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const words = useMemo(() => (mnemonic ? mnemonic.split(" ") : []), [mnemonic]);

  useEffect(() => { if (address && onChange) onChange(address); }, [address, onChange]);

  useEffect(() => {
    if (!mnemonic) return;
    const s = new Set<number>();
    while (s.size < 3) s.add(Math.floor(Math.random() * 12) + 1);
    setConfirmIdx(Array.from(s).sort((a, b) => a - b));
  }, [mnemonic]);

  async function saveAddressToBackend() {
    if (!value) return;
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/user/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId, address: value })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Failed to save wallet address");
    } catch (e: any) {
      setError(e.message || "Failed to save wallet address");
    } finally { setBusy(false); }
  }

  async function downloadKeystore() {
    try {
      if (password.length < 8) return setError("Use a strong password (min 8 chars).");
      const json = await encryptToKeystore(password);
      downloadFile(`wallet-${address}.json`, json);
    } catch (e: any) { setError(e.message || "Keystore export failed"); }
  }

  return (
    <div className="space-y-2">
      <input className="w-full border rounded px-3 py-2" placeholder="0x..." value={value} readOnly />

      {!mnemonic ? (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => { setError(""); generate12(); }} className="px-3 py-2 rounded bg-neutral-900 text-white">
            Create Wallet (in browser)
          </button>
          <button type="button" disabled={!value || busy} onClick={saveAddressToBackend} className="px-3 py-2 rounded border disabled:opacity-60">
            {busy ? "Saving..." : "Save Address to Profile"}
          </button>
        </div>
      ) : (
        <>
          <div className="rounded border p-3 bg-neutral-50">
            <p className="text-sm font-medium mb-2">Your 12-word Recovery Phrase</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {words.map((w, i) => (
                <div key={i} className="text-sm">
                  <span className="text-neutral-500 mr-1">{i + 1}.</span>{w}
                </div>
              ))}
            </div>
            <p className="text-xs text-rose-600 mt-2">Save it offline. We cannot recover it.</p>
          </div>

          <div>
            <p className="text-sm font-medium mb-1">Confirm backup by entering words #{confirmIdx.join(", ")}</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {confirmIdx.map((n, i) => (
                <input
                  key={n}
                  placeholder={`Word #${n}`}
                  className="border rounded px-3 py-2"
                  value={confirmWords[i] ?? ""}
                  onChange={(e) => {
                    const arr = [...confirmWords];
                    arr[i] = e.target.value;
                    setConfirmWords(arr);
                  }}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                const ok = confirmIdx.every((n, i) => (confirmWords[i] || "").trim().toLowerCase() === words[n - 1]);
                setConfirmed(ok);
              }}
              className="mt-2 px-3 py-2 rounded bg-blue-600 text-white"
            >
              Verify Backup
            </button>
            {confirmed ? (
              <p className="text-xs text-green-700 mt-1">Backup confirmed.</p>
            ) : (
              <p className="text-xs text-neutral-500 mt-1">Enter the exact words to proceed.</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="password"
              placeholder="Keystore password (min 8 chars)"
              className="border rounded px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="button" onClick={downloadKeystore} className="px-3 py-2 rounded border">
              Download Keystore JSON
            </button>

            <button type="button" disabled={!confirmed || !value || busy} onClick={saveAddressToBackend} className="px-3 py-2 rounded bg-emerald-600 text-white disabled:opacity-60">
              {busy ? "Saving..." : "Save Address to Profile"}
            </button>

            <button
              type="button"
              onClick={() => { clearWalletFromMemory(); setPassword(""); setConfirmWords(["","",""]); setConfirmed(false); }}
              className="px-3 py-2 rounded border"
            >
              Clear from RAM
            </button>
          </div>
        </>
      )}

      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}
