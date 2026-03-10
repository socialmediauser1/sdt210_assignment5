import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "./App";
import { useKanbanStore } from "./store/kanbanStore";

function getColumnContainer(columnTitle: string): HTMLElement {
  const titleNode = screen.getByText(columnTitle);
  const headerContainer = titleNode.closest("div");

  if (!headerContainer || !headerContainer.parentElement) {
    throw new Error(`Column container not found for title: ${columnTitle}`);
  }

  return headerContainer.parentElement as HTMLElement;
}

describe("Step 5 wiring verification", () => {
  beforeEach(() => {
    useKanbanStore.getState().resetState();
  });

  afterEach(() => {
    cleanup();
  });

  it("adds and moves a card from the Board UI", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Add Card" }));

    await waitFor(() => {
      expect(screen.queryByText("Task 1")).not.toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Forward" }));

    const todoColumn = getColumnContainer("To Do");
    const inProgressColumn = getColumnContainer("In Progress");

    await waitFor(() => {
      expect(within(todoColumn).queryByText("Task 1")).toBeNull();
      expect(within(inProgressColumn).queryByText("Task 1")).not.toBeNull();
    });
  });

  it("adds and deletes a card from the Board UI", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Add Card" }));

    await waitFor(() => {
      expect(screen.queryByText("Task 1")).not.toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(screen.queryByText("Task 1")).toBeNull();
    });
  });
});
