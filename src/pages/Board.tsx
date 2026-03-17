import { useState } from "react";
import { useKanbanStore } from "../store/kanbanStore";
import { useBoardsStore } from "../store/boardsStore";
import type { Card, CardCategory, CardPriority, Column, SwimlaneGroupBy } from "../types";
import type { UpdateCardRequest } from "../services/api";

const CATEGORY_COLORS: Record<CardCategory, { bg: string; text: string; border: string }> = {
  bug:     { bg: "#fef2f2", text: "#b91c1c", border: "#fca5a5" },
  feature: { bg: "#eff6ff", text: "#1d4ed8", border: "#93c5fd" },
  docs:    { bg: "#f0fdf4", text: "#15803d", border: "#86efac" },
};

const PRIORITY_CONFIG: Record<CardPriority, { bg: string; text: string; border: string; icon: string; label: string }> = {
  high:   { bg: "#fef2f2", text: "#b91c1c", border: "#fca5a5", icon: "▲", label: "High"   },
  medium: { bg: "#fffbeb", text: "#b45309", border: "#fcd34d", icon: "▬", label: "Medium" },
  low:    { bg: "#f0fdf4", text: "#15803d", border: "#86efac", icon: "▽", label: "Low"    },
};

const COLUMN_ACCENTS = ["#4f46e5", "#0891b2", "#16a34a", "#d97706", "#9333ea"];

