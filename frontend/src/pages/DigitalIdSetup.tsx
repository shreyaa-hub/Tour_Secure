import { useState } from "react";
import WalletSetupCard from "@/components/WalletSetupCard";

// Replace with your real auth/user context
const CURRENT_USER_ID = "PUT_REAL_USER_ID_OR_GET_FROM_AUTH";

export default function DigitalIdSetup() {
  const [address, setAddress] = useState("");

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Digital ID Setup</h1>

      {!address && (
        <WalletSetupCard userId={CURRENT_USER_ID} onSaved={(addr) => setAddress(addr)} />
      )}

      {address && (
        <div className="rounded-xl border p-4 bg-green-50">
          <p className="font-medium">Wallet linked</p>
          <p className="text-sm text-neutral-700 break-all">{address}</p>
          <p className="text-xs text-neutral-500 mt-1">
            You can now proceed with blockchain-backed attestations.
          </p>
        </div>
      )}
    </div>
  );
}
