import { useState, createContext } from "react";
import { BrandMark } from "../ui/BrandMark";
import { call, api } from "./bridge";
import { Loader2 } from "lucide-react";
export interface Account {
  id: string;
  username: string;
  role: "admin" | "user";
  maintenance: boolean;
  update?: { version: string; notes: string } | null;
}
export const AccountContext = createContext<Account | undefined>(undefined);
export function SignIn({
  onSignedIn,
}: {
  onSignedIn: (account: Account) => void;
}) {
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="auth-screen">
      <div className="auth-brand">
        <BrandMark size={46} />
      </div>
      <section className="auth-card panel">
        <span className="eyebrow">CORELUM AI</span>
        <h1>{register ? "Create an account" : "Sign in"}</h1>
        <p>
          {register
            ? "Set up your personal workspace."
            : "Enter your account details to continue."}
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              if (register) await call("register", { username, password });
              await call("login", { email: username, password });
              setPassword("");
              onSignedIn(await api<Account>("/me"));
            } catch (e) {
              setError(String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Username
            <input
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={128}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={register ? 8 : 1}
            />
          </label>
          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}
          <button className="primary" disabled={busy}>
            {busy && <Loader2 className="spin" size={15} />}{" "}
            {register ? "Create account" : "Sign in"}
          </button>
        </form>
        <button
          className="text-button"
          onClick={() => {
            setRegister(!register);
            setError("");
          }}
        >
          {register ? "Already have an account? Sign in" : "Create an account"}
        </button>
      </section>
      <p className="auth-footer">Corelum AI · Secure account access</p>
    </div>
  );
}
export function Maintenance({ signOut }: { signOut: () => void }) {
  return (
    <div className="auth-screen">
      <BrandMark size={50} />
      <section className="auth-card panel">
        <span className="eyebrow">CORELUM AI</span>
        <h1>Under maintenance</h1>
        <p>
          Corelum AI is temporarily unavailable while we carry out maintenance.
          Please try again later.
        </p>
        <button className="secondary" onClick={signOut}>
          Sign out
        </button>
      </section>
    </div>
  );
}
