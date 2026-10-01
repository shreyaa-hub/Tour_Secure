import { useEffect, useMemo, useState } from "react";
import useLocalWallet from "@/hooks/useLocalWallet";
import { downloadFile } from "@/utils/download";

type Props = { userId: string; onSaved?: (address: string) => void };

export default function WalletSetupCard({ userId, onSaved }: Props) {
  const { mnemonic, address, generate12, encryptToKeystore, clearWalletFromMemory } = useLocalWallet();
  const [confirmed, setConfirmed] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmIdx, setConfirmIdx] = useState<number[]>([]);
  const [confirmWords, setConfirmWords] = useState<string[]>(["", "", ""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const words = useMemo(() => (mnemonic ? mnemonic.split(" ") : []), [mnemonic]);

  useEffect(() => {
    if (!mnemonic) return;
    const s = new Set<number>();
    while (s.size < 3) s.add(Math.floor(Math.random() * 12) + 1);
    setConfirmIdx(Array.from(s).sort((a, b) => a - b));
  }, [mnemonic]);

  async function start() {
    setError("");
    await generate12();
  }

  function checkConfirmation() {
    if (!mnemonic) return false;
    for (let i = 0; i < confirmIdx.length; i++) {
      const pos = confirmIdx[i] - 1;
      if ((confirmWords[i] || "").trim().toLowerCase() !== words[pos]) return false;
    }
    return true;
  }

  async function saveAddress() {
    if (!address) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/user/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // keep if your backend CORS has credentials: true
        body: JSON.stringify({ userId, address }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Failed to save address");
      onSaved?.(data.address);
    } catch (e: any) {
      setError(e.message || "Failed to save address");
    } finally {
      setBusy(false);
    }
  }

  async function downloadKeystore() {
    try {
      if (password.length < 8) return setError("Use a strong password (min 8 chars).");
      const json = await encryptToKeystore(password);
      downloadFile(`wallet-${address}.json`, json);
    } catch (e: any) {
      setError(e.message || "Keystore export failed");
    }
  }

  function clearFromRAM() {
    clearWalletFromMemory();
    setPassword("");
    setConfirmWords(["", "", ""]);
    setConfirmed(false);
  }

  return (
    <div className="rounded-2xl border p-5 md:p-6 shadow-sm space-y-4 bg-white">
      <h3 className="text-lg font-semibold">Create Your Self-Custody Wallet</h3>

      {!mnemonic && (
        <div className="space-y-3">
          <p className="text-sm text-neutral-600">
            The wallet is created <b>in your browser</b>. We never receive your recovery phrase or private key.
          </p>
          <button onClick={start} className="px-4 py-2 rounded-xl bg-neutral-900 text-white">
            Generate 12-word phrase
          </button>
        </div>
      )}

      {mnemonic && (
        <>
          <div className="space-y-2">
            <p className="text-sm font-medium">Your 12-word Recovery Phrase</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 border rounded-lg bg-neutral-50">
              {words.map((w, i) => (
                <div key={i} className="text-sm">
                  <span className="text-neutral-500 mr-1">{i + 1}.</span>{w}
                </div>
              ))}
            </div>
            <p className="text-xs text-rose-600">
              Save it offline. Anyone with these words can control your wallet. We cannot recover it.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">
              Confirm backup by entering words #{confirmIdx.join(", ")}
            </p>
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
              onClick={() => setConfirmed(checkConfirmation())}
              className="px-3 py-2 rounded bg-blue-600 text-white"
            >
              Verify
            </button>
            {confirmed ? (
              <p className="text-xs text-green-700">Backup confirmed.</p>
            ) : (
              <p className="text-xs text-neutral-500">Enter the exact words to proceed.</p>
            )}
          </div>

          {address && (
            <div className="space-y-1">
              <p className="text-sm font-medium">Your Address</p>
              <input className="w-full border rounded px-3 py-2" value={address} readOnly />
              <p className="text-xs text-neutral-500">This public address will be linked to your Digital ID.</p>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">Optional: Download encrypted keystore (JSON)</p>
            <div className="flex gap-2 items-center">
              <input
                type="password"
                placeholder="Set a strong password (min 8 chars)"
                className="border rounded px-3 py-2 flex-1"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button onClick={downloadKeystore} className="px-3 py-2 rounded bg-neutral-900 text-white">
                Download JSON
              </button>
            </div>
            <p className="text-xs text-neutral-500">
              Keep this file safe. You can import it later with your password.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              disabled={!confirmed || !address || busy}
              onClick={saveAddress}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white disabled:opacity-60"
            >
              {busy ? "Saving..." : "Save Address to Profile"}
            </button>
            <button onClick={clearFromRAM} className="px-4 py-2 rounded-xl border">
              I’ve saved it — Clear from RAM
            </button>
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}
        </>
      )}
    </div>
  );
}
