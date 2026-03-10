import { useKanbanStore } from "../store/kanbanStore";
import type { Card, Column } from "../types";

function formatCardAge(isoDate: string): string {
  const createdAt = Date.parse(isoDate);

  if (Number.isNaN(createdAt)) {
    return "unknown age";
  }

  const hours = Math.max(0, Math.floor((Date.now() - createdAt) / (1000 * 60 * 60)));

  if (hours < 24) {
    return `${hours}h old`;
  }

  return `${Math.floor(hours / 24)}d old`;
}

export default function Board() {
  const columns = useKanbanStore((state) => state.columns);
  const cards = useKanbanStore((state) => state.cards);
  const loading = useKanbanStore((state) => state.loading);
  const error = useKanbanStore((state) => state.error);
  const addCard = useKanbanStore((state) => state.addCard);
  const moveCard = useKanbanStore((state) => state.moveCard);
  const archiveCard = useKanbanStore((state) => state.archiveCard);
  const deleteCard = useKanbanStore((state) => state.deleteCard);

  const sortedColumns = [...columns].sort((left, right) => left.order - right.order);

  const handleAddCard = () => {
    void addCard({
      title: `Task ${cards.length + 1}`,
      description: "Quick-added from the board page.",
      category: "feature",
      priority: "medium",
    });
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: "0 0 0.25rem" }}>Board ({cards.length})</h1>
          <p style={{ margin: 0, color: "#666" }}>
            Cards are grouped by column. Use the quick actions to move, archive, or delete them.
          </p>
          {error ? (
            <p style={{ margin: "0.5rem 0 0", color: "#c23b22", fontSize: "0.875rem" }}>{error}</p>
          ) : null}
        </div>
        <button onClick={handleAddCard} disabled={loading}>
          {loading ? "Working..." : "Add Card"}
        </button>
      </div>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "1rem",
          marginTop: "1.5rem",
        }}
      >
        {sortedColumns.map((column, index) => {
          const cardsInColumn = cards.filter((card) => card.columnId === column.id);
          const previousColumnId = sortedColumns[index - 1]?.id;
          const nextColumnId = sortedColumns[index + 1]?.id;

          return (
            <BoardColumn
              key={column.id}
              column={column}
              cards={cardsInColumn}
              previousColumnId={previousColumnId}
              nextColumnId={nextColumnId}
              onMoveCard={(cardId, targetColumnId) => {
                void moveCard(cardId, targetColumnId);
              }}
              onArchiveCard={(cardId) => {
                void archiveCard(cardId);
              }}
              onDeleteCard={(cardId) => {
                void deleteCard(cardId);
              }}
              loading={loading}
            />
          );
        })}
      </section>
    </div>
  );
}

function BoardColumn({
  column,
  cards,
  previousColumnId,
  nextColumnId,
  onMoveCard,
  onArchiveCard,
  onDeleteCard,
  loading,
}: {
  column: Column;
  cards: Card[];
  previousColumnId?: string;
  nextColumnId?: string;
  onMoveCard: (cardId: string, targetColumnId: string) => void;
  onArchiveCard: (cardId: string) => void;
  onDeleteCard: (cardId: string) => void;
  loading: boolean;
}) {
  const count = cards.length;
  const reachedWipLimit =
    column.wipLimit !== undefined && column.wipLimit !== null && count >= column.wipLimit;

  return (
    <div
      style={{
        border: reachedWipLimit ? "1px solid #c23b22" : "1px solid #ddd",
        borderRadius: "8px",
        padding: "1rem",
        minHeight: "220px",
        backgroundColor: reachedWipLimit ? "#fff5f2" : "#fafafa",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "0.75rem",
          marginBottom: "0.75rem",
        }}
      >
        <strong>{column.title}</strong>
        <span style={{ fontSize: "0.875rem", color: reachedWipLimit ? "#c23b22" : "#666" }}>
          {column.wipLimit !== undefined ? `WIP: ${count} / ${column.wipLimit}` : `${count} cards`}
        </span>
      </div>

      {cards.length === 0 ? (
        <p style={{ margin: 0, fontSize: "0.875rem", color: "#888" }}>No cards in this column.</p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          {cards.map((card) => (
            <li
              key={card.id}
              style={{
                borderRadius: "6px",
                padding: "0.75rem",
                backgroundColor: "#fff",
                boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
              }}
            >
              <div style={{ fontWeight: 600 }}>{card.title}</div>
              <div style={{ marginTop: "0.25rem", fontSize: "0.85rem", color: "#555" }}>
                {card.description || "No description"}
              </div>
              <div style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "#666" }}>
                {card.category} | {card.priority ?? "no priority"} | {formatCardAge(card.createdAt)}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  flexWrap: "wrap",
                  marginTop: "0.75rem",
                }}
              >
                {previousColumnId ? (
                  <button onClick={() => onMoveCard(card.id, previousColumnId)} disabled={loading}>
                    Back
                  </button>
                ) : null}
                {nextColumnId ? (
                  <button onClick={() => onMoveCard(card.id, nextColumnId)} disabled={loading}>
                    Forward
                  </button>
                ) : null}
                <button onClick={() => onArchiveCard(card.id)} disabled={loading}>
                  Archive
                </button>
                <button onClick={() => onDeleteCard(card.id)} disabled={loading}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
