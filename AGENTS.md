# Agent Instructions

## 1) App Overview

- Theme: personal Kanban board for task flow tracking.
- Purpose: create tasks, move them across columns, archive completed work, and view board stats.
- Core entities:
  - `Card`: title, description, category, assignee, priority, current column, timestamps, move history.
  - `Column`: ordered workflow stage with optional WIP limit.
  - `ArchivedCardEntry`: archived card + archived timestamp.
  - `FilterState`: category/swimlane/search filters.

## 2) State Management Approach

- Library: Zustand.
- Why: low boilerplate, hook-friendly, and simple shared state across route pages.
- Store file: `src/store/kanbanStore.ts`.
- Store entry point: `useKanbanStore`.
- Async readiness:
  - `loading: boolean`
  - `error: string | null`

## 3) State Shape

Copy the current store types when extending behavior:

```ts
export interface CreateCardInput {
  title: string;
  description?: string;
  category?: CardCategory;
  columnId?: string;
  assignee?: string;
  priority?: CardPriority;
}

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
```

## 4) API Conventions

- API layer file: `src/services/api.ts`.
- Chosen approach: plain `fetch` (placeholder phase currently uses in-memory async implementation).
- Service contract: `KanbanApiService`.
- Exported service: `kanbanApi`.
- API methods return `Promise<...>` and use typed request/response interfaces.
- Keep API concerns in `src/services/api.ts`; keep UI components free of backend details.
- If an operation can fail, return `null` or `false` from API and set store `error` in the caller.

## 5) File Structure

- `src/types.ts`: shared domain types (`Card`, `Column`, etc.).
- `src/store/`: Zustand store, store tests, selectors/helpers (if added later).
- `src/services/`: API contracts and implementations.
- `src/pages/`: route-level UI (`Board`, `Archive`, `Stats`).
- `src/components/`: reusable UI and layout.

Naming patterns:

- Types/interfaces: PascalCase (`KanbanApiService`, `CreateCardRequest`).
- Store/actions/functions: camelCase (`useKanbanStore`, `addCard`, `moveCard`).
- Files: descriptive camelCase/feature-based (`kanbanStore.ts`, `api.ts`).

## 6) Adding New Features

Use this sequence for any new operation:

1. Update or add domain/request types in `src/types.ts` and/or `src/services/api.ts`.
2. Add API contract method to `KanbanApiService`.
3. Add placeholder implementation in `kanbanApi` in `src/services/api.ts`.
4. Add/extend store action in `src/store/kanbanStore.ts`.
5. Wire the action into UI pages/components.
6. Add tests in `src/store/kanbanStore.test.ts` (and UI tests if needed).
7. Validate with:
   - `npm run test -- --run`
   - `npm exec -- tsc --noEmit`

Implementation guardrails:

- Keep store state normalized; compute derived values in selectors/helpers.
- Do not mutate returned API objects directly; clone when needed.
- Keep route logic in pages and state logic in store/services.
