import { useKanbanStore } from "../store/kanbanStore";

function formatTimestamp(isoDate: string): string {
  const parsed = Date.parse(isoDate);

  if (Number.isNaN(parsed)) {
    return "Unknown time";
  }

  return new Date(parsed).toLocaleString();
}

export default function Archive() {
  const columns = useKanbanStore((state) => state.columns);
  const archivedEntries = useKanbanStore((state) => state.archivedEntries);
  const loading = useKanbanStore((state) => state.loading);
  const error = useKanbanStore((state) => state.error);
  const restoreArchivedCard = useKanbanStore((state) => state.restoreArchivedCard);

  const defaultColumnId = [...columns].sort((left, right) => left.order - right.order)[0]?.id;

  return (
    <div>
      <h1 style={{ margin: "0 0 0.25rem" }}>Archive ({archivedEntries.length})</h1>
      <p style={{ margin: 0, color: "#666" }}>
        Archived cards keep their movement history and can be restored to the board.
      </p>
      {error ? (
        <p style={{ margin: "0.5rem 0 0", color: "#c23b22", fontSize: "0.875rem" }}>{error}</p>
      ) : null}

      <section
        style={{
          marginTop: "1.5rem",
          border: "1px solid #eee",
          borderRadius: "8px",
          padding: "1.5rem",
          backgroundColor: "#f9f9f9",
        }}
      >
        {archivedEntries.length === 0 ? (
          <p style={{ margin: 0, color: "#666", fontSize: "0.875rem" }}>
            No archived cards yet. Archive one from the Board page to see it here.
          </p>
        ) : (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            {archivedEntries.map((entry) => (
              <li
                key={entry.card.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  padding: "1rem",
                  backgroundColor: "#fff",
                }}
              >
                <div style={{ fontWeight: 600 }}>{entry.card.title}</div>
                <div style={{ marginTop: "0.25rem", fontSize: "0.875rem", color: "#555" }}>
                  {entry.card.description || "No description"}
                </div>
                <div style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "#666" }}>
                  Archived: {formatTimestamp(entry.archivedAt)} | Moves: {entry.card.moves.length}
                </div>
                {defaultColumnId ? (
                  <button
                    style={{ marginTop: "0.75rem" }}
                    onClick={() => {
                      void restoreArchivedCard(entry.card.id, defaultColumnId);
                    }}
                    disabled={loading}
                  >
                    {loading ? "Working..." : "Restore to Board"}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
