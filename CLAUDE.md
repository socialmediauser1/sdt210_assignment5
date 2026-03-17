# CLAUDE.md — AI Agent Instructions

## Project Overview

Personal Kanban Board application built with React 18 + TypeScript + Vite.
Supports both a local in-memory demo mode and a full Supabase cloud backend.

---

## Architecture

```
src/
  services/
    supabase-config.ts  ← Supabase URL + anon key (backend config)
    api.ts              ← KanbanApiService interface + mock impl (ALL kanban backend calls)
    boardsApi.ts        ← Boards + members Supabase API (team boards, join codes)
    auth.ts             ← Auth service: signIn, signUp, signOut, onAuthStateChange
  lib/
    supabase.ts         ← createClient (reads from supabase-config.ts)
  store/
    authStore.ts        ← Zustand: user, initialized, signIn/Out/Up — uses auth.ts
    boardsStore.ts      ← Zustand: boards list, active board, board members
    kanbanStore.ts      ← Zustand: columns, cards, archive, filter, swimlane
  pages/
    Board.tsx           ← Main kanban board UI (drag-drop, modals, filter bar)
    Archive.tsx         ← Archived cards with restore
    Stats.tsx           ← Column load + board summary metrics
    Settings.tsx        ← Account info + board preferences
    About.tsx           ← App description + tech stack
    Login.tsx           ← Email/password sign-in + sign-up form
  components/
    Layout.tsx          ← Sticky nav, board switcher dropdown, auth controls
  types.ts              ← Shared TypeScript types (Card, Column, Board, etc.)
  App.tsx               ← Router + auth guard + initialization order
  main.tsx              ← React root mount + index.css import
  index.css             ← Global CSS reset, Inter font, custom scrollbar, card hover classes
```

---

## Key Conventions

### Service Layer Rule
Components and stores **must not** import `supabase` directly.
- Kanban data → `src/services/api.ts` (`kanbanApi`)
- Board management → `src/services/boardsApi.ts` (`supabaseBoardsApi`)
- Authentication → `src/services/auth.ts` (`authService`)

### Store Pattern
Every Zustand store exposes:
- `loading: boolean` — set `true` at the start of async operations, `false` on completion
- `error: string | null` — set on failure, cleared on new operations

Mutations follow the `runMutation` helper pattern in `kanbanStore.ts`:
```ts
await runMutation(async () => { ...; return true; }, "Error message.");
```

### Dual-Mode Operation
`const USE_SUPABASE = !!import.meta.env.VITE_SUPABASE_URL;`

- `false` → PlainApp (no auth, mock in-memory API from `api.ts`)
- `true`  → AuthenticatedApp (Supabase auth, real database)

The mock API (`api.ts`) and Supabase API (`supabaseApi.ts`) both satisfy the same `KanbanApiService` interface. `kanbanStore.ts` picks the right one at module load time.

### Initialization Order (CRITICAL)
In `App.tsx`, boards MUST initialize before kanban:
```ts
await initializeBoards();  // sets activeBoardId via setActiveBoardId()
await initializeKanban();  // reads activeBoardId to scope queries
```

### Board Scoping
`src/services/supabaseApi.ts` uses a module-level `currentBoardId` variable.
`setActiveBoardId(id)` must be called before any kanban API operation.
`boardsStore.initialize()` and `boardsStore.setActiveBoard()` call this automatically.

### Team Boards
- Personal board: auto-created per user, one per account
- Team boards: owner creates, others join via 6-char join code
- SQL RPC `join_board_by_code` bypasses RLS for the lookup
- SQL RPC `get_board_members` returns all members (owner + joined) with emails

### CSS Hover Pattern
Card action buttons are always in the DOM (for test accessibility) but hidden via CSS:
```css
.card-actions { opacity: 0; pointer-events: none; }
.kanban-card:hover .card-actions { opacity: 1; pointer-events: auto; }
```
Never use React state to conditionally render action buttons — tests cannot simulate hover reliably in jsdom.

---

## Testing

- `npm run test -- --run` must pass all 5 tests
- Tests use `USE_SUPABASE = false` (`.env.test` has empty vars)
- Tests render `PlainApp` via `App.tsx` which bypasses auth and boardsStore
- `getColumnContainer(title)` relies on `<strong>` being a direct child of the column header `<div>` — do not add wrapper elements

---

## Supabase SQL Notes

All required SQL (tables, RLS, RPCs) is documented as comments at the top of:
- `src/services/boardsApi.ts` — boards, board_members, column/card RLS updates, RPCs
