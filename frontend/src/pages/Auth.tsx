// frontend/src/pages/Auth.tsx
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/axios";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  return mode === "login" ? (
    <Login onSwitch={() => setMode("signup")} />
  ) : (
    <Signup onSwitch={() => setMode("login")} />
  );
}

function Login({ onSwitch }: { onSwitch: () => void }) {
  const { notify } = useToast();
  const { refresh } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/auth/login", { email, password });
      await refresh();
      const to = (loc.state as any)?.from?.pathname || "/digital-id";
      nav(to, { replace: true });
    } catch (e: any) {
      const msg =
        e?.response?.data?.error ||
        (e?.response?.status === 404 ? "Endpoint not found (check VITE_API_BASE and path)" : null) ||
        e?.message ||
        "Login failed";
      notify({ tone: "error", message: msg });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-10">
      <Card>
        <CardHeader title="Sign in" />
        <CardBody>
          <form onSubmit={onSubmit} className="space-y-3">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <div className="flex items-center justify-end">
              <Button type="submit" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </Button>
            </div>
          </form>

          <div className="mt-4 text-sm">
            New here?{" "}
            <button className="underline" onClick={onSwitch}>
              Create an account
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <RoleHint
              title="Sign in as User"
              text="Access your e-FIR and Itinerary; share Reviews & view Heatmap."
            />
            <RoleHint
              title="Sign in as Admin"
              text="View all e-FIRs and SOS alerts; coordinate response."
            />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function Signup({ onSwitch }: { onSwitch: () => void }) {
  const { notify } = useToast();
  const { refresh } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      // New accounts are always role "user"; admins are promoted server-side (npm run seed:demo).
      await api.post("/auth/register", { name, email, password });
      await refresh();
      const to = (loc.state as any)?.from?.pathname || "/digital-id";
      nav(to, { replace: true });
    } catch (e: any) {
      const msg =
        e?.response?.data?.error ||
        (e?.response?.status === 404 ? "Endpoint not found (check VITE_API_BASE and path)" : null) ||
        e?.message ||
        "Sign-up failed";
      notify({ tone: "error", message: msg });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-10">
      <Card>
        <CardHeader title="Create account" />
        <CardBody>
          <form onSubmit={onSubmit} className="space-y-3">
            <Input
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />

            <div className="flex items-center justify-between">
              <button type="button" onClick={onSwitch} className="text-sm underline">
                Have an account?
              </button>
              <Button type="submit" disabled={busy}>
                {busy ? "Creating…" : "Sign up"}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

function RoleHint({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border p-3 bg-white">
      <div className="font-semibold">{title}</div>
      <div className="text-xs text-neutral-600 mt-1">{text}</div>
    </div>
  );
}
