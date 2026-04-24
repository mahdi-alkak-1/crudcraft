import { describe, it, expect } from "vitest";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Schema-level tests for the Task model
// These test the validation logic independently of MongoDB
// ---------------------------------------------------------------------------

// Re-define the schemas here to mirror what's in routes/tasks.ts and models/task.ts
// This tests the shape/validation rather than DB operations

const createTaskSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  status: z.enum(["todo", "doing", "done"]).optional(),
  dueDate: z.null().optional(),
});

const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    description: z.string().trim().min(1).nullable().optional(),
    status: z.enum(["todo", "doing", "done"]).optional(),
    dueDate: z.coerce.date().nullable().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field is required",
  });

const listTasksQuerySchema = z.object({
  status: z.enum(["todo", "doing", "done"]).optional(),
  q: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// ---------------------------------------------------------------------------
// TaskStatus type tests
// ---------------------------------------------------------------------------
describe("TaskStatus", () => {
  it("accepts valid statuses", () => {
    const validStatuses = ["todo", "doing", "done"] as const;
    for (const s of validStatuses) {
      const result = z.enum(["todo", "doing", "done"]).safeParse(s);
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid statuses", () => {
    const invalidStatuses = ["pending", "complete", "in-progress", ""];
    for (const s of invalidStatuses) {
      const result = z.enum(["todo", "doing", "done"]).safeParse(s);
      expect(result.success).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// createTaskSchema tests
// ---------------------------------------------------------------------------
describe("createTaskSchema", () => {
  it("accepts a minimal valid task with title only", () => {
    const result = createTaskSchema.safeParse({ title: "My Task" });
    expect(result.success).toBe(true);
  });

  it("accepts a task with all fields", () => {
    const result = createTaskSchema.safeParse({
      title: "My Task",
      description: "Some notes",
      status: "doing",
    });
    expect(result.success).toBe(true);
  });

  it("trims whitespace from title", () => {
    const result = createTaskSchema.safeParse({ title: "  Trimmed  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Trimmed");
    }
  });

  it("rejects empty title", () => {
    const result = createTaskSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only title (trims to empty)", () => {
    const result = createTaskSchema.safeParse({ title: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects missing title", () => {
    const result = createTaskSchema.safeParse({ description: "Only description" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid status", () => {
    const result = createTaskSchema.safeParse({ title: "Task", status: "waiting" });
    expect(result.success).toBe(false);
  });

  it("accepts 'todo' as status", () => {
    const result = createTaskSchema.safeParse({ title: "Task", status: "todo" });
    expect(result.success).toBe(true);
  });

  it("accepts 'doing' as status", () => {
    const result = createTaskSchema.safeParse({ title: "Task", status: "doing" });
    expect(result.success).toBe(true);
  });

  it("accepts 'done' as status", () => {
    const result = createTaskSchema.safeParse({ title: "Task", status: "done" });
    expect(result.success).toBe(true);
  });

  it("trims description whitespace", () => {
    const result = createTaskSchema.safeParse({
      title: "Task",
      description: "  desc  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe("desc");
    }
  });

  it("rejects description that is only whitespace (trims to empty)", () => {
    const result = createTaskSchema.safeParse({
      title: "Task",
      description: "   ",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updateTaskSchema tests
// ---------------------------------------------------------------------------
describe("updateTaskSchema", () => {
  it("accepts updating only status", () => {
    const result = updateTaskSchema.safeParse({ status: "done" });
    expect(result.success).toBe(true);
  });

  it("accepts updating only title", () => {
    const result = updateTaskSchema.safeParse({ title: "New title" });
    expect(result.success).toBe(true);
  });

  it("accepts updating only description", () => {
    const result = updateTaskSchema.safeParse({ description: "New desc" });
    expect(result.success).toBe(true);
  });

  it("accepts setting description to null (unset)", () => {
    const result = updateTaskSchema.safeParse({ description: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBeNull();
    }
  });

  it("accepts setting dueDate to null (unset)", () => {
    const result = updateTaskSchema.safeParse({ dueDate: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dueDate).toBeNull();
    }
  });

  it("coerces dueDate string to Date", () => {
    const result = updateTaskSchema.safeParse({ dueDate: "2025-12-31" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dueDate).toBeInstanceOf(Date);
    }
  });

  it("rejects empty object (no fields provided)", () => {
    const result = updateTaskSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects empty title string", () => {
    const result = updateTaskSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid status value", () => {
    const result = updateTaskSchema.safeParse({ status: "completed" });
    expect(result.success).toBe(false);
  });

  it("accepts all fields together", () => {
    const result = updateTaskSchema.safeParse({
      title: "Updated",
      description: "Updated desc",
      status: "doing",
      dueDate: "2025-06-30",
    });
    expect(result.success).toBe(true);
  });

  it("trims title", () => {
    const result = updateTaskSchema.safeParse({ title: "  Trimmed  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Trimmed");
    }
  });

  it("rejects whitespace-only title", () => {
    const result = updateTaskSchema.safeParse({ title: "   " });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// listTasksQuerySchema tests
// ---------------------------------------------------------------------------
describe("listTasksQuerySchema", () => {
  it("uses default limit of 20 and offset of 0", () => {
    const result = listTasksQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
      expect(result.data.offset).toBe(0);
    }
  });

  it("parses string limit to number", () => {
    const result = listTasksQuerySchema.safeParse({ limit: "50" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
    }
  });

  it("parses string offset to number", () => {
    const result = listTasksQuerySchema.safeParse({ offset: "10" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.offset).toBe(10);
    }
  });

  it("rejects limit over 100", () => {
    const result = listTasksQuerySchema.safeParse({ limit: "101" });
    expect(result.success).toBe(false);
  });

  it("rejects limit of 0", () => {
    const result = listTasksQuerySchema.safeParse({ limit: "0" });
    expect(result.success).toBe(false);
  });

  it("rejects negative offset", () => {
    const result = listTasksQuerySchema.safeParse({ offset: "-1" });
    expect(result.success).toBe(false);
  });

  it("accepts valid status filter", () => {
    const result = listTasksQuerySchema.safeParse({ status: "todo" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("todo");
    }
  });

  it("rejects invalid status", () => {
    const result = listTasksQuerySchema.safeParse({ status: "unknown" });
    expect(result.success).toBe(false);
  });

  it("accepts search query q", () => {
    const result = listTasksQuerySchema.safeParse({ q: "grocery" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.q).toBe("grocery");
    }
  });

  it("trims q and rejects if empty after trim", () => {
    // q has .trim().min(1), so whitespace-only q would fail
    const result = listTasksQuerySchema.safeParse({ q: "   " });
    expect(result.success).toBe(false);
  });

  it("accepts limit of exactly 100", () => {
    const result = listTasksQuerySchema.safeParse({ limit: "100" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(100);
    }
  });

  it("accepts limit of exactly 1", () => {
    const result = listTasksQuerySchema.safeParse({ limit: "1" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(1);
    }
  });
});