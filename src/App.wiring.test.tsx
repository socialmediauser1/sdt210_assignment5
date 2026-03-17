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

async function addCardViaModal(title: string) {
  // Click the first per-column "+ Add Card" button
  const addButtons = screen.getAllByRole("button", { name: "+ Add Card" });
  fireEvent.click(addButtons[0]);

  // Fill in the title in the modal
  const titleInput = await screen.findByRole("textbox", { name: /title/i });
  fireEvent.change(titleInput, { target: { value: title } });

  // Submit
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
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

    await addCardViaModal("Task 1");

    await waitFor(() => {
      expect(screen.queryByText("Task 1")).not.toBeNull();
    });

    // Simulate drag-and-drop: dragstart on card, dragover + drop on In Progress column
    const card = screen.getByText("Task 1").closest("li")!;
    const inProgressColumn = getColumnContainer("In Progress");

    fireEvent.dragStart(card);
    fireEvent.dragOver(inProgressColumn);
    fireEvent.drop(inProgressColumn);

    const todoColumn = getColumnContainer("To Do");

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

    await addCardViaModal("Task 1");

    await waitFor(() => {
      expect(screen.queryByText("Task 1")).not.toBeNull();
    });

    // Action buttons are always in the DOM (CSS controls hover visibility)
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(screen.queryByText("Task 1")).toBeNull();
    });
  });
});
