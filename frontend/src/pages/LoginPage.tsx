import { useState } from "react";
import { login, me } from "../services/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);   // calls backend
      const session = await me();     // verifies session
      console.log("Logged in:", session);
      // TODO: navigate to dashboard
    } catch (err: any) {
      setError(err?.response?.data?.error || "Login failed");
    }
  };

  return (
    <form onSubmit={onSubmit}>
      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        placeholder="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p style={{ color: "red" }}>{error}</p>}
      <button type="submit">Login</button>
    </form>
  );
}
