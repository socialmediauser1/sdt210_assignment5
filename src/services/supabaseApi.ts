/**
 * Supabase implementation of KanbanApiService (board-scoped).
 * See boardsApi.ts for the SQL schema and RLS policies to run first.
 *
 * Original single-board SQL (still required):
 *
 * create table public.columns (
 *   id uuid primary key default gen_random_uuid(),
 *   user_id uuid references auth.users(id) on delete cascade not null,
 *   title text not null,
 *   "order" integer not null default 0,
 *   wip_limit integer,
 *   board_id uuid references public.boards(id) on delete cascade
 * );
 *
 * create table public.cards (
 *   id uuid primary key default gen_random_uuid(),
 *   user_id uuid references auth.users(id) on delete cascade not null,
 *   column_id uuid references public.columns(id) on delete cascade not null,
 *   title text not null,
 *   description text not null default '',
 *   category text not null default 'feature',
 *   assignee text,
 *   priority text,
 *   created_at timestamptz not null default now(),
 *   column_entered_at timestamptz not null default now(),
 *   moves jsonb not null default '[]'::jsonb
 * );
 *
 * create table public.archived_cards (
 *   id uuid primary key,
 *   user_id uuid references auth.users(id) on delete cascade not null,
 *   card jsonb not null,
 *   archived_at timestamptz not null default now(),
 *   board_id uuid references public.boards(id) on delete cascade
 * );
 */

import { supabase } from "../lib/supabase";
import type {
  ArchivedCardEntry,
  Card,
  CardCategory,
  CardMove,
  CardPriority,
  Column,
  FilterState,
  SwimlaneGroupBy,
} from "../types";
import type {
  BoardSnapshot,
  CreateCardRequest,
  CreateColumnRequest,
  KanbanApiService,
  UpdateCardRequest,
  UpdateColumnRequest,
} from "./api";

let currentBoardId: string | null = null;

export function setActiveBoardId(boardId: string): void {
  currentBoardId = boardId;
  localState.filter = { category: null, swimlaneValue: null, searchQuery: "" };
  localState.swimlaneGroupBy = null;
}

function requireBoardId(): string {
  if (!currentBoardId) throw new Error("No active board selected.");
  return currentBoardId;
}

const localState = {
  filter: { category: null, swimlaneValue: null, searchQuery: "" } as FilterState,
  swimlaneGroupBy: null as SwimlaneGroupBy | null,
};

const DEFAULT_COLUMNS = [
  { title: "To Do", order: 0, wip_limit: 4 },
  { title: "In Progress", order: 1, wip_limit: 2 },
  { title: "Done", order: 2, wip_limit: null },
];

