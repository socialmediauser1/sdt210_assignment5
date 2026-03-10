import type {
  ArchivedCardEntry,
  Card,
  CardCategory,
  CardPriority,
  Column,
  FilterState,
  SwimlaneGroupBy,
} from "../types";

export const API_APPROACH = "fetch" as const;

export interface CreateCardRequest {
  title: string;
  description?: string;
  category?: CardCategory;
  columnId?: string;
  assignee?: string;
  priority?: CardPriority;
}

export interface UpdateCardRequest {
  title?: string;
  description?: string;
  category?: CardCategory;
  assignee?: string;
  priority?: CardPriority;
}

export interface CreateColumnRequest {
  title: string;
  wipLimit?: number;
}

export interface UpdateColumnRequest {
  title?: string;
  order?: number;
  wipLimit?: number;
}

export interface BoardSnapshot {
  columns: Column[];
  cards: Card[];
  archivedEntries: ArchivedCardEntry[];
  swimlaneGroupBy: SwimlaneGroupBy | null;
  filter: FilterState;
}

export interface KanbanApiService {
  getBoardSnapshot: () => Promise<BoardSnapshot>;
  createCard: (payload: CreateCardRequest) => Promise<Card>;
  updateCard: (cardId: string, payload: UpdateCardRequest) => Promise<Card | null>;
  moveCard: (cardId: string, targetColumnId: string) => Promise<Card | null>;
  deleteCard: (cardId: string) => Promise<boolean>;
  archiveCard: (cardId: string) => Promise<ArchivedCardEntry | null>;
  restoreCard: (cardId: string, targetColumnId?: string) => Promise<Card | null>;
  createColumn: (payload: CreateColumnRequest) => Promise<Column>;
  updateColumn: (columnId: string, payload: UpdateColumnRequest) => Promise<Column | null>;
  deleteColumn: (columnId: string, fallbackColumnId?: string) => Promise<boolean>;
  updateFilter: (payload: Partial<FilterState>) => Promise<FilterState>;
  updateSwimlaneGroupBy: (groupBy: SwimlaneGroupBy | null) => Promise<SwimlaneGroupBy | null>;
}

const DEFAULT_FILTER: FilterState = {
  category: null,
  swimlaneValue: null,
  searchQuery: "",
};

const DEFAULT_COLUMNS: Column[] = [
  { id: "column-todo", title: "To Do", order: 0, wipLimit: 4 },
  { id: "column-in-progress", title: "In Progress", order: 1, wipLimit: 2 },
  { id: "column-done", title: "Done", order: 2 },
];

export function createEmptyBoardSnapshot(): BoardSnapshot {
  return {
    columns: DEFAULT_COLUMNS.map((column) => ({ ...column })),
    cards: [],
    archivedEntries: [],
    swimlaneGroupBy: null,
    filter: { ...DEFAULT_FILTER },
  };
}

let mockDb: BoardSnapshot = createEmptyBoardSnapshot();

export function resetKanbanApiMock(): void {
  mockDb = createEmptyBoardSnapshot();
}

function cloneCard(card: Card): Card {
  return {
    ...card,
    moves: card.moves.map((move) => ({ ...move })),
  };
}

function cloneArchivedEntry(entry: ArchivedCardEntry): ArchivedCardEntry {
  return {
    card: cloneCard(entry.card),
    archivedAt: entry.archivedAt,
  };
}

function cloneSnapshot(snapshot: BoardSnapshot): BoardSnapshot {
  return {
    columns: snapshot.columns.map((column) => ({ ...column })),
    cards: snapshot.cards.map(cloneCard),
    archivedEntries: snapshot.archivedEntries.map(cloneArchivedEntry),
    swimlaneGroupBy: snapshot.swimlaneGroupBy,
    filter: { ...snapshot.filter },
  };
}

function normalizeColumns(columns: Column[]): Column[] {
  return [...columns]
    .sort((left, right) => left.order - right.order)
    .map((column, index) => ({
      ...column,
      order: index,
    }));
}

