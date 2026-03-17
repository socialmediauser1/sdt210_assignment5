import { create } from "zustand";
import { supabaseBoardsApi } from "../services/boardsApi";
import { setActiveBoardId } from "../services/supabaseApi";
import { useKanbanStore } from "./kanbanStore";
import type { Board } from "../types";

interface BoardsState {
  boards: Board[];
  activeBoardId: string | null;
  boardMembers: { userId: string; email: string }[];
  loading: boolean;
  error: string | null;
}

interface BoardsActions {
  initialize: () => Promise<void>;
  setActiveBoard: (boardId: string) => Promise<void>;
  loadBoardMembers: (boardId: string) => Promise<void>;
  createTeamBoard: (name: string) => Promise<void>;
  joinByCode: (code: string) => Promise<void>;
  leaveBoard: (boardId: string) => Promise<void>;
  deleteBoard: (boardId: string) => Promise<void>;
  resetState: () => void;
}

export type BoardsStore = BoardsState & BoardsActions;

export const useBoardsStore = create<BoardsStore>((set, get) => ({
  boards: [],
  activeBoardId: null,
  boardMembers: [],
  loading: false,
  error: null,

  initialize: async () => {
    set({ loading: true, error: null });
    try {
      const personalBoardId = await supabaseBoardsApi.ensurePersonalBoard();
      await supabaseBoardsApi.migrateOrphanedData(personalBoardId);
      const boards = await supabaseBoardsApi.getMyBoards();
      const savedId = localStorage.getItem("activeBoardId");
      const targetBoard =
        (savedId ? boards.find((b) => b.id === savedId) : null) ??
        boards.find((b) => b.type === "personal") ??
        boards[0];
      const targetId = targetBoard?.id ?? personalBoardId;
      setActiveBoardId(targetId);
      set({ boards, activeBoardId: targetId, loading: false, boardMembers: [] });
      if (targetBoard?.type === "team") {
        await get().loadBoardMembers(targetId);
      }
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load boards.",
      });
    }
  },

  setActiveBoard: async (boardId: string) => {
    localStorage.setItem("activeBoardId", boardId);
    setActiveBoardId(boardId);
    set({ activeBoardId: boardId, error: null, boardMembers: [] });
    await useKanbanStore.getState().initialize();
    const board = get().boards.find((b) => b.id === boardId);
    if (board?.type === "team") {
      void get().loadBoardMembers(boardId);
    }
  },

  loadBoardMembers: async (boardId: string) => {
    try {
      const members = await supabaseBoardsApi.getBoardMembers(boardId);
      set({ boardMembers: members });
    } catch {
    }
  },

  createTeamBoard: async (name: string) => {
    set({ loading: true, error: null });
    try {
      const board = await supabaseBoardsApi.createTeamBoard(name);
      const boards = await supabaseBoardsApi.getMyBoards();
      set({ boards, loading: false });
      await get().setActiveBoard(board.id);
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to create team board.",
      });
    }
  },

  joinByCode: async (code: string) => {
    set({ loading: true, error: null });
    try {
      const board = await supabaseBoardsApi.joinBoardByCode(code);
      const boards = await supabaseBoardsApi.getMyBoards();
      set({ boards, loading: false });
      await get().setActiveBoard(board.id);
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Invalid join code.",
      });
    }
  },

  leaveBoard: async (boardId: string) => {
    set({ loading: true, error: null });
    try {
      await supabaseBoardsApi.leaveBoard(boardId);
      const boards = await supabaseBoardsApi.getMyBoards();
      const { activeBoardId } = get();
      const personalBoard = boards.find((b) => b.type === "personal");
      const newActiveId =
        activeBoardId === boardId ? (personalBoard?.id ?? boards[0]?.id ?? null) : activeBoardId;
      set({ boards, activeBoardId: newActiveId, loading: false });
      if (newActiveId && newActiveId !== activeBoardId) {
        localStorage.setItem("activeBoardId", newActiveId);
        setActiveBoardId(newActiveId);
        await useKanbanStore.getState().initialize();
      }
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to leave board.",
      });
    }
  },

  deleteBoard: async (boardId: string) => {
    set({ loading: true, error: null });
    try {
      await supabaseBoardsApi.deleteBoard(boardId);
      const boards = await supabaseBoardsApi.getMyBoards();
      const { activeBoardId } = get();
      const personalBoard = boards.find((b) => b.type === "personal");
      const newActiveId =
        activeBoardId === boardId ? (personalBoard?.id ?? boards[0]?.id ?? null) : activeBoardId;
      set({ boards, activeBoardId: newActiveId, loading: false });
      if (newActiveId && newActiveId !== activeBoardId) {
        localStorage.setItem("activeBoardId", newActiveId);
        setActiveBoardId(newActiveId);
        await useKanbanStore.getState().initialize();
      }
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to delete board.",
      });
    }
  },

  resetState: () => {
    set({ boards: [], activeBoardId: null, boardMembers: [], loading: false, error: null });
    useKanbanStore.getState().resetState();
  },
}));
