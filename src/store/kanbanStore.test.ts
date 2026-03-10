import { beforeEach, describe, expect, it } from "vitest";
import { useKanbanStore } from "./kanbanStore";

describe("kanbanStore", () => {
  beforeEach(() => {
    useKanbanStore.getState().resetState();
  });

  it("starts with async-ready loading and error fields", () => {
    const state = useKanbanStore.getState();

    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("adds and deletes a card", async () => {
    await useKanbanStore.getState().addCard({
      title: "Create store operation",
      description: "Step 2 wiring",
      category: "feature",
    });

    const createdCard = useKanbanStore.getState().cards[0];

    expect(useKanbanStore.getState().cards).toHaveLength(1);
    expect(createdCard.columnId).toBe("column-todo");

    await useKanbanStore.getState().deleteCard(createdCard.id);

    expect(useKanbanStore.getState().cards).toHaveLength(0);
  });

  it("moves a card and appends move history", async () => {
    await useKanbanStore.getState().addCard({
      title: "Move this task",
    });

    const createdCard = useKanbanStore.getState().cards[0];

    await useKanbanStore.getState().moveCard(createdCard.id, "column-in-progress");

    const movedCard = useKanbanStore.getState().cards[0];

    expect(movedCard.columnId).toBe("column-in-progress");
    expect(movedCard.moves).toHaveLength(1);
    expect(movedCard.moves[0].fromColumnId).toBe("column-todo");
    expect(movedCard.moves[0].toColumnId).toBe("column-in-progress");
  });
});
