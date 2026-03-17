import { useState } from "react";
import { useAuthStore } from "../store/authStore";

export default function Login() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupDone, setSignupDone] = useState(false);

  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signin") {
      await signIn(email, password);
    } else {
      await signUp(email, password);
      setSignupDone(true);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f5f5f5",
      }}
    >
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "10px",
          padding: "2rem",
          width: "100%",
          maxWidth: "380px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
        }}
      >
        <h1 style={{ margin: "0 0 0.25rem", fontSize: "1.4rem" }}>Personal Kanban</h1>
        <p style={{ margin: "0 0 1.5rem", color: "#666", fontSize: "0.875rem" }}>
          {mode === "signin" ? "Sign in to your board" : "Create a new account"}
        </p>

        <div
          style={{
            display: "flex",
            border: "1px solid #ddd",
            borderRadius: "6px",
            overflow: "hidden",
            marginBottom: "1.25rem",
          }}
        >
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setSignupDone(false);
              }}
              style={{
                flex: 1,
                padding: "0.5rem",
                fontSize: "0.875rem",
                backgroundColor: mode === m ? "#333" : "#fff",
                color: mode === m ? "#fff" : "#333",
                border: "none",
                cursor: "pointer",
              }}
            >
              {m === "signin" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        {signupDone && mode === "signup" ? (
          <div
            style={{
              padding: "0.75rem",
              backgroundColor: "#f0faf0",
              border: "1px solid #b2dfb2",
              borderRadius: "6px",
              fontSize: "0.875rem",
              color: "#2e7d32",
            }}
          >
            Account created! Check your email to confirm, then sign in.
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)}>
            <label style={{ display: "block", marginBottom: "0.75rem" }}>
              <span
                style={{
                  fontSize: "0.875rem",
                  color: "#555",
                  display: "block",
                  marginBottom: "0.25rem",
                }}
              >
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                style={{
                  width: "100%",
                  padding: "0.5rem 0.6rem",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "0.95rem",
                  boxSizing: "border-box",
                }}
              />
            </label>

            <label style={{ display: "block", marginBottom: "1.25rem" }}>
              <span
                style={{
                  fontSize: "0.875rem",
                  color: "#555",
                  display: "block",
                  marginBottom: "0.25rem",
                }}
              >
                Password
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.6rem",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "0.95rem",
                  boxSizing: "border-box",
                }}
              />
            </label>

            {error ? (
              <p
                style={{
                  margin: "0 0 0.75rem",
                  color: "#c23b22",
                  fontSize: "0.875rem",
                }}
              >
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "0.6rem",
                fontSize: "0.95rem",
                backgroundColor: "#333",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Working..." : mode === "signin" ? "Sign In" : "Sign Up"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