export const kanbanApi: KanbanApiService = {
  async getBoardSnapshot() {
    return cloneSnapshot(mockDb);
  },

  async createCard(payload) {
    const createdAt = new Date().toISOString();
    const resolvedColumnId = payload.columnId ?? mockDb.columns[0]?.id ?? "column-todo";
    const card: Card = {
      id: crypto.randomUUID(),
      title: payload.title.trim(),
      description: payload.description ?? "",
      category: payload.category ?? "feature",
      columnId: resolvedColumnId,
      assignee: payload.assignee?.trim() || undefined,
      priority: payload.priority ?? "medium",
      createdAt,
      columnEnteredAt: createdAt,
      moves: [],
    };

    mockDb.cards.push(card);

    return cloneCard(card);
  },

  async updateCard(cardId, payload) {
    const card = mockDb.cards.find((entry) => entry.id === cardId);

    if (!card) {
      return null;
    }

    if (payload.title !== undefined) {
      const title = payload.title.trim();

      if (title) {
        card.title = title;
      }
    }

    if (payload.description !== undefined) {
      card.description = payload.description;
    }

    if (payload.category !== undefined) {
      card.category = payload.category;
    }

    if (payload.assignee !== undefined) {
      card.assignee = payload.assignee.trim() || undefined;
    }

    if (payload.priority !== undefined) {
      card.priority = payload.priority;
    }

    return cloneCard(card);
  },

  async moveCard(cardId, targetColumnId) {
    const targetExists = mockDb.columns.some((column) => column.id === targetColumnId);

    if (!targetExists) {
      return null;
    }

    const card = mockDb.cards.find((entry) => entry.id === cardId);

    if (!card || card.columnId === targetColumnId) {
      return card ? cloneCard(card) : null;
    }

    const movedAt = new Date().toISOString();

    card.moves.push({
      at: movedAt,
      fromColumnId: card.columnId,
      toColumnId: targetColumnId,
    });
    card.columnId = targetColumnId;
    card.columnEnteredAt = movedAt;

    return cloneCard(card);
  },

  async deleteCard(cardId) {
    const previousLength = mockDb.cards.length;
    mockDb.cards = mockDb.cards.filter((card) => card.id !== cardId);

    return mockDb.cards.length < previousLength;
  },

  async archiveCard(cardId) {
    const card = mockDb.cards.find((entry) => entry.id === cardId);

    if (!card) {
      return null;
    }

    mockDb.cards = mockDb.cards.filter((entry) => entry.id !== cardId);

    const archivedEntry: ArchivedCardEntry = {
      card: cloneCard(card),
      archivedAt: new Date().toISOString(),
    };

    mockDb.archivedEntries.push(archivedEntry);

    return cloneArchivedEntry(archivedEntry);
  },

  async restoreCard(cardId, targetColumnId) {
    const archivedEntry = mockDb.archivedEntries.find((entry) => entry.card.id === cardId);

    if (!archivedEntry) {
      return null;
    }

    const resolvedTargetColumnId = targetColumnId ?? mockDb.columns[0]?.id;
    const targetExists = resolvedTargetColumnId
      ? mockDb.columns.some((column) => column.id === resolvedTargetColumnId)
      : false;

    if (!resolvedTargetColumnId || !targetExists) {
      return null;
    }

    const restoredAt = new Date().toISOString();
    const card: Card =
      archivedEntry.card.columnId === resolvedTargetColumnId
        ? {
            ...archivedEntry.card,
            columnEnteredAt: restoredAt,
          }
        : {
            ...archivedEntry.card,
            columnId: resolvedTargetColumnId,
            columnEnteredAt: restoredAt,
            moves: [
              ...archivedEntry.card.moves,
              {
                at: restoredAt,
                fromColumnId: archivedEntry.card.columnId,
                toColumnId: resolvedTargetColumnId,
              },
            ],
          };

    mockDb.cards.push(card);
    mockDb.archivedEntries = mockDb.archivedEntries.filter((entry) => entry.card.id !== cardId);

    return cloneCard(card);
  },

  async createColumn(payload) {
    const column: Column = {
      id: crypto.randomUUID(),
      title: payload.title.trim(),
      order: mockDb.columns.length,
      ...(payload.wipLimit !== undefined ? { wipLimit: payload.wipLimit } : {}),
    };

    mockDb.columns = normalizeColumns([...mockDb.columns, column]);

    return { ...column };
  },

  async updateColumn(columnId, payload) {
    const index = mockDb.columns.findIndex((column) => column.id === columnId);

    if (index === -1) {
      return null;
    }

    const current = mockDb.columns[index];
    const next: Column = {
      ...current,
      ...(payload.title !== undefined && payload.title.trim()
        ? { title: payload.title.trim() }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, "wipLimit")
        ? { wipLimit: payload.wipLimit }
        : {}),
    };

    const updatedColumns = [...mockDb.columns];
    updatedColumns[index] = next;

    if (payload.order !== undefined) {
      const withoutTarget = updatedColumns.filter((column) => column.id !== columnId);
      const boundedOrder = Math.max(0, Math.min(payload.order, withoutTarget.length));
      withoutTarget.splice(boundedOrder, 0, next);
      mockDb.columns = normalizeColumns(withoutTarget);
    } else {
      mockDb.columns = normalizeColumns(updatedColumns);
    }

    return { ...next };
  },

  async deleteColumn(columnId, fallbackColumnId) {
    if (mockDb.columns.length <= 1) {
      return false;
    }

    const remainingColumns = normalizeColumns(
      mockDb.columns.filter((column) => column.id !== columnId)
    );

    if (remainingColumns.length === mockDb.columns.length) {
      return false;
    }

    const resolvedFallbackColumnId =
      (fallbackColumnId &&
        remainingColumns.find((column) => column.id === fallbackColumnId)?.id) ||
      remainingColumns[0]?.id;

    if (!resolvedFallbackColumnId) {
      return false;
    }

    const movedAt = new Date().toISOString();
    mockDb.columns = remainingColumns;
    mockDb.cards = mockDb.cards.map((card) => {
      if (card.columnId !== columnId) {
        return card;
      }

      return {
        ...card,
        columnId: resolvedFallbackColumnId,
        columnEnteredAt: movedAt,
        moves: [
          ...card.moves,
          {
            at: movedAt,
            fromColumnId: columnId,
            toColumnId: resolvedFallbackColumnId,
          },
        ],
      };
    });

    return true;
  },

  async updateFilter(payload) {
    mockDb.filter = {
      ...mockDb.filter,
      ...payload,
    };

    return { ...mockDb.filter };
  },

  async updateSwimlaneGroupBy(groupBy) {
    mockDb.swimlaneGroupBy = groupBy;

    return mockDb.swimlaneGroupBy;
  },
};
