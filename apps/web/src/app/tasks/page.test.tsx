import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TasksPage from "./page";

// Mock the api module
vi.mock("@/lib/api", () => ({
  apiBaseUrl: vi.fn(() => "http://localhost:4000"),
  fetchJson: vi.fn(),
}));

import { fetchJson } from "@/lib/api";

type Task = {
  _id: string;
  title: string;
  description?: string;
  status: "todo" | "doing" | "done";
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
};

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    _id: `id-${Math.random().toString(36).slice(2)}`,
    title: "Sample Task",
    status: "todo",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeListResponse(tasks: Task[] = []) {
  return {
    items: tasks,
    total: tasks.length,
    limit: 20,
    offset: 0,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TasksPage – initial loading", () => {
  it("shows Loading… indicator while fetching tasks", async () => {
    // fetchJson never resolves to keep loading state active
    vi.mocked(fetchJson).mockReturnValue(new Promise(() => {}));
    render(<TasksPage />);
    expect(screen.getByText("Loading…")).toBeDefined();
  });

  it("shows Refresh button after tasks load successfully", async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce(makeListResponse([]));
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /refresh/i })).toBeDefined();
    });
  });

  it("shows empty state message when no tasks exist", async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce(makeListResponse([]));
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText(/no tasks yet/i)).toBeDefined();
    });
  });

  it("renders tasks when they are loaded", async () => {
    const tasks = [
      makeTask({ title: "Buy groceries" }),
      makeTask({ title: "Walk the dog" }),
    ];
    vi.mocked(fetchJson).mockResolvedValueOnce(makeListResponse(tasks));
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText("Buy groceries")).toBeDefined();
      expect(screen.getByText("Walk the dog")).toBeDefined();
    });
  });

  it("shows error message when initial load fails", async () => {
    vi.mocked(fetchJson).mockRejectedValueOnce(new Error("Failed to connect"));
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText("Failed to connect")).toBeDefined();
    });
  });

  it("shows generic error when a non-Error is thrown during load", async () => {
    vi.mocked(fetchJson).mockRejectedValueOnce("something unexpected");
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText("Failed to load tasks")).toBeDefined();
    });
  });

  it("displays the API base URL on the page", async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce(makeListResponse([]));
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText("http://localhost:4000")).toBeDefined();
    });
  });
});

describe("TasksPage – task rendering", () => {
  it("renders task title, description and status", async () => {
    const task = makeTask({
      title: "Fix bug",
      description: "Fix the login bug",
      status: "doing",
    });
    vi.mocked(fetchJson).mockResolvedValueOnce(makeListResponse([task]));
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText("Fix bug")).toBeDefined();
      expect(screen.getByText("Fix the login bug")).toBeDefined();
    });
    // Select should be set to "doing"
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("doing");
  });

  it("shows '—' as placeholder when task has no description", async () => {
    const task = makeTask({ title: "No description task" });
    vi.mocked(fetchJson).mockResolvedValueOnce(makeListResponse([task]));
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText("—")).toBeDefined();
    });
  });

  it("formats and displays due date when present", async () => {
    const task = makeTask({
      title: "Due task",
      dueDate: "2025-06-15T00:00:00.000Z",
    });
    vi.mocked(fetchJson).mockResolvedValueOnce(makeListResponse([task]));
    render(<TasksPage />);
    await waitFor(() => {
      // Due date should be formatted using toLocaleDateString
      const dueLine = screen.getByText(/due:/i);
      expect(dueLine.textContent).not.toBe("Due: —");
    });
  });

  it("shows '—' for due date when task has no dueDate", async () => {
    const task = makeTask({ title: "No due date" });
    vi.mocked(fetchJson).mockResolvedValueOnce(makeListResponse([task]));
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText(/due: —/i)).toBeDefined();
    });
  });

  it("renders multiple tasks each with their own delete button", async () => {
    const tasks = [makeTask({ title: "Task A" }), makeTask({ title: "Task B" })];
    vi.mocked(fetchJson).mockResolvedValueOnce(makeListResponse(tasks));
    render(<TasksPage />);
    await waitFor(() => {
      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      expect(deleteButtons).toHaveLength(2);
    });
  });
});

