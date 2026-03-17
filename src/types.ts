export type CardCategory = "bug" | "feature" | "docs";
export type SwimlaneGroupBy = "category" | "assignee" | "priority";
export type CardPriority = "low" | "medium" | "high";
export type BoardType = "personal" | "team";

export interface Board {
  id: string;
  name: string;
  type: BoardType;
  ownerId: string;
  joinCode: string | null;
  memberCount: number;
  createdAt: string;
}

export interface Column {
  id: string;
  title: string;
  order: number;
  wipLimit?: number;
}

export interface CardMove {
  at: string;
  fromColumnId: string;
  toColumnId: string;
}

export interface Card {
  id: string;
  title: string;
  description: string;
  category: CardCategory;
  columnId: string;
  assignee?: string;
  priority?: CardPriority;
  createdAt: string;
  columnEnteredAt: string;
  moves: CardMove[];
}

export interface ArchivedCardEntry {
  card: Card;
  archivedAt: string;
}

export interface FilterState {
  category: CardCategory | null;
  swimlaneValue: string | null;
  searchQuery: string;
}
