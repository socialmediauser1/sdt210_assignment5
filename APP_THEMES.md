# APP_THEMES.md — Feature Hooks & Computed Values

This document maps every app feature to its store action or computed value.

## Theme: Personal Kanban Board

A visual task management tool where users organize work across columns,
track progress, and collaborate on shared team boards.

---

## Feature → Hook / Store Mapping

| Feature | Store | Action / Selector | Computed Value |
|---|---|---|---|
| View all columns | `kanbanStore` | `s.columns` | `[...columns].sort((a,b) => a.order - b.order)` |
| View all cards | `kanbanStore` | `s.cards` | — |
| Create a card | `kanbanStore` | `addCard(input)` | — |
| Edit a card | `kanbanStore` | `editCard(id, payload)` | — |
| Move a card (drag-drop) | `kanbanStore` | `moveCard(cardId, columnId)` | — |
| Delete a card | `kanbanStore` | `deleteCard(id)` | — |
| Archive a card | `kanbanStore` | `archiveCard(id)` | — |
| Restore archived card | `kanbanStore` | `restoreArchivedCard(id, columnId)` | — |
| View archived cards | `kanbanStore` | `s.archivedEntries` | — |
| Edit a column (title, WIP) | `kanbanStore` | `editColumn(id, payload)` | — |
| Delete a column | `kanbanStore` | `removeColumn(id, fallback)` | — |
| Filter by category | `kanbanStore` | `setFilter({ category })` | `s.filter.category` |
| Search cards | `kanbanStore` | `setFilter({ searchQuery })` | `s.filter.searchQuery` |
| Group by swimlane | `kanbanStore` | `setSwimlaneGroupBy(groupBy)` | `s.swimlaneGroupBy` |
| WIP limit warning | `kanbanStore` | — | `col.wipLimit !== undefined && count >= col.wipLimit` |
| Card age display | `kanbanStore` | — | `formatCardAge(card.createdAt)` |
| Time in column display | `kanbanStore` | — | `formatColumnAge(card.columnEnteredAt)` |
| Throughput (7-day) | `kanbanStore` | — | `getThroughput(archivedEntries.map(e => e.archivedAt))` |
| Column load stats | `kanbanStore` | — | `countsByColumn[col.id]` |
| Loading state | `kanbanStore` | — | `s.loading: boolean` |
| Error state | `kanbanStore` | — | `s.error: string \| null` |
| Personal board | `boardsStore` | `initialize()` | `boards.find(b => b.type === "personal")` |
| Create team board | `boardsStore` | `createTeamBoard(name)` | — |
| Join board by code | `boardsStore` | `joinByCode(code)` | — |
| Leave a board | `boardsStore` | `leaveBoard(boardId)` | — |
| Delete a board | `boardsStore` | `deleteBoard(boardId)` | — |
| Switch active board | `boardsStore` | `setActiveBoard(boardId)` | `s.activeBoardId` |
| Team member list (assignee dropdown) | `boardsStore` | `loadBoardMembers(boardId)` | `s.boardMembers.map(m => m.email)` |
| Sign in | `authStore` | `signIn(email, password)` | — |
| Sign up | `authStore` | `signUp(email, password)` | — |
| Sign out | `authStore` | `signOut()` | — |
| Auth session | `authStore` | `initialize()` | `s.user: User \| null` |

---

## Loading & Error Visibility

All three stores expose `loading: boolean` and `error: string | null`.
The UI surfaces these on every page that triggers async operations:

- **Board**: error displayed below the page title; buttons disabled during loading
- **Archive**: error displayed in header; restore button shows "Restoring…"
- **Settings**: inherits from auth + boards stores
- **Login**: error displayed inline in the form

---

## Data Persistence

| Data | Persistence |
|---|---|
| Cards, columns, archive | Supabase PostgreSQL (scoped by `board_id`) |
| Boards, memberships | Supabase PostgreSQL |
| Auth session | Supabase Auth (JWT in localStorage) |
| Filter & swimlane state | In-memory (resets on page reload by design) |
| Mock mode data | In-memory only (demo; resets on reload) |
