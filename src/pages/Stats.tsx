import type { Column } from "../types";
import { useKanbanStore } from "../store/kanbanStore";

function getThroughput(archivedCountDates: string[]): number {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  return archivedCountDates.filter((archivedAt) => {
    const parsed = Date.parse(archivedAt);

    return !Number.isNaN(parsed) && parsed >= sevenDaysAgo;
  }).length;
}

export default function Stats() {
  const columns = useKanbanStore((state) => state.columns);
  const cards = useKanbanStore((state) => state.cards);
  const archivedEntries = useKanbanStore((state) => state.archivedEntries);
  const swimlaneGroupBy = useKanbanStore((state) => state.swimlaneGroupBy);

  const sortedColumns = [...columns].sort((left, right) => left.order - right.order);
  const countsByColumn = columns.reduce<Record<string, number>>((result, column) => {
    result[column.id] = 0;
    return result;
  }, {});

  for (const card of cards) {
    countsByColumn[card.columnId] = (countsByColumn[card.columnId] ?? 0) + 1;
  }

  const throughput = getThroughput(archivedEntries.map((entry) => entry.archivedAt));

  return (
    <div>
      <h1 style={{ margin: "0 0 0.25rem" }}>Stats</h1>
      <p style={{ margin: 0, color: "#666" }}>
        Column-level and board-level metrics are derived from the shared Kanban state.
      </p>

      <section
        style={{
          marginTop: "1.5rem",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: "1rem",
        }}
      >
        {sortedColumns.map((column) => (
          <StatCard
            key={column.id}
            title={column.title}
            count={countsByColumn[column.id] ?? 0}
            wipLimit={column.wipLimit}
          />
        ))}
      </section>

      <section
        style={{
          marginTop: "1.5rem",
          border: "1px solid #eee",
          borderRadius: "8px",
          padding: "1rem",
          backgroundColor: "#fafafa",
        }}
      >
        <h2 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>Board Summary</h2>
        <p style={{ margin: "0 0 0.5rem", fontSize: "0.875rem", color: "#666" }}>
          Total active cards: <strong>{cards.length}</strong>
        </p>
        <p style={{ margin: "0 0 0.5rem", fontSize: "0.875rem", color: "#666" }}>
          Archived in the last 7 days: <strong>{throughput}</strong>
        </p>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "#666" }}>
          Swimlane grouping: <strong>{swimlaneGroupBy ?? "none"}</strong>
        </p>
      </section>
    </div>
  );
}

function StatCard({
  title,
  count,
  wipLimit,
}: {
  title: Column["title"];
  count: number;
  wipLimit?: number;
}) {
  const hasReachedLimit = wipLimit !== undefined && count >= wipLimit;

  return (
    <div
      style={{
        border: hasReachedLimit ? "1px solid #c23b22" : "1px solid #ddd",
        borderRadius: "8px",
        padding: "1rem",
        textAlign: "center",
        backgroundColor: hasReachedLimit ? "#fff5f2" : "#fff",
      }}
    >
      <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>{count}</div>
      <div style={{ fontSize: "0.875rem", color: "#666" }}>{title}</div>
      <div
        style={{
          marginTop: "0.5rem",
          fontSize: "0.8rem",
          color: hasReachedLimit ? "#c23b22" : "#888",
        }}
      >
        {wipLimit !== undefined ? `WIP limit: ${wipLimit}` : "No WIP limit"}
      </div>
    </div>
  );
}
