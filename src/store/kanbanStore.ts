import { create } from "zustand";
import {
  createEmptyBoardSnapshot,
  kanbanApi as mockApi,
  resetKanbanApiMock,
  type BoardSnapshot,
  type CreateCardRequest,
  type UpdateCardRequest,
  type CreateColumnRequest,
  type UpdateColumnRequest,
} from "../services/api";
import { supabaseKanbanApi } from "../services/supabaseApi";
import type { ArchivedCardEntry, Card, Column, FilterState, SwimlaneGroupBy } from "../types";

const USE_SUPABASE = !!import.meta.env.VITE_SUPABASE_URL;
const kanbanApi = USE_SUPABASE ? supabaseKanbanApi : mockApi;

export type CreateCardInput = CreateCardRequest;

export interface KanbanState {
  columns: Column[];
  cards: Card[];
  archivedEntries: ArchivedCardEntry[];
  swimlaneGroupBy: SwimlaneGroupBy | null;
  filter: FilterState;
  loading: boolean;
  error: string | null;
}

interface KanbanActions {
  initialize: () => Promise<void>;
  addCard: (input: CreateCardInput) => Promise<void>;
  editCard: (cardId: string, payload: UpdateCardRequest) => Promise<void>;
  moveCard: (cardId: string, targetColumnId: string) => Promise<void>;
  deleteCard: (cardId: string) => Promise<void>;
  archiveCard: (cardId: string) => Promise<void>;
  restoreArchivedCard: (cardId: string, targetColumnId?: string) => Promise<void>;
  setFilter: (payload: Partial<FilterState>) => Promise<void>;
  setSwimlaneGroupBy: (groupBy: SwimlaneGroupBy | null) => Promise<void>;
  addColumn: (input: CreateColumnRequest) => Promise<void>;
  editColumn: (columnId: string, payload: UpdateColumnRequest) => Promise<void>;
  removeColumn: (columnId: string, fallbackColumnId?: string) => Promise<void>;
  resetState: () => void;
}

export type KanbanStore = KanbanState & KanbanActions;

function toStoreState(snapshot: BoardSnapshot): Omit<KanbanState, "loading" | "error"> {
  return {
    columns: snapshot.columns,
    cards: snapshot.cards,
    archivedEntries: snapshot.archivedEntries,
    swimlaneGroupBy: snapshot.swimlaneGroupBy,
    filter: snapshot.filter,
  };
}

function buildInitialState(): KanbanState {
  const snapshot = USE_SUPABASE
    ? { columns: [], cards: [], archivedEntries: [], swimlaneGroupBy: null, filter: { category: null, swimlaneValue: null, searchQuery: "" } }
    : createEmptyBoardSnapshot();
  return {
    ...toStoreState(snapshot),
    loading: USE_SUPABASE,
    error: null,
  };
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export const useKanbanStore = create<KanbanStore>((set) => {
  const syncBoard = async () => {
    const snapshot = await kanbanApi.getBoardSnapshot();
    set({
      ...toStoreState(snapshot),
      error: null,
    });
  };

  const runMutation = async (
    mutation: () => Promise<boolean>,
    failureMessage: string
  ) => {
    set({ loading: true, error: null });

    try {
      const success = await mutation();

      if (!success) {
        set({
          loading: false,
          error: failureMessage,
        });
        return;
      }

      await syncBoard();
      set({ loading: false });
    } catch (error) {
      set({
        loading: false,
        error: getErrorMessage(error, failureMessage),
      });
    }
  };

  return {
    ...buildInitialState(),
    initialize: async () => {
      set({ loading: true, error: null });
      try {
        await syncBoard();
        set({ loading: false });
      } catch (error) {
        set({ loading: false, error: getErrorMessage(error, "Failed to load board.") });
      }
    },
    addCard: async (input) => {
      const title = input.title.trim();

      if (!title) {
        set({ error: "Card title cannot be empty." });
        return;
      }

      await runMutation(async () => {
        await kanbanApi.createCard({
          ...input,
          title,
        });

        return true;
      }, "Failed to create card.");
    },
    moveCard: async (cardId, targetColumnId) => {
      await runMutation(async () => {
        const updatedCard = await kanbanApi.moveCard(cardId, targetColumnId);

        return updatedCard !== null;
      }, "Failed to move card.");
    },
    deleteCard: async (cardId) => {
      await runMutation(async () => kanbanApi.deleteCard(cardId), "Failed to delete card.");
    },
    archiveCard: async (cardId) => {
      await runMutation(async () => {
        const archivedEntry = await kanbanApi.archiveCard(cardId);

        return archivedEntry !== null;
      }, "Failed to archive card.");
    },
    restoreArchivedCard: async (cardId, targetColumnId) => {
      await runMutation(async () => {
        const restoredCard = await kanbanApi.restoreCard(cardId, targetColumnId);

        return restoredCard !== null;
      }, "Failed to restore archived card.");
    },
    editCard: async (cardId, payload) => {
      await runMutation(async () => {
        const result = await kanbanApi.updateCard(cardId, payload);
        return result !== null;
      }, "Failed to update card.");
    },
    setFilter: async (payload) => {
      await runMutation(async () => {
        await kanbanApi.updateFilter(payload);
        return true;
      }, "Failed to update filter.");
    },
    setSwimlaneGroupBy: async (groupBy) => {
      await runMutation(async () => {
        await kanbanApi.updateSwimlaneGroupBy(groupBy);
        return true;
      }, "Failed to update swimlane grouping.");
    },
    addColumn: async (input) => {
      const title = input.title.trim();
      if (!title) {
        set({ error: "Column title cannot be empty." });
        return;
      }
      await runMutation(async () => {
        await kanbanApi.createColumn({ ...input, title });
        return true;
      }, "Failed to create column.");
    },
    editColumn: async (columnId, payload) => {
      await runMutation(async () => {
        const result = await kanbanApi.updateColumn(columnId, payload);
        return result !== null;
      }, "Failed to update column.");
    },
    removeColumn: async (columnId, fallbackColumnId) => {
      await runMutation(async () => {
        return kanbanApi.deleteColumn(columnId, fallbackColumnId);
      }, "Failed to delete column.");
    },
    resetState: () => {
      if (!USE_SUPABASE) {
        resetKanbanApiMock();
      }
      set(buildInitialState());
    },
  };
});