function formatCardAge(isoDate: string): string {
  const hours = Math.max(0, Math.floor((Date.now() - Date.parse(isoDate)) / 3_600_000));
  if (Number.isNaN(hours)) return "?";
  if (hours < 1) return "<1h";
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function formatColumnAge(isoDate: string): string {
  const hours = Math.max(0, Math.floor((Date.now() - Date.parse(isoDate)) / 3_600_000));
  if (Number.isNaN(hours)) return "?";
  if (hours < 1) return "<1h";
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

type SwimlaneGroup = { key: string; label: string; cards: Card[] };

function groupCards(cards: Card[], groupBy: SwimlaneGroupBy | null): SwimlaneGroup[] {
  if (!groupBy) return [{ key: "_all", label: "", cards }];
  const buckets = new Map<string, Card[]>();
  for (const card of cards) {
    const key =
      groupBy === "category"
        ? card.category
        : groupBy === "priority"
          ? (card.priority ?? "none")
          : (card.assignee ?? "Unassigned");
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(card);
  }
  return Array.from(buckets.entries()).map(([key, grouped]) => ({
    key,
    label: key.charAt(0).toUpperCase() + key.slice(1),
    cards: grouped,
  }));
}

export default function Board() {
  const columns          = useKanbanStore((s) => s.columns);
  const cards            = useKanbanStore((s) => s.cards);
  const filter           = useKanbanStore((s) => s.filter);
  const swimlaneGroupBy  = useKanbanStore((s) => s.swimlaneGroupBy);
  const loading          = useKanbanStore((s) => s.loading);
  const error            = useKanbanStore((s) => s.error);
  const addCard          = useKanbanStore((s) => s.addCard);
  const editCard         = useKanbanStore((s) => s.editCard);
  const moveCard         = useKanbanStore((s) => s.moveCard);
  const archiveCard      = useKanbanStore((s) => s.archiveCard);
  const deleteCard       = useKanbanStore((s) => s.deleteCard);
  const setFilter        = useKanbanStore((s) => s.setFilter);
  const setSwimlaneGroupBy = useKanbanStore((s) => s.setSwimlaneGroupBy);
  const editColumn       = useKanbanStore((s) => s.editColumn);
  const removeColumn     = useKanbanStore((s) => s.removeColumn);

  const boards          = useBoardsStore((s) => s.boards);
  const activeBoardId   = useBoardsStore((s) => s.activeBoardId);
  const boardMembers    = useBoardsStore((s) => s.boardMembers);
  const activeBoard     = boards.find((b) => b.id === activeBoardId);
  const isTeamBoard     = activeBoard?.type === "team";
  const memberEmails    = boardMembers.map((m) => m.email);

  const [createModalColumnId, setCreateModalColumnId] = useState<string | null>(null);
  const [editingCard, setEditingCard]                 = useState<Card | null>(null);
  const [columnModalTarget, setColumnModalTarget]     = useState<string | null>(null);

  const [draggingCardId, setDraggingCardId]   = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);

  const sortedColumns = [...columns].sort((a, b) => a.order - b.order);

  const filteredCards = cards.filter((card) => {
    if (filter.category && card.category !== filter.category) return false;
    if (filter.searchQuery) {
      const q = filter.searchQuery.toLowerCase();
      if (!card.title.toLowerCase().includes(q) && !card.description.toLowerCase().includes(q))
        return false;
    }
    return true;
  });

  const handleCreateCardSubmit = async (values: {
    title: string; description: string; category: CardCategory;
    priority: CardPriority; assignee: string; columnId: string;
  }) => {
    await addCard({ ...values, assignee: values.assignee || undefined });
    if (!useKanbanStore.getState().error) setCreateModalColumnId(null);
  };

  const handleEditCardSubmit = async (cardId: string, payload: UpdateCardRequest) => {
    await editCard(cardId, payload);
    if (!useKanbanStore.getState().error) setEditingCard(null);
  };

  const handleDeleteColumn = (columnId: string) => {
    const fallback = sortedColumns.find((c) => c.id !== columnId)?.id;
    void removeColumn(columnId, fallback);
  };

  const editingColumn = columnModalTarget
    ? columns.find((c) => c.id === columnModalTarget) ?? null
    : null;

  const categoryOptions: Array<{ value: CardCategory | null; label: string }> = [
    { value: null,      label: "All" },
    { value: "bug",     label: "Bug" },
    { value: "feature", label: "Feature" },
    { value: "docs",    label: "Docs" },
  ];

  const swimlaneOptions: Array<{ value: SwimlaneGroupBy | null; label: string }> = [
    { value: null,       label: "None" },
    { value: "category", label: "Category" },
    { value: "assignee", label: "Assignee" },
    { value: "priority", label: "Priority" },
  ];

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "1rem",
          flexWrap: "wrap",
          marginBottom: "1.25rem",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#111827", letterSpacing: "-0.02em" }}>
            {activeBoard ? activeBoard.name : "Board"}
            <span style={{ marginLeft: "0.5rem", fontSize: "0.9rem", fontWeight: 400, color: "#9ca3af" }}>
              {cards.length} card{cards.length !== 1 ? "s" : ""}
            </span>
          </h1>
          {error ? (
            <p style={{ margin: "0.4rem 0 0", color: "#b91c1c", fontSize: "0.85rem" }}>{error}</p>
          ) : null}
        </div>
        <button
          onClick={() => setCreateModalColumnId(sortedColumns[0]?.id ?? "")}
          disabled={loading}
          style={{
            padding: "0.5rem 1.1rem",
            background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontWeight: 600,
            fontSize: "0.875rem",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
            boxShadow: "0 2px 8px rgba(79,70,229,0.3)",
            letterSpacing: "0.01em",
          }}
        >
          + New Card
        </button>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          alignItems: "center",
          padding: "0.6rem 1rem",
          backgroundColor: "#fff",
          borderRadius: "10px",
          border: "1px solid #e8eaed",
          marginBottom: "1.5rem",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <input
          type="text"
          placeholder="Search cards…"
          value={filter.searchQuery}
          onChange={(e) => void setFilter({ searchQuery: e.target.value })}
          style={{
            padding: "0.35rem 0.75rem",
            border: "1px solid #e0e0e0",
            borderRadius: "6px",
            fontSize: "0.84rem",
            minWidth: "180px",
            outline: "none",
            color: "#374151",
          }}
        />

        <Divider />
        <Label text="Category" />
        {categoryOptions.map(({ value, label }) => (
          <FilterChip
            key={String(value)}
            label={label}
            active={filter.category === value}
            onClick={() => void setFilter({ category: value })}
          />
        ))}

        <Divider />
        <Label text="Group" />
        {swimlaneOptions.map(({ value, label }) => (
          <FilterChip
            key={String(value)}
            label={label}
            active={swimlaneGroupBy === value}
            onClick={() => void setSwimlaneGroupBy(value)}
          />
        ))}
      </div>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${sortedColumns.length}, minmax(260px, 1fr))`,
          gap: "1.25rem",
          alignItems: "start",
        }}
      >
        {sortedColumns.map((column, colIdx) => {
          const cardsInColumn = filteredCards.filter((c) => c.columnId === column.id);
          const accentColor = COLUMN_ACCENTS[colIdx % COLUMN_ACCENTS.length];
          return (
            <BoardColumn
              key={column.id}
              column={column}
              cards={cardsInColumn}
              accentColor={accentColor}
              swimlaneGroupBy={swimlaneGroupBy}
              loading={loading}
              draggingCardId={draggingCardId}
              isDragOver={dragOverColumnId === column.id}
              canDeleteColumn={sortedColumns.length > 3}
              onArchiveCard={(id) => void archiveCard(id)}
              onDeleteCard={(id) => void deleteCard(id)}
              onEditCard={(card) => setEditingCard(card)}
              onAddCard={() => setCreateModalColumnId(column.id)}
              onEditColumn={() => setColumnModalTarget(column.id)}
              onDeleteColumn={() => handleDeleteColumn(column.id)}
              onCardDragStart={(id) => setDraggingCardId(id)}
              onCardDragEnd={() => { setDraggingCardId(null); setDragOverColumnId(null); }}
              onColumnDragOver={() => setDragOverColumnId(column.id)}
              onColumnDragLeave={() => setDragOverColumnId(null)}
              onColumnDrop={() => {
                if (draggingCardId) void moveCard(draggingCardId, column.id);
                setDraggingCardId(null);
                setDragOverColumnId(null);
              }}
            />
          );
        })}
      </section>

      {createModalColumnId !== null && (
        <CardFormModal
          mode="create"
          columns={sortedColumns}
          defaultColumnId={createModalColumnId || sortedColumns[0]?.id}
          isTeamBoard={isTeamBoard}
          memberEmails={memberEmails}
          storeError={error}
          onSubmit={(v) => void handleCreateCardSubmit(v)}
          onCancel={() => setCreateModalColumnId(null)}
        />
      )}
      {editingCard !== null && (
        <CardFormModal
          mode="edit"
          initialValues={{
            title: editingCard.title,
            description: editingCard.description,
            category: editingCard.category,
            priority: editingCard.priority ?? "medium",
            assignee: editingCard.assignee ?? "",
            columnId: editingCard.columnId,
          }}
          columns={sortedColumns}
          isTeamBoard={isTeamBoard}
          memberEmails={memberEmails}
          storeError={error}
          onSubmit={(v) =>
            void handleEditCardSubmit(editingCard.id, {
              title: v.title, description: v.description,
              category: v.category, priority: v.priority, assignee: v.assignee,
            })
          }
          onCancel={() => setEditingCard(null)}
        />
      )}
      {columnModalTarget !== null && editingColumn && (
        <ColumnFormModal
          initialValues={{
            title: editingColumn.title,
            wipLimit: editingColumn.wipLimit !== undefined ? String(editingColumn.wipLimit) : "",
          }}
          onSubmit={(title, wipLimit) => {
            void editColumn(columnModalTarget, { title, wipLimit });
            setColumnModalTarget(null);
          }}
          onCancel={() => setColumnModalTarget(null)}
        />
      )}
    </div>
  );
}

function Divider() {
  return <div style={{ width: "1px", height: "18px", backgroundColor: "#e5e7eb", margin: "0 0.1rem" }} />;
}
function Label({ text }: { text: string }) {
  return <span style={{ fontSize: "0.72rem", color: "#9ca3af", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>{text}</span>;
}
function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "0.25rem 0.65rem",
        fontSize: "0.78rem",
        fontWeight: active ? 600 : 400,
        backgroundColor: active ? "#4f46e5" : hovered ? "#e8eaed" : "#f3f4f6",
        color: active ? "#fff" : "#555",
        border: "1px solid",
        borderColor: active ? "#4f46e5" : hovered ? "#c9cbd0" : "#e0e0e0",
        borderRadius: "20px",
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );
}

function AddCardButton({ onClick, disabled, accentColor }: { onClick: () => void; disabled: boolean; accentColor: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ padding: "0 0.75rem 0.75rem" }}>
      <button
        onClick={onClick}
        disabled={disabled}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: "100%",
          padding: "0.4rem",
          fontSize: "0.8rem",
          backgroundColor: hovered && !disabled ? `${accentColor}12` : "transparent",
          border: `1.5px dashed ${hovered && !disabled ? accentColor : "#d1d5db"}`,
          borderRadius: "7px",
          cursor: disabled ? "not-allowed" : "pointer",
          color: hovered && !disabled ? accentColor : "#9ca3af",
          fontWeight: hovered && !disabled ? 600 : 400,
          transition: "all 0.2s",
        }}
      >
        + Add Card
      </button>
    </div>
  );
}

function BoardColumn({
  column, cards, swimlaneGroupBy, loading, draggingCardId, isDragOver,
  canDeleteColumn, accentColor, onArchiveCard, onDeleteCard, onEditCard, onAddCard,
  onEditColumn, onDeleteColumn, onCardDragStart, onCardDragEnd,
  onColumnDragOver, onColumnDragLeave, onColumnDrop,
}: {
  column: Column; cards: Card[]; swimlaneGroupBy: SwimlaneGroupBy | null;
  loading: boolean; draggingCardId: string | null; isDragOver: boolean;
  canDeleteColumn: boolean; accentColor: string;
  onArchiveCard: (id: string) => void; onDeleteCard: (id: string) => void;
  onEditCard: (card: Card) => void; onAddCard: () => void;
  onEditColumn: () => void; onDeleteColumn: () => void;
  onCardDragStart: (id: string) => void; onCardDragEnd: () => void;
  onColumnDragOver: () => void; onColumnDragLeave: () => void;
  onColumnDrop: () => void;
}) {
  const count = cards.length;
  const wipReached = column.wipLimit !== undefined && count >= column.wipLimit;
  const groups = groupCards(cards, swimlaneGroupBy);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); onColumnDragOver(); }}
      onDragLeave={onColumnDragLeave}
      onDrop={(e) => { e.preventDefault(); onColumnDrop(); }}
      style={{
        backgroundColor: isDragOver ? "#f5f3ff" : "#f8f9fa",
        borderRadius: "12px",
        border: isDragOver
          ? `2px dashed ${accentColor}`
          : wipReached
            ? "1px solid #fca5a5"
            : "1px solid #e2e8f0",
        boxShadow: isDragOver ? `0 4px 20px ${accentColor}22` : "0 1px 4px rgba(0,0,0,0.04)",
        display: "flex",
        flexDirection: "column",
        minHeight: "300px",
        transition: "background-color 0.15s, border-color 0.15s, box-shadow 0.15s",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "0.8rem 0.9rem 0.65rem",
          borderBottom: "1px solid #eaecef",
          borderTop: `3px solid ${isDragOver ? accentColor : accentColor}`,
          backgroundColor: "#fff",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <strong style={{ flex: 1, fontSize: "0.875rem", color: "#111827", letterSpacing: "-0.01em" }}>
          {column.title}
        </strong>
        <span
          style={{
            fontSize: "0.7rem",
            fontWeight: 700,
            padding: "0.15rem 0.5rem",
            borderRadius: "20px",
            backgroundColor: wipReached ? "#fef2f2" : `${accentColor}18`,
            color: wipReached ? "#b91c1c" : accentColor,
          }}
        >
          {column.wipLimit !== undefined ? `${count}/${column.wipLimit}` : count}
        </span>
        <button
          onClick={onEditColumn}
          disabled={loading}
          title="Edit column"
          style={{
            fontSize: "0.7rem",
            padding: "0.15rem 0.4rem",
            backgroundColor: "transparent",
            border: "1px solid #e5e7eb",
            borderRadius: "5px",
            cursor: "pointer",
            color: "#6b7280",
          }}
        >
          Edit
        </button>
        {canDeleteColumn && (
          <button
            onClick={onDeleteColumn}
            disabled={loading}
            title="Delete column"
            style={{
              fontSize: "0.7rem",
              padding: "0.15rem 0.4rem",
              backgroundColor: "transparent",
              border: "1px solid #fca5a5",
              borderRadius: "5px",
              cursor: "pointer",
              color: "#ef4444",
            }}
          >
            Del
          </button>
        )}
      </div>

      <div style={{ flex: 1, padding: "0.6rem" }}>
        {cards.length === 0 ? (
          <div style={{ padding: "2rem 1rem", textAlign: "center", color: "#d1d5db" }}>
            <p style={{ margin: 0, fontSize: "0.8rem" }}>No cards</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {groups.map((group) => (
              <div key={group.key}>
                {swimlaneGroupBy !== null && (
                  <div
                    style={{
                      fontSize: "0.67rem",
                      fontWeight: 700,
                      color: "#9ca3af",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      padding: "0.15rem 0",
                      borderBottom: "1px solid #eaecef",
                      marginBottom: "0.4rem",
                    }}
                  >
                    {group.label}
                  </div>
                )}
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                  {group.cards.map((card) => (
                    <KanbanCard
                      key={card.id}
                      card={card}
                      loading={loading}
                      isDragging={draggingCardId === card.id}
                      onEdit={() => onEditCard(card)}
                      onArchive={() => onArchiveCard(card.id)}
                      onDelete={() => onDeleteCard(card.id)}
                      onDragStart={() => onCardDragStart(card.id)}
                      onDragEnd={onCardDragEnd}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      <AddCardButton onClick={onAddCard} disabled={loading} accentColor={accentColor} />
    </div>
  );
}

function KanbanCard({
  card, loading, isDragging, onEdit, onArchive, onDelete, onDragStart, onDragEnd,
}: {
  card: Card; loading: boolean; isDragging: boolean;
  onEdit: () => void; onArchive: () => void; onDelete: () => void;
  onDragStart: () => void; onDragEnd: () => void;
}) {
  const cat  = CATEGORY_COLORS[card.category];
  const pcfg = card.priority ? PRIORITY_CONFIG[card.priority] : null;

  return (
    <li
      className="kanban-card"
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{
        backgroundColor: "#fff",
        border: "1px solid #e2e8f0",
        borderLeft: `3px solid ${cat.border}`,
        borderRight: pcfg && card.priority === "high" ? `3px solid ${pcfg.border}` : "1px solid #e2e8f0",
        borderRadius: "8px",
        padding: "0.65rem 0.75rem",
        boxShadow: isDragging ? "0 8px 24px rgba(0,0,0,0.15)" : "0 1px 2px rgba(0,0,0,0.04)",
        opacity: isDragging ? 0.45 : 1,
        cursor: isDragging ? "grabbing" : "grab",
        transition: "box-shadow 0.15s, opacity 0.15s",
      }}
    >
      <div className="card-actions">
        <HoverAction onClick={onEdit}    disabled={loading} title="Edit"    label="Edit"    color="#4f46e5" />
        <HoverAction onClick={onArchive} disabled={loading} title="Archive" label="Archive" color="#d97706" />
        <HoverAction onClick={onDelete}  disabled={loading} title="Delete"  label="Delete"  color="#ef4444" />
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.4rem" }}>
        <div style={{ flex: 1, fontWeight: 600, fontSize: "0.875rem", color: "#111827", lineHeight: 1.35 }}>
          {card.title}
        </div>
        {pcfg && card.priority && <PriorityPill priority={card.priority} />}
      </div>

      {card.description && (
        <p
          style={{
            margin: "0.3rem 0 0",
            fontSize: "0.78rem",
            color: "#6b7280",
            lineHeight: 1.45,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {card.description}
        </p>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginTop: "0.55rem", flexWrap: "wrap" }}>
        <Badge bg={cat.bg} text={cat.text} label={card.category} />
        <span style={{ marginLeft: "auto", fontSize: "0.68rem", color: "#9ca3af", whiteSpace: "nowrap" }}>
          {formatCardAge(card.createdAt)} · col {formatColumnAge(card.columnEnteredAt)}
        </span>
        {card.assignee && <AssigneeAvatar email={card.assignee} />}
      </div>
    </li>
  );
}

function HoverAction({ onClick, disabled, title, label, color }: {
  onClick: () => void; disabled: boolean; title: string; label: string; color: string;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      disabled={disabled}
      title={title}
      style={{
        fontSize: "0.68rem",
        fontWeight: 600,
        padding: "0.1rem 0.3rem",
        background: "none",
        border: "none",
        borderRadius: "3px",
        cursor: disabled ? "not-allowed" : "pointer",
        color,
        opacity: disabled ? 0.4 : 1,
        lineHeight: 1,
      }}
    >
      {label}
    </button>
  );
}

function PriorityPill({ priority }: { priority: CardPriority }) {
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.2rem",
        fontSize: "0.67rem",
        fontWeight: 700,
        padding: "0.15rem 0.45rem",
        borderRadius: "4px",
        backgroundColor: cfg.bg,
        color: cfg.text,
        border: `1px solid ${cfg.border}`,
        flexShrink: 0,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        lineHeight: 1,
      }}
    >
      <span style={{ fontSize: "0.6rem" }}>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

function Badge({ bg, text, label }: { bg: string; text: string; label: string }) {
  return (
    <span
      style={{
        fontSize: "0.63rem",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        padding: "0.1rem 0.35rem",
        borderRadius: "4px",
        backgroundColor: bg,
        color: text,
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  );
}

function AssigneeAvatar({ email }: { email: string }) {
  const initial = email.charAt(0).toUpperCase();
  const hue = email.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return (
    <span
      title={email}
      style={{
        width: "20px",
        height: "20px",
        borderRadius: "50%",
        backgroundColor: `hsl(${hue},55%,52%)`,
        color: "#fff",
        fontSize: "0.62rem",
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        cursor: "default",
      }}
    >
      {initial}
    </span>
  );
}

interface CardFormValues {
  title: string; description: string; category: CardCategory;
  priority: CardPriority; assignee: string; columnId: string;
}

function CardFormModal({
  mode, initialValues, columns, defaultColumnId, isTeamBoard, memberEmails, storeError, onSubmit, onCancel,
}: {
  mode: "create" | "edit"; initialValues?: CardFormValues; columns: Column[];
  defaultColumnId?: string; isTeamBoard: boolean; memberEmails: string[];
  storeError: string | null;
  onSubmit: (values: CardFormValues) => void; onCancel: () => void;
}) {
  const loading = useKanbanStore((s) => s.loading);
  const [title,       setTitle]       = useState(initialValues?.title ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [category,    setCategory]    = useState<CardCategory>(initialValues?.category ?? "feature");
  const [priority,    setPriority]    = useState<CardPriority>(initialValues?.priority ?? "medium");
  const [assignee,    setAssignee]    = useState(initialValues?.assignee ?? "");
  const [columnId,    setColumnId]    = useState(
    initialValues?.columnId ?? defaultColumnId ?? columns[0]?.id ?? ""
  );

  const assigneeOptions = [
    "",
    ...new Set([...memberEmails, ...(initialValues?.assignee ? [initialValues.assignee] : [])]),
  ];

  return (
    <Overlay onClose={onCancel}>
      <h2 style={{ margin: "0 0 1rem", fontSize: "1.05rem", fontWeight: 700, color: "#111827" }}>
        {mode === "create" ? "New Card" : "Edit Card"}
      </h2>
      {storeError && (
        <p style={{ margin: "0 0 0.75rem", color: "#b91c1c", fontSize: "0.84rem", backgroundColor: "#fef2f2", padding: "0.5rem 0.75rem", borderRadius: "6px" }}>
          {storeError}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          onSubmit({ title: title.trim(), description, category, priority, assignee, columnId });
        }}
      >
        <Field label="Title *">
          <input
            type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            autoFocus style={inputStyle}
          />
        </Field>
        <Field label="Description">
          <textarea
            value={description} onChange={(e) => setDescription(e.target.value)}
            rows={3} style={{ ...inputStyle, resize: "vertical" }}
          />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <Field label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value as CardCategory)} style={inputStyle}>
              <option value="feature">Feature</option>
              <option value="bug">Bug</option>
              <option value="docs">Docs</option>
            </select>
          </Field>
          <Field label="Priority">
            <select value={priority} onChange={(e) => setPriority(e.target.value as CardPriority)} style={inputStyle}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </Field>
        </div>

        {isTeamBoard && (
          <Field label="Assignee">
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)} style={inputStyle}>
              {assigneeOptions.map((email) => (
                <option key={email} value={email}>
                  {email === "" ? "— Unassigned —" : email}
                </option>
              ))}
            </select>
          </Field>
        )}

        {mode === "create" && (
          <Field label="Column">
            <select value={columnId} onChange={(e) => setColumnId(e.target.value)} style={inputStyle}>
              {columns.map((col) => (
                <option key={col.id} value={col.id}>{col.title}</option>
              ))}
            </select>
          </Field>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.75rem" }}>
          <button type="button" onClick={onCancel} disabled={loading} style={cancelBtnStyle}>
            Cancel
          </button>
          <button type="submit" disabled={!title.trim() || loading} style={primaryBtnStyle(!title.trim() || loading)}>
            {loading ? "Saving…" : mode === "create" ? "Create" : "Save"}
          </button>
        </div>
      </form>
    </Overlay>
  );
}

function ColumnFormModal({
  initialValues, onSubmit, onCancel,
}: {
  initialValues?: { title: string; wipLimit: string };
  onSubmit: (title: string, wipLimit: number | undefined) => void;
  onCancel: () => void;
}) {
  const [title,    setTitle]    = useState(initialValues?.title ?? "");
  const [wipLimit, setWipLimit] = useState(initialValues?.wipLimit ?? "");

  return (
    <Overlay onClose={onCancel}>
      <h2 style={{ margin: "0 0 1rem", fontSize: "1.05rem", fontWeight: 700, color: "#111827" }}>
        Edit Column
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          const parsed = parseInt(wipLimit, 10);
          onSubmit(title.trim(), Number.isNaN(parsed) || parsed <= 0 ? undefined : parsed);
        }}
      >
        <Field label="Title *">
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus style={inputStyle} />
        </Field>
        <Field label="WIP Limit (blank = no limit)">
          <input type="text" value={wipLimit} onChange={(e) => setWipLimit(e.target.value)} placeholder="e.g. 3" style={inputStyle} />
        </Field>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.75rem" }}>
          <button type="button" onClick={onCancel} style={cancelBtnStyle}>Cancel</button>
          <button type="submit" disabled={!title.trim()} style={primaryBtnStyle(!title.trim())}>Save</button>
        </div>
      </form>
    </Overlay>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 100,
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "#fff",
          borderRadius: "14px",
          padding: "1.75rem",
          width: "100%",
          maxWidth: "440px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.2)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", marginBottom: "0.75rem" }}>
      <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#374151", display: "block", marginBottom: "0.3rem", letterSpacing: "0.01em" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.45rem 0.65rem",
  border: "1px solid #d1d5db",
  borderRadius: "7px",
  fontSize: "0.875rem",
  boxSizing: "border-box",
  backgroundColor: "#fafafa",
  outline: "none",
  color: "#111827",
};

const cancelBtnStyle: React.CSSProperties = {
  padding: "0.45rem 1rem",
  backgroundColor: "#f3f4f6",
  border: "1px solid #d1d5db",
  borderRadius: "7px",
  cursor: "pointer",
  fontSize: "0.875rem",
  color: "#374151",
  fontWeight: 500,
};

const primaryBtnStyle = (disabled: boolean): React.CSSProperties => ({
  padding: "0.45rem 1.25rem",
  background: disabled ? undefined : "linear-gradient(135deg, #4f46e5, #7c3aed)",
  backgroundColor: disabled ? "#a5b4fc" : undefined,
  border: "none",
  borderRadius: "7px",
  cursor: disabled ? "not-allowed" : "pointer",
  fontSize: "0.875rem",
  color: "#fff",
  fontWeight: 600,
  boxShadow: disabled ? "none" : "0 2px 6px rgba(79,70,229,0.3)",
});
