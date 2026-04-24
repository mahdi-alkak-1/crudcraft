import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock the api module
vi.mock("@/lib/api", () => ({
  apiBaseUrl: vi.fn(() => "http://localhost:4000"),
  fetchJson: vi.fn(),
}));

import { fetchJson, apiBaseUrl } from "@/lib/api";
import TasksPage from "@/app/tasks/page";

const mockFetchJson = fetchJson as ReturnType<typeof vi.fn>;
const mockApiBaseUrl = apiBaseUrl as ReturnType<typeof vi.fn>;

const sampleTask = {
  _id: "507f1f77bcf86cd799439011",
  title: "Buy groceries",
  description: "Milk, eggs, bread",
  status: "todo" as const,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

const emptyListResponse = {
  items: [],
  total: 0,
  limit: 20,
  offset: 0,
};

const listWithTasks = {
  items: [sampleTask],
  total: 1,
  limit: 20,
  offset: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockApiBaseUrl.mockReturnValue("http://localhost:4000");
});

// ---------------------------------------------------------------------------
// TasksPage rendering tests
// ---------------------------------------------------------------------------
describe("TasksPage", () => {
  it("shows loading state initially", async () => {
    // Return a promise that doesn't resolve immediately
    mockFetchJson.mockReturnValue(new Promise(() => {}));
    render(<TasksPage />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("renders the Tasks heading", async () => {
    mockFetchJson.mockResolvedValue(emptyListResponse);
    render(<TasksPage />);
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());

    // Use level:1 to specifically target the h1 element (not h2 "Your tasks")
    expect(screen.getByRole("heading", { name: "Tasks", level: 1 })).toBeInTheDocument();
  });

  it("renders a link back to home", async () => {
    mockFetchJson.mockResolvedValue(emptyListResponse);
    render(<TasksPage />);
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());

    const homeLink = screen.getByRole("link", { name: /home/i });
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("displays the API base URL", async () => {
    mockFetchJson.mockResolvedValue(emptyListResponse);
    render(<TasksPage />);
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());

    expect(screen.getByText("http://localhost:4000")).toBeInTheDocument();
  });

  it("shows 'No tasks yet' when task list is empty", async () => {
    mockFetchJson.mockResolvedValue(emptyListResponse);
    render(<TasksPage />);
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());

    expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument();
  });

  it("displays tasks when they are loaded", async () => {
    mockFetchJson.mockResolvedValue(listWithTasks);
    render(<TasksPage />);
    await waitFor(() => expect(screen.getByText("Buy groceries")).toBeInTheDocument());

    expect(screen.getByText("Buy groceries")).toBeInTheDocument();
    expect(screen.getByText("Milk, eggs, bread")).toBeInTheDocument();
  });

  it("shows '—' for tasks without a description", async () => {
    const taskWithoutDesc = { ...sampleTask, description: undefined };
    mockFetchJson.mockResolvedValue({ ...listWithTasks, items: [taskWithoutDesc] });
    render(<TasksPage />);
    await waitFor(() => expect(screen.getByText("Buy groceries")).toBeInTheDocument());

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows '—' for due date when dueDate is absent", async () => {
    const taskWithoutDue = { ...sampleTask, dueDate: undefined };
    mockFetchJson.mockResolvedValue({ ...listWithTasks, items: [taskWithoutDue] });
    render(<TasksPage />);
    await waitFor(() => expect(screen.getByText("Buy groceries")).toBeInTheDocument());

    expect(screen.getByText(/due: —/i)).toBeInTheDocument();
  });

  it("displays the Refresh button after loading", async () => {
    mockFetchJson.mockResolvedValue(emptyListResponse);
    render(<TasksPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: /refresh/i })).toBeInTheDocument());
  });

  it("renders the Add task form", async () => {
    mockFetchJson.mockResolvedValue(emptyListResponse);
    render(<TasksPage />);
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());

    expect(screen.getByRole("button", { name: /add task/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/buy groceries/i)).toBeInTheDocument();
  });

  it("Add task button is disabled when title is empty", async () => {
    mockFetchJson.mockResolvedValue(emptyListResponse);
    render(<TasksPage />);
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());

    const addButton = screen.getByRole("button", { name: /add task/i });
    expect(addButton).toBeDisabled();
  });

  it("Add task button is enabled when title has content", async () => {
    mockFetchJson.mockResolvedValue(emptyListResponse);
    render(<TasksPage />);
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());

    const titleInput = screen.getByPlaceholderText(/buy groceries/i);
    await userEvent.type(titleInput, "New Task");

    const addButton = screen.getByRole("button", { name: /add task/i });
    expect(addButton).not.toBeDisabled();
  });

  it("shows error message when loading tasks fails", async () => {
    mockFetchJson.mockRejectedValue(new Error("Network error"));
    render(<TasksPage />);
    await waitFor(() => expect(screen.getByText("Network error")).toBeInTheDocument());
  });

  it("shows generic error when a non-Error is thrown on load", async () => {
    mockFetchJson.mockRejectedValue("unknown error");
    render(<TasksPage />);
    await waitFor(() => expect(screen.getByText(/failed to load tasks/i)).toBeInTheDocument());
  });

  it("renders a status select for each task", async () => {
    mockFetchJson.mockResolvedValue(listWithTasks);
    render(<TasksPage />);
    await waitFor(() => expect(screen.getByText("Buy groceries")).toBeInTheDocument());

    const select = screen.getByDisplayValue("Todo");
    expect(select).toBeInTheDocument();
  });

  it("renders a Delete button for each task", async () => {
    mockFetchJson.mockResolvedValue(listWithTasks);
    render(<TasksPage />);
    await waitFor(() => expect(screen.getByText("Buy groceries")).toBeInTheDocument());

    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// TasksPage - formatDate behavior (via rendered output)
// ---------------------------------------------------------------------------
describe("TasksPage formatDate", () => {
  it("displays formatted due date when dueDate is present", async () => {
    const taskWithDue = { ...sampleTask, dueDate: "2025-06-15T00:00:00.000Z" };
    mockFetchJson.mockResolvedValue({ ...listWithTasks, items: [taskWithDue] });
    render(<TasksPage />);
    await waitFor(() => expect(screen.getByText("Buy groceries")).toBeInTheDocument());

    // The date should be formatted (not empty, not "—")
    const dueText = screen.getByText(/due:/i);
    expect(dueText.textContent).not.toContain("—");
  });

  it("shows '—' for invalid date strings", async () => {
    const taskWithBadDate = { ...sampleTask, dueDate: "not-a-date" };
    mockFetchJson.mockResolvedValue({ ...listWithTasks, items: [taskWithBadDate] });
    render(<TasksPage />);
    await waitFor(() => expect(screen.getByText("Buy groceries")).toBeInTheDocument());

    expect(screen.getByText(/due: —/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// TasksPage - createTask interaction
// ---------------------------------------------------------------------------
describe("TasksPage createTask", () => {
  it("calls fetchJson POST when form is submitted with a title", async () => {
    // First call: load tasks, Second call: create task, Third call: reload
    mockFetchJson
      .mockResolvedValueOnce(emptyListResponse)
      .mockResolvedValueOnce({ ...sampleTask })
      .mockResolvedValueOnce(listWithTasks);

    render(<TasksPage />);
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());

    const titleInput = screen.getByPlaceholderText(/buy groceries/i);
    await userEvent.type(titleInput, "New Task");

    const form = screen.getByRole("button", { name: /add task/i }).closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(mockFetchJson).toHaveBeenCalledWith(
        "http://localhost:4000/api/tasks",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("clears form fields after successful task creation", async () => {
    mockFetchJson
      .mockResolvedValueOnce(emptyListResponse)
      .mockResolvedValueOnce(sampleTask)
      .mockResolvedValueOnce(emptyListResponse);

    render(<TasksPage />);
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());

    const titleInput = screen.getByPlaceholderText(/buy groceries/i) as HTMLInputElement;
    await userEvent.type(titleInput, "New Task");

    const form = screen.getByRole("button", { name: /add task/i }).closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(titleInput.value).toBe("");
    });
  });

  it("shows error message when task creation fails", async () => {
    mockFetchJson
      .mockResolvedValueOnce(emptyListResponse)
      .mockRejectedValueOnce(new Error("Invalid body"));

    render(<TasksPage />);
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());

    const titleInput = screen.getByPlaceholderText(/buy groceries/i);
    await userEvent.type(titleInput, "Bad Task");

    const form = screen.getByRole("button", { name: /add task/i }).closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(screen.getByText("Invalid body")).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// TasksPage - setStatus (optimistic update)
// ---------------------------------------------------------------------------
describe("TasksPage setStatus", () => {
  it("calls PATCH with the new status when select changes", async () => {
    mockFetchJson
      .mockResolvedValueOnce(listWithTasks)
      .mockResolvedValueOnce({ ...sampleTask, status: "done" });

    render(<TasksPage />);
    await waitFor(() => expect(screen.getByText("Buy groceries")).toBeInTheDocument());

    const select = screen.getByDisplayValue("Todo");
    await act(async () => {
      fireEvent.change(select, { target: { value: "done" } });
    });

    await waitFor(() => {
      expect(mockFetchJson).toHaveBeenCalledWith(
        `http://localhost:4000/api/tasks/${sampleTask._id}`,
        expect.objectContaining({ method: "PATCH" }),
      );
    });
  });
});

// ---------------------------------------------------------------------------
// TasksPage - remove (optimistic delete)
// ---------------------------------------------------------------------------
describe("TasksPage remove", () => {
  it("calls DELETE when delete button is clicked", async () => {
    mockFetchJson
      .mockResolvedValueOnce(listWithTasks)
      .mockResolvedValueOnce(undefined); // 204 response

    render(<TasksPage />);
    await waitFor(() => expect(screen.getByText("Buy groceries")).toBeInTheDocument());

    const deleteButton = screen.getByRole("button", { name: /delete/i });
    await act(async () => {
      fireEvent.click(deleteButton);
    });

    await waitFor(() => {
      expect(mockFetchJson).toHaveBeenCalledWith(
        `http://localhost:4000/api/tasks/${sampleTask._id}`,
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  it("removes task optimistically from the list", async () => {
    mockFetchJson
      .mockResolvedValueOnce(listWithTasks)
      .mockResolvedValueOnce(undefined);

    render(<TasksPage />);
    await waitFor(() => expect(screen.getByText("Buy groceries")).toBeInTheDocument());

    const deleteButton = screen.getByRole("button", { name: /delete/i });
    await act(async () => {
      fireEvent.click(deleteButton);
    });

    await waitFor(() => {
      expect(screen.queryByText("Buy groceries")).not.toBeInTheDocument();
    });
  });

  it("restores task list when delete fails", async () => {
    mockFetchJson
      .mockResolvedValueOnce(listWithTasks)
      .mockRejectedValueOnce(new Error("Failed to delete task"));

    render(<TasksPage />);
    await waitFor(() => expect(screen.getByText("Buy groceries")).toBeInTheDocument());

    const deleteButton = screen.getByRole("button", { name: /delete/i });
    await act(async () => {
      fireEvent.click(deleteButton);
    });

    await waitFor(() => {
      // Task should be restored after failed delete
      expect(screen.getByText("Buy groceries")).toBeInTheDocument();
    });
  });

  it("shows error message when delete fails", async () => {
    mockFetchJson
      .mockResolvedValueOnce(listWithTasks)
      .mockRejectedValueOnce(new Error("Server error"));

    render(<TasksPage />);
    await waitFor(() => expect(screen.getByText("Buy groceries")).toBeInTheDocument());

    const deleteButton = screen.getByRole("button", { name: /delete/i });
    await act(async () => {
      fireEvent.click(deleteButton);
    });

    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });
  });
});