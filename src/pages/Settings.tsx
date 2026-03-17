import { useState } from "react";
import { useAuthStore } from "../store/authStore";
import { useBoardsStore } from "../store/boardsStore";

const USE_SUPABASE = !!import.meta.env.VITE_SUPABASE_URL;

export default function Settings() {
  const user              = useAuthStore((s) => s.user);
  const loading           = useAuthStore((s) => s.loading);
  const error             = useAuthStore((s) => s.error);
  const updateDisplayName = useAuthStore((s) => s.updateDisplayName);
  const boards            = useBoardsStore((s) => s.boards);
  const activeBoardId     = useBoardsStore((s) => s.activeBoardId);
  const activeBoard       = boards.find((b) => b.id === activeBoardId);

  const currentName = (user?.user_metadata?.display_name as string | undefined) ?? "";
  const [nameInput, setNameInput] = useState(currentName);
  const [saved, setSaved]         = useState(false);

  const isDirty    = nameInput.trim() !== currentName;
  const canSave    = isDirty && nameInput.trim().length > 0 && !loading;

  const handleSave = async () => {
    await updateDisplayName(nameInput.trim());
    if (!useAuthStore.getState().error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#111827", letterSpacing: "-0.02em" }}>
          Settings
        </h1>
        <p style={{ margin: "0.3rem 0 0", color: "#6b7280", fontSize: "0.875rem" }}>
          Account and application preferences.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", maxWidth: "540px" }}>

        {USE_SUPABASE && user && (
          <Section title="Account">
            <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9" }}>
              <label style={{ display: "block", marginBottom: "0.75rem" }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#374151", display: "block", marginBottom: "0.3rem" }}>
                  Display name
                </span>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => { setNameInput(e.target.value); setSaved(false); }}
                    onKeyDown={(e) => e.key === "Enter" && canSave && void handleSave()}
                    placeholder="Enter your name…"
                    style={{
                      flex: 1,
                      padding: "0.45rem 0.65rem",
                      border: "1px solid #d1d5db",
                      borderRadius: "7px",
                      fontSize: "0.875rem",
                      outline: "none",
                      backgroundColor: "#fafafa",
                      color: "#111827",
                    }}
                  />
                  <button
                    onClick={() => void handleSave()}
                    disabled={!canSave}
                    style={{
                      padding: "0.45rem 1rem",
                      background: canSave ? "linear-gradient(135deg, #4f46e5, #7c3aed)" : undefined,
                      backgroundColor: canSave ? undefined : "#e5e7eb",
                      border: "none",
                      borderRadius: "7px",
                      cursor: canSave ? "pointer" : "not-allowed",
                      fontSize: "0.875rem",
                      color: canSave ? "#fff" : "#9ca3af",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      boxShadow: canSave ? "0 2px 6px rgba(79,70,229,0.25)" : "none",
                    }}
                  >
                    {loading ? "Saving…" : saved ? "Saved!" : "Save"}
                  </button>
                </div>
                {saved && (
                  <p style={{ margin: "0.4rem 0 0", fontSize: "0.8rem", color: "#16a34a" }}>
                    Display name updated successfully.
                  </p>
                )}
                {error && (
                  <p style={{ margin: "0.4rem 0 0", fontSize: "0.8rem", color: "#b91c1c" }}>{error}</p>
                )}
              </label>
            </div>
            <Row label="Email"       value={user.email ?? "—"} />
            <Row label="User ID"     value={user.id} mono />
            <Row label="Last sign-in" value={user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "—"} />
          </Section>
        )}

        {USE_SUPABASE && !user && (
          <Section title="Account">
            <p style={{ margin: 0, padding: "1rem 1.25rem", fontSize: "0.875rem", color: "#6b7280" }}>
              Not signed in.
            </p>
          </Section>
        )}

        {USE_SUPABASE && (
          <Section title="Active Board">
            {activeBoard ? (
              <>
                <Row label="Name"    value={activeBoard.name} />
                <Row label="Type"    value={activeBoard.type} />
                {activeBoard.type === "team" && activeBoard.joinCode && (
                  <Row label="Join code" value={activeBoard.joinCode} mono />
                )}
                <Row label="Members" value={String(activeBoard.memberCount)} />
              </>
            ) : (
              <p style={{ margin: 0, padding: "1rem 1.25rem", fontSize: "0.875rem", color: "#6b7280" }}>
                No active board.
              </p>
            )}
          </Section>
        )}

        <Section title="Application">
          <Row label="Mode"    value={USE_SUPABASE ? "Supabase (cloud)" : "In-memory (demo)"} />
          <Row label="Version" value="1.0.0" />
          <Row label="Theme"   value="Personal Kanban" />
        </Section>

      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        overflow: "hidden",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          padding: "0.7rem 1.25rem",
          backgroundColor: "#f8f9fa",
          borderBottom: "1px solid #e2e8f0",
          fontSize: "0.75rem",
          fontWeight: 700,
          color: "#6b7280",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {title}
      </div>
      <div style={{ padding: "0.5rem 0" }}>
        {children}
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "0.55rem 1.25rem",
        borderBottom: "1px solid #f1f5f9",
        gap: "1rem",
      }}
    >
      <span style={{ fontSize: "0.84rem", color: "#374151", fontWeight: 500, minWidth: "120px", flexShrink: 0 }}>
        {label}
      </span>
      <span
        style={{
          fontSize: "0.84rem",
          color: "#6b7280",
          fontFamily: mono ? "monospace" : "inherit",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </span>
    </div>
  );
}