async function getCurrentUserId(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Not authenticated");
  return session.user.id;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToColumn(row: any): Column {
  return {
    id: row.id as string,
    title: row.title as string,
    order: row.order as number,
    ...(row.wip_limit != null ? { wipLimit: row.wip_limit as number } : {}),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToCard(row: any): Card {
  return {
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string) ?? "",
    category: row.category as CardCategory,
    columnId: row.column_id as string,
    assignee: row.assignee != null ? (row.assignee as string) : undefined,
    priority: row.priority != null ? (row.priority as CardPriority) : undefined,
    createdAt: row.created_at as string,
    columnEnteredAt: row.column_entered_at as string,
    moves: (row.moves as CardMove[]) ?? [],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToArchivedEntry(row: any): ArchivedCardEntry {
  return {
    card: row.card as Card,
    archivedAt: row.archived_at as string,
  };
}

function cardToInsertRow(card: Card, userId: string): Record<string, unknown> {
  return {
    id: card.id,
    user_id: userId,
    column_id: card.columnId,
    title: card.title,
    description: card.description,
    category: card.category,
    assignee: card.assignee ?? null,
    priority: card.priority ?? null,
    created_at: card.createdAt,
    column_entered_at: card.columnEnteredAt,
    moves: card.moves,
  };
}

export const supabaseKanbanApi: KanbanApiService = {
  async getBoardSnapshot(): Promise<BoardSnapshot> {
    const userId = await getCurrentUserId();
    const boardId = requireBoardId();

    const { data: columnRows, error: colErr } = await supabase
      .from("columns")
      .select("*")
      .eq("board_id", boardId)
      .order("order", { ascending: true });

    if (colErr) throw colErr;

    let columns: Column[];
    const existing = columnRows ?? [];

    const existingTitles = new Set(existing.map((r) => r.title as string));
    const missingDefs = DEFAULT_COLUMNS.filter((d) => !existingTitles.has(d.title));

    if (missingDefs.length > 0) {
      const toInsert = missingDefs.map((d, i) => ({
        user_id: userId,
        board_id: boardId,
        title: d.title,
        order: 100 + i,
        ...(d.wip_limit !== null ? { wip_limit: d.wip_limit } : {}),
      }));
      const { data: inserted, error: insertErr } = await supabase
        .from("columns")
        .insert(toInsert)
        .select();
      if (insertErr) throw insertErr;

      const orderPriority: Record<string, number> = { "To Do": 0, "In Progress": 1, "Done": 2 };
      const allCols = [
        ...existing.map(rowToColumn),
        ...(inserted ?? []).map(rowToColumn),
      ].sort((a, b) => {
        const ao = orderPriority[a.title] ?? 3 + a.order;
        const bo = orderPriority[b.title] ?? 3 + b.order;
        return ao - bo;
      });

      for (let i = 0; i < allCols.length; i++) {
        if (allCols[i].order !== i) {
          await supabase.from("columns").update({ order: i }).eq("id", allCols[i].id);
          allCols[i] = { ...allCols[i], order: i };
        }
      }
      columns = allCols;
    } else {
      columns = existing.map(rowToColumn);
    }

    const columnIds = columns.map((c) => c.id);
    const { data: cardRows, error: cardErr } =
      columnIds.length > 0
        ? await supabase.from("cards").select("*").in("column_id", columnIds)
        : { data: [], error: null };
    if (cardErr) throw cardErr;

    const { data: archivedRows, error: archErr } = await supabase
      .from("archived_cards")
      .select("*")
      .eq("board_id", boardId)
      .order("archived_at", { ascending: false });
    if (archErr) throw archErr;

    return {
      columns,
      cards: (cardRows ?? []).map(rowToCard),
      archivedEntries: (archivedRows ?? []).map(rowToArchivedEntry),
      swimlaneGroupBy: localState.swimlaneGroupBy,
      filter: { ...localState.filter },
    };
  },

  async createCard(payload: CreateCardRequest): Promise<Card> {
    const userId = await getCurrentUserId();
    const boardId = requireBoardId();

    const { data: columnRows } = await supabase
      .from("columns")
      .select("id")
      .eq("board_id", boardId)
      .order("order", { ascending: true })
      .limit(1);
    const defaultColumnId = columnRows?.[0]?.id as string | undefined;
    const resolvedColumnId = payload.columnId ?? defaultColumnId ?? "";
    const now = new Date().toISOString();

    const row = {
      user_id: userId,
      column_id: resolvedColumnId,
      title: payload.title.trim(),
      description: payload.description ?? "",
      category: payload.category ?? "feature",
      assignee: payload.assignee?.trim() ?? null,
      priority: payload.priority ?? "medium",
      created_at: now,
      column_entered_at: now,
      moves: [],
    };

    const { data, error } = await supabase.from("cards").insert(row).select().single();
    if (error) throw error;
    return rowToCard(data);
  },

  async updateCard(cardId: string, payload: UpdateCardRequest): Promise<Card | null> {
    const updates: Record<string, unknown> = {};
    if (payload.title !== undefined && payload.title.trim()) {
      updates.title = payload.title.trim();
    }
    if (payload.description !== undefined) updates.description = payload.description;
    if (payload.category !== undefined) updates.category = payload.category;
    if (payload.assignee !== undefined) updates.assignee = payload.assignee.trim() || null;
    if (payload.priority !== undefined) updates.priority = payload.priority;

    const { data, error } = await supabase
      .from("cards")
      .update(updates)
      .eq("id", cardId)
      .select()
      .single();

    if (error) return null;
    return rowToCard(data);
  },

  async moveCard(cardId: string, targetColumnId: string): Promise<Card | null> {
    const { data: existing, error: fetchErr } = await supabase
      .from("cards")
      .select("*")
      .eq("id", cardId)
      .single();

    if (fetchErr || !existing) return null;
    if (existing.column_id === targetColumnId) return rowToCard(existing);

    const movedAt = new Date().toISOString();
    const newMoves: CardMove[] = [
      ...((existing.moves as CardMove[]) ?? []),
      { at: movedAt, fromColumnId: existing.column_id as string, toColumnId: targetColumnId },
    ];

    const { data, error } = await supabase
      .from("cards")
      .update({ column_id: targetColumnId, column_entered_at: movedAt, moves: newMoves })
      .eq("id", cardId)
      .select()
      .single();

    if (error) return null;
    return rowToCard(data);
  },

  async deleteCard(cardId: string): Promise<boolean> {
    const { error } = await supabase.from("cards").delete().eq("id", cardId);
    return !error;
  },

  async archiveCard(cardId: string): Promise<ArchivedCardEntry | null> {
    const userId = await getCurrentUserId();
    const boardId = requireBoardId();

    const { data: cardRow, error: fetchErr } = await supabase
      .from("cards")
      .select("*")
      .eq("id", cardId)
      .single();

    if (fetchErr || !cardRow) return null;

    const card = rowToCard(cardRow);
    const archivedAt = new Date().toISOString();

    const { error: delErr } = await supabase.from("cards").delete().eq("id", cardId);
    if (delErr) return null;

    const { error: insErr } = await supabase
      .from("archived_cards")
      .insert({ id: cardId, user_id: userId, board_id: boardId, card, archived_at: archivedAt });

    if (insErr) return null;
    return { card, archivedAt };
  },

  async restoreCard(cardId: string, targetColumnId?: string): Promise<Card | null> {
    const userId = await getCurrentUserId();

    const { data: archivedRow, error: fetchErr } = await supabase
      .from("archived_cards")
      .select("*")
      .eq("id", cardId)
      .single();

    if (fetchErr || !archivedRow) return null;

    const archivedCard = archivedRow.card as Card;
    const resolvedColumnId = targetColumnId ?? archivedCard.columnId;
    const restoredAt = new Date().toISOString();

    const card: Card =
      archivedCard.columnId === resolvedColumnId
        ? { ...archivedCard, columnEnteredAt: restoredAt }
        : {
            ...archivedCard,
            columnId: resolvedColumnId,
            columnEnteredAt: restoredAt,
            moves: [
              ...archivedCard.moves,
              {
                at: restoredAt,
                fromColumnId: archivedCard.columnId,
                toColumnId: resolvedColumnId,
              },
            ],
          };

    const { error: delErr } = await supabase
      .from("archived_cards")
      .delete()
      .eq("id", cardId);
    if (delErr) return null;

    const { error: insErr } = await supabase
      .from("cards")
      .insert(cardToInsertRow(card, userId));
    if (insErr) return null;

    return card;
  },

  async createColumn(payload: CreateColumnRequest): Promise<Column> {
    const userId = await getCurrentUserId();
    const boardId = requireBoardId();

    const { data: existing } = await supabase
      .from("columns")
      .select("order")
      .eq("board_id", boardId)
      .order("order", { ascending: false })
      .limit(1);

    const nextOrder = existing && existing.length > 0 ? (existing[0].order as number) + 1 : 0;

    const row: Record<string, unknown> = {
      user_id: userId,
      board_id: boardId,
      title: payload.title.trim(),
      order: nextOrder,
    };
    if (payload.wipLimit !== undefined) row.wip_limit = payload.wipLimit;

    const { data, error } = await supabase.from("columns").insert(row).select().single();
    if (error) throw error;
    return rowToColumn(data);
  },

  async updateColumn(columnId: string, payload: UpdateColumnRequest): Promise<Column | null> {
    const boardId = requireBoardId();
    const updates: Record<string, unknown> = {};
    if (payload.title?.trim()) updates.title = payload.title.trim();
    if ("wipLimit" in payload) updates.wip_limit = payload.wipLimit ?? null;

    if (payload.order !== undefined) {
      const { data: allCols } = await supabase
        .from("columns")
        .select("id, order")
        .eq("board_id", boardId)
        .order("order", { ascending: true });

      if (allCols) {
        const without = allCols.filter((c) => c.id !== columnId);
        const bounded = Math.max(0, Math.min(payload.order, without.length));
        without.splice(bounded, 0, { id: columnId, order: bounded });
        for (let i = 0; i < without.length; i++) {
          await supabase.from("columns").update({ order: i }).eq("id", without[i].id);
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      const { data, error } = await supabase
        .from("columns")
        .update(updates)
        .eq("id", columnId)
        .select()
        .single();
      if (error) return null;
      return rowToColumn(data);
    }

    const { data, error } = await supabase
      .from("columns")
      .select("*")
      .eq("id", columnId)
      .single();
    if (error) return null;
    return rowToColumn(data);
  },

  async deleteColumn(columnId: string, fallbackColumnId?: string): Promise<boolean> {
    const boardId = requireBoardId();
    const { data: allCols } = await supabase
      .from("columns")
      .select("*")
      .eq("board_id", boardId);
    if (!allCols || allCols.length <= 3) return false;

    const remaining = allCols.filter((c) => c.id !== columnId);
    if (remaining.length === allCols.length) return false;

    const resolvedFallback =
      (fallbackColumnId && remaining.some((c) => c.id === fallbackColumnId)
        ? fallbackColumnId
        : null) ?? (remaining[0]?.id as string | undefined);

    if (!resolvedFallback) return false;

    const movedAt = new Date().toISOString();
    const { data: cardsToMove } = await supabase
      .from("cards")
      .select("id, moves")
      .eq("column_id", columnId);

    for (const cardRow of cardsToMove ?? []) {
      const newMoves: CardMove[] = [
        ...((cardRow.moves as CardMove[]) ?? []),
        { at: movedAt, fromColumnId: columnId, toColumnId: resolvedFallback },
      ];
      await supabase
        .from("cards")
        .update({ column_id: resolvedFallback, column_entered_at: movedAt, moves: newMoves })
        .eq("id", cardRow.id);
    }

    const { error } = await supabase.from("columns").delete().eq("id", columnId);
    if (error) return false;

    const sorted = remaining.sort((a, b) => (a.order as number) - (b.order as number));
    for (let i = 0; i < sorted.length; i++) {
      if ((sorted[i].order as number) !== i) {
        await supabase.from("columns").update({ order: i }).eq("id", sorted[i].id);
      }
    }

    return true;
  },

  async updateFilter(payload: Partial<FilterState>): Promise<FilterState> {
    localState.filter = { ...localState.filter, ...payload };
    return { ...localState.filter };
  },

  async updateSwimlaneGroupBy(groupBy: SwimlaneGroupBy | null): Promise<SwimlaneGroupBy | null> {
    localState.swimlaneGroupBy = groupBy;
    return localState.swimlaneGroupBy;
  },
};
