# Personal Kanban Board

A React app for visual task organization with columns, WIP limits, and swimlanes.

## Description

Organize work on a Kanban board: create cards, move them through columns (for example, To Do -> In Progress -> Done), set WIP limits per column, and view stats and archive history.

## Justification

I chose this theme because I built a Kanban board before in my first Java(101) course. At the time, I was still inexperienced and underestimated the complexity of this project. Although it worked, I was not fully satisfied with how it came out. Choosing this theme again is a way to revisit the same idea with better tools and more knowledge. It is a personal challenge to build a cleaner, more structured version and prove to myself that I have improved.

## Features

- Create, edit, and delete cards
- Configurable columns with optional WIP limits
- Move cards between columns
- Category labels: bug, feature, docs
- Swimlane grouping by category, assignee, or priority
- Filter by label, swimlane, or search
- Card age and time in current column
- Column and board statistics
- Archive completed cards with history view
- WIP limit warnings and column highlighting

## Backend Choice

**Supabase** (PostgreSQL + Supabase Auth)

- Database: PostgreSQL tables (`boards`, `board_members`, `columns`, `cards`, `archived_cards`)
- Auth: Supabase Auth (email + password, JWT session)
- Row Level Security (RLS) policies enforce per-user and per-board access
- Custom SQL RPCs: `join_board_by_code`, `get_board_members`
- All backend calls go through `src/services/api.ts`, `src/services/boardsApi.ts`, and `src/services/auth.ts` — components never import Supabase directly

The app also runs in **demo mode** (no Supabase credentials) using an in-memory mock implementation in `src/services/api.ts`.

## Auth Approach

- Service: `src/services/auth.ts` wraps all Supabase Auth calls
- Store: `src/store/authStore.ts` exposes `signIn`, `signUp`, `signOut`, `initialize`
- Session persists across page reload via Supabase's built-in JWT storage
- Protected routes: unauthenticated users are redirected to `/login`
- Login page: `src/pages/Login.tsx` (email + password form with sign-in / sign-up toggle)
- Logout button: always visible in the nav when authenticated

## Feature Verification

| Feature | Implementation | Status |
|---|---|---|
| Create / edit / delete cards | `addCard`, `editCard`, `deleteCard` in kanbanStore | ✓ |
| Drag-and-drop card movement | HTML5 DnD → `moveCard` in kanbanStore | ✓ |
| WIP limits with warnings | `col.wipLimit` + red highlight when reached | ✓ |
| Category labels (Bug/Feature/Docs) | `card.category`, color-coded badges | ✓ |
| Priority levels (High/Med/Low) | `card.priority`, pill in card title row | ✓ |
| Swimlane grouping | `setSwimlaneGroupBy`, `groupCards()` helper | ✓ |
| Filter by category + search | `setFilter`, `filteredCards` derived value | ✓ |
| Card age + time in column | `createdAt`, `columnEnteredAt` fields | ✓ |
| Archive + restore | `archiveCard`, `restoreArchivedCard` | ✓ |
| Board statistics | Stats page: column load, throughput, summary | ✓ |
| Personal board (auto-created) | `ensurePersonalBoard` in boardsApi | ✓ |
| Team boards + join code | `createTeamBoard`, `joinByCode` in boardsStore | ✓ |
| Board owner delete / member leave | `deleteBoard`, `leaveBoard` in boardsStore | ✓ |
| Assignee dropdown (team boards) | `get_board_members` RPC → `boardMembers` state | ✓ |
| Auth sign in / sign up / sign out | `authService` + `authStore` | ✓ |
| Protected routes | `<Navigate to="/login">` when `!user` | ✓ |
| Session persistence | Supabase JWT in localStorage | ✓ |
| Loading + error states | `loading: boolean`, `error: string \| null` on all stores | ✓ |
| Settings page | `src/pages/Settings.tsx` | ✓ |
| About page | `src/pages/About.tsx` | ✓ |

## How to Run the App

Prerequisites: Node.js 18+ and npm.

### Demo mode (no backend required)

```bash
npm install
npm run dev
```

The app opens at `http://localhost:5173` with an in-memory mock backend.

### Full Supabase mode

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run the SQL blocks documented in `src/services/boardsApi.ts` (blocks 1–8) in the Supabase SQL editor
3. Copy your project URL and anon key to a `.env` file:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

4. Start the dev server:

```bash
npm install
npm run dev
```

### Run tests

```bash
npm run test -- --run
```

