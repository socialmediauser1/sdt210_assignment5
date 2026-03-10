import { create } from "zustand";
import {
  createEmptyBoardSnapshot,
  kanbanApi,
  resetKanbanApiMock,
  type BoardSnapshot,
  type CreateCardRequest,
} from "../services/api";
import type { ArchivedCardEntry, Card, Column, FilterState, SwimlaneGroupBy } from "../types";

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
  addCard: (input: CreateCardInput) => Promise<void>;
  moveCard: (cardId: string, targetColumnId: string) => Promise<void>;
  deleteCard: (cardId: string) => Promise<void>;
  archiveCard: (cardId: string) => Promise<void>;
  restoreArchivedCard: (cardId: string, targetColumnId?: string) => Promise<void>;
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
  return {
    ...toStoreState(createEmptyBoardSnapshot()),
    loading: false,
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
    resetState: () => {
      resetKanbanApiMock();
      set(buildInitialState());
    },
  };
});