describe("TasksPage – create task form", () => {
  it("renders the Add task form with title, description, and due date fields", async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce(makeListResponse([]));
    render(<TasksPage />);
    await waitFor(() => screen.getByRole("button", { name: /refresh/i }));

    expect(screen.getByPlaceholderText("Buy groceries")).toBeDefined();
    expect(screen.getByPlaceholderText(/optional notes/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /add task/i })).toBeDefined();
  });

  it("'Add task' button is disabled when title is empty", async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce(makeListResponse([]));
    render(<TasksPage />);
    await waitFor(() => screen.getByRole("button", { name: /refresh/i }));

    const addButton = screen.getByRole("button", { name: /add task/i }) as HTMLButtonElement;
    expect(addButton.disabled).toBe(true);
  });

  it("'Add task' button is disabled when title is whitespace only", async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce(makeListResponse([]));
    render(<TasksPage />);
    await waitFor(() => screen.getByRole("button", { name: /refresh/i }));

    const titleInput = screen.getByPlaceholderText("Buy groceries");
    await userEvent.type(titleInput, "   ");

    const addButton = screen.getByRole("button", { name: /add task/i }) as HTMLButtonElement;
    expect(addButton.disabled).toBe(true);
  });

  it("'Add task' button is enabled when title has content", async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce(makeListResponse([]));
    render(<TasksPage />);
    await waitFor(() => screen.getByRole("button", { name: /refresh/i }));

    const titleInput = screen.getByPlaceholderText("Buy groceries");
    await userEvent.type(titleInput, "New Task");

    const addButton = screen.getByRole("button", { name: /add task/i }) as HTMLButtonElement;
    expect(addButton.disabled).toBe(false);
  });

  it("creates a task and reloads the list on successful submit", async () => {
    const newTask = makeTask({ title: "New Task" });
    // First call: initial load (empty), second call: POST, third call: reload after create
    vi.mocked(fetchJson)
      .mockResolvedValueOnce(makeListResponse([]))      // initial load
      .mockResolvedValueOnce(newTask)                   // POST /api/tasks
      .mockResolvedValueOnce(makeListResponse([newTask])); // reload

    render(<TasksPage />);
    await waitFor(() => screen.getByRole("button", { name: /refresh/i }));

    const titleInput = screen.getByPlaceholderText("Buy groceries");
    await userEvent.type(titleInput, "New Task");
    await userEvent.click(screen.getByRole("button", { name: /add task/i }));

    await waitFor(() => {
      expect(vi.mocked(fetchJson)).toHaveBeenCalledWith(
        expect.stringContaining("/api/tasks"),
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("clears form fields after successful task creation", async () => {
    const newTask = makeTask({ title: "Cleared" });
    vi.mocked(fetchJson)
      .mockResolvedValueOnce(makeListResponse([]))
      .mockResolvedValueOnce(newTask)
      .mockResolvedValueOnce(makeListResponse([newTask]));

    render(<TasksPage />);
    await waitFor(() => screen.getByRole("button", { name: /refresh/i }));

    const titleInput = screen.getByPlaceholderText("Buy groceries") as HTMLInputElement;
    const descInput = screen.getByPlaceholderText(/optional notes/i) as HTMLTextAreaElement;

    await userEvent.type(titleInput, "Cleared");
    await userEvent.type(descInput, "Some description");
    await userEvent.click(screen.getByRole("button", { name: /add task/i }));

    await waitFor(() => {
      expect(titleInput.value).toBe("");
      expect(descInput.value).toBe("");
    });
  });

  it("shows error message when task creation fails", async () => {
    vi.mocked(fetchJson)
      .mockResolvedValueOnce(makeListResponse([]))  // initial load
      .mockRejectedValueOnce(new Error("Server error"));  // POST fails

    render(<TasksPage />);
    await waitFor(() => screen.getByRole("button", { name: /refresh/i }));

    const titleInput = screen.getByPlaceholderText("Buy groceries");
    await userEvent.type(titleInput, "Failing Task");
    await userEvent.click(screen.getByRole("button", { name: /add task/i }));

    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeDefined();
    });
  });

  it("does not include description in POST body when description is empty", async () => {
    const newTask = makeTask({ title: "No desc" });
    vi.mocked(fetchJson)
      .mockResolvedValueOnce(makeListResponse([]))
      .mockResolvedValueOnce(newTask)
      .mockResolvedValueOnce(makeListResponse([newTask]));

    render(<TasksPage />);
    await waitFor(() => screen.getByRole("button", { name: /refresh/i }));

    const titleInput = screen.getByPlaceholderText("Buy groceries");
    await userEvent.type(titleInput, "No desc");
    await userEvent.click(screen.getByRole("button", { name: /add task/i }));

    await waitFor(() => {
      const calls = vi.mocked(fetchJson).mock.calls;
      const postCall = calls.find(
        ([, init]) => init && (init as RequestInit).method === "POST",
      );
      expect(postCall).toBeDefined();
      const body = JSON.parse((postCall![1] as RequestInit).body as string);
      expect(body.description).toBeUndefined();
    });
  });
});

describe("TasksPage – delete task", () => {
  it("removes task from list optimistically on delete", async () => {
    const task = makeTask({ title: "Task to delete", _id: "delete-id" });
    vi.mocked(fetchJson)
      .mockResolvedValueOnce(makeListResponse([task]))  // initial load
      .mockResolvedValueOnce(undefined as any);          // DELETE

    render(<TasksPage />);
    await waitFor(() => screen.getByText("Task to delete"));

    const deleteButton = screen.getByRole("button", { name: /delete/i });
    await userEvent.click(deleteButton);

    // Optimistic removal: task should be gone immediately
    await waitFor(() => {
      expect(screen.queryByText("Task to delete")).toBeNull();
    });
  });

  it("calls DELETE on the correct task endpoint", async () => {
    const task = makeTask({ title: "Task to delete", _id: "specific-id" });
    vi.mocked(fetchJson)
      .mockResolvedValueOnce(makeListResponse([task]))
      .mockResolvedValueOnce(undefined as any);

    render(<TasksPage />);
    await waitFor(() => screen.getByText("Task to delete"));

    const deleteButton = screen.getByRole("button", { name: /delete/i });
    await userEvent.click(deleteButton);

    await waitFor(() => {
      expect(vi.mocked(fetchJson)).toHaveBeenCalledWith(
        expect.stringContaining("/api/tasks/specific-id"),
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  it("restores task list and shows error if delete fails", async () => {
    const task = makeTask({ title: "Restore me", _id: "restore-id" });
    vi.mocked(fetchJson)
      .mockResolvedValueOnce(makeListResponse([task]))  // initial load
      .mockRejectedValueOnce(new Error("Delete failed")); // DELETE fails

    render(<TasksPage />);
    await waitFor(() => screen.getByText("Restore me"));

    await userEvent.click(screen.getByRole("button", { name: /delete/i }));

    await waitFor(() => {
      // Error message shown
      expect(screen.getByText("Delete failed")).toBeDefined();
      // Task restored to list
      expect(screen.getByText("Restore me")).toBeDefined();
    });
  });
});

describe("TasksPage – status change", () => {
  it("updates task status optimistically on select change", async () => {
    const task = makeTask({ title: "Status task", _id: "status-id", status: "todo" });
    vi.mocked(fetchJson)
      .mockResolvedValueOnce(makeListResponse([task]))  // initial load
      .mockResolvedValueOnce({ ...task, status: "doing" }); // PATCH

    render(<TasksPage />);
    await waitFor(() => screen.getByText("Status task"));

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("todo");

    await userEvent.selectOptions(select, "doing");

    await waitFor(() => {
      expect(vi.mocked(fetchJson)).toHaveBeenCalledWith(
        expect.stringContaining("/api/tasks/status-id"),
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ status: "doing" }),
        }),
      );
    });
  });

  it("reloads tasks when status update fails (fetchJson called 3 times total)", async () => {
    const task = makeTask({ title: "Fail update", _id: "fail-id", status: "todo" });
    vi.mocked(fetchJson)
      .mockResolvedValueOnce(makeListResponse([task]))        // initial load
      .mockRejectedValueOnce(new Error("Update failed"))      // PATCH fails
      .mockResolvedValueOnce(makeListResponse([task]));        // reload after failure

    render(<TasksPage />);
    await waitFor(() => screen.getByText("Fail update"));

    const select = screen.getByRole("combobox");
    await userEvent.selectOptions(select, "done");

    // After PATCH fails, the component calls load() to reload tasks.
    // The error message is set briefly (setError("Update failed")) then cleared
    // by the subsequent load() call (setError(null)). We verify the reload
    // happened by checking the total call count.
    await waitFor(() => {
      expect(vi.mocked(fetchJson)).toHaveBeenCalledTimes(3);
    });
    // Task is still shown after reload
    expect(screen.getByText("Fail update")).toBeDefined();
  });
});

describe("TasksPage – refresh button", () => {
  it("calls fetchJson again when Refresh is clicked", async () => {
    vi.mocked(fetchJson)
      .mockResolvedValueOnce(makeListResponse([]))  // initial load
      .mockResolvedValueOnce(makeListResponse([])); // refresh

    render(<TasksPage />);
    await waitFor(() => screen.getByRole("button", { name: /refresh/i }));

    await userEvent.click(screen.getByRole("button", { name: /refresh/i }));

    await waitFor(() => {
      expect(vi.mocked(fetchJson)).toHaveBeenCalledTimes(2);
    });
  });
});

describe("TasksPage – navigation", () => {
  it("renders a Home link", async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce(makeListResponse([]));
    render(<TasksPage />);
    await waitFor(() => screen.getByRole("button", { name: /refresh/i }));

    const homeLink = screen.getByRole("link", { name: /home/i }) as HTMLAnchorElement;
    expect(homeLink.href).toContain("/");
  });
});