### Type-check

```bash
npm exec -- tsc --noEmit
```

### Build for production

```bash
npm run build
```

## Project Structure

```text
final project/
|-- index.html
|-- package.json
|-- tsconfig.json
|-- tsconfig.node.json
|-- vite.config.ts
|-- README.md
`-- src/
    |-- App.wiring.test.tsx
    |-- main.tsx
    |-- App.tsx
    |-- types.ts
    |-- components/
    |   `-- Layout.tsx
    |-- services/
    |   `-- api.ts
    |-- store/
    |   |-- kanbanStore.ts
    |   `-- kanbanStore.test.ts
    `-- pages/
        |-- Board.tsx
        |-- Archive.tsx
        `-- Stats.tsx
```

## Tech Stack

- React 18 + TypeScript
- Vite
- React Router

## Project 4 - Step 1: Analyze and Choose State Management Approach

### State Categories in This App

| Category | Values from current app | Typical Tool |
| --- | --- | --- |
| UI state | modal open/close, selected card, temporary toggles (not stored globally yet) | local `useState` |
| Form state | create/edit card inputs and validation (currently minimal UI forms) | local `useState` |
| Server cache | none yet (no backend API in current version) | TanStack Query (if API is added later) |
| URL state | current route (`/`, `/archive`, `/stats`) and future query params | React Router |
| Shared app state | `columns`, `cards`, `archivedEntries`, `swimlaneGroupBy`, `filter` | store library |
| Derived state | counts by column and throughput (computed from cards/archive) | selectors/computed values |

### Primary Shared-State Choice

**Chosen library: Zustand**

Rationale:

1. The architecture is already hook-oriented, so using a hook-friendly store is straightforward.
2. It keeps boilerplate low compared with reducer/action-heavy setups.
3. Shared state is used across multiple routes (`Board`, `Archive`, `Stats`), which fits a lightweight global store.
4. Derived values (column counts and throughput) stay computed from source state to avoid duplication.

## Project 4 - Step 2: Install and Configure State Management

### 1) Library installation

```bash
npm install zustand
```

### 2) Store setup

- Store file: `src/store/kanbanStore.ts`
- Store type: `KanbanState` (app-domain shape)

Included state fields:

- `columns`, `cards`, `archivedEntries`, `swimlaneGroupBy`, `filter`
- `loading: boolean`
- `error: string | null`

### 3) Working operations (proof of wiring)

Implemented operations:

1. `addCard`
2. `moveCard`
3. `deleteCard`
4. `archiveCard`
5. `restoreArchivedCard`

Supporting operations for async readiness:

- `resetState`

### 4) Verification

Proof tests were added in `src/store/kanbanStore.test.ts` to verify:

1. async-ready store fields (`loading`, `error`) initialize correctly
2. `addCard` + `deleteCard` behavior
3. `moveCard` behavior and move history recording

## Project 4 - Step 3: Define API Service Layer

### 1) Planned approach

- Approach selected: plain `fetch`
- Current implementation is a placeholder in-memory service so the app compiles now.
- Project 5 will replace placeholder logic with real HTTP requests.

### 2) API interface and operations

Service file: `src/services/api.ts`

Main interface: `KanbanApiService`

Defined backend operations:

1. `getBoardSnapshot`
2. `createCard`
3. `updateCard`
4. `moveCard`
5. `deleteCard`
6. `archiveCard`
7. `restoreCard`
8. `createColumn`
9. `updateColumn`
10. `deleteColumn`
11. `updateFilter`
12. `updateSwimlaneGroupBy`

### 3) Placeholder implementation

- Exported implementation: `kanbanApi`
- Uses a mock in-memory database and async methods with realistic return types.
- Returns cloned data to keep call-sites safe from accidental mutation.

## Project 4 - Step 5: Verify Wiring

Verification checklist completed:

1. `npm exec -- tsc --noEmit` passes with zero errors.
2. `npm run dev` starts successfully (verified startup at `http://127.0.0.1:4177/`).
3. Two proof-of-wiring UI operations are verified by integration tests in `src/App.wiring.test.tsx`:
   - add card + move card (`Add Card`, `Forward`)
   - add card + delete card (`Add Card`, `Delete`)

Test run result:

```bash
npm run test -- --run
# 2 test files passed, 5 tests passed
```

## AI Usage Statement

I used AI to generate hooks structure, to write tests and for fixing numerous errors that happened in the process(also for the styling).
