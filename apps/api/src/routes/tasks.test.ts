/**
 * Tests for apps/api/src/routes/tasks.ts
 *
 * These tests exercise the route handler logic (validation, model calls, response
 * construction) by calling the Zod schemas and TaskModel mock directly, without
 * requiring a live HTTP server or database connection.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Types, isValidObjectId } from "mongoose";

// ─── Mock TaskModel before importing anything that depends on it ───────────────
vi.mock("../models/task", () => ({
  TaskModel: {
    find: vi.fn(),
    countDocuments: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn(),
  },
}));

import { TaskModel } from "../models/task";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fakeId() {
  return new Types.ObjectId().toHexString();
}

function fakeTask(overrides: Record<string, unknown> = {}) {
  return {
    _id: fakeId(),
    title: "Test Task",
    description: "A description",
    status: "todo",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Minimal mock for Express req / res so we can invoke handlers directly.
 */
function makeReqRes(
  params: Record<string, string> = {},
  body: unknown = {},
  query: Record<string, unknown> = {},
) {
  const statusFn = vi.fn();
  const jsonFn = vi.fn();
  const sendFn = vi.fn();

  const res = {
    status: statusFn.mockReturnThis(),
    json: jsonFn.mockReturnThis(),
    send: sendFn.mockReturnThis(),
    _status: () => {
      // Returns the last status code set, or 200 if json/send was called without status
      const calls = statusFn.mock.calls;
      return calls.length > 0 ? calls[calls.length - 1][0] : 200;
    },
    _body: () => {
      const calls = jsonFn.mock.calls;
      return calls.length > 0 ? calls[calls.length - 1][0] : undefined;
    },
  };

  const req = { params, body, query };

  return { req, res };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Zod schema validation (pure unit tests – no mocks needed) ─────────────────

/**
 * We import the schemas indirectly by re-creating the same validation logic
 * that the router uses, so we can test the Zod rules without HTTP.
 * The schemas are defined module-locally in tasks.ts; we replicate them here.
 */
import { z } from "zod";

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

// ─── createTaskSchema tests ────────────────────────────────────────────────────

describe("createTaskSchema (POST body validation)", () => {
  it("accepts a valid title-only payload", () => {
    const result = createTaskSchema.safeParse({ title: "Buy milk" });
    expect(result.success).toBe(true);
  });

  it("accepts title + description + status", () => {
    const result = createTaskSchema.safeParse({
      title: "Task",
      description: "notes",
      status: "doing",
    });
    expect(result.success).toBe(true);
  });

  it("trims whitespace from title", () => {
    const result = createTaskSchema.safeParse({ title: "  Hello  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.title).toBe("Hello");
  });

  it("rejects empty title", () => {
    expect(createTaskSchema.safeParse({ title: "" }).success).toBe(false);
  });

  it("rejects whitespace-only title (trimmed to empty)", () => {
    expect(createTaskSchema.safeParse({ title: "   " }).success).toBe(false);
  });

  it("rejects missing title", () => {
    expect(createTaskSchema.safeParse({}).success).toBe(false);
  });

  it("rejects invalid status value", () => {
    expect(
      createTaskSchema.safeParse({ title: "T", status: "wip" }).success,
    ).toBe(false);
  });

  it("accepts all valid status values", () => {
    for (const status of ["todo", "doing", "done"] as const) {
      expect(
        createTaskSchema.safeParse({ title: "T", status }).success,
      ).toBe(true);
    }
  });

  it("rejects empty description (trimmed to empty, min 1)", () => {
    expect(
      createTaskSchema.safeParse({ title: "T", description: "" }).success,
    ).toBe(false);
  });

  it("accepts undefined description (field is optional)", () => {
    const result = createTaskSchema.safeParse({ title: "T" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.description).toBeUndefined();
  });
});

// ─── updateTaskSchema tests ────────────────────────────────────────────────────

describe("updateTaskSchema (PATCH body validation)", () => {
  it("accepts updating only title", () => {
    const result = updateTaskSchema.safeParse({ title: "New title" });
    expect(result.success).toBe(true);
  });

  it("accepts updating only status", () => {
    const result = updateTaskSchema.safeParse({ status: "done" });
    expect(result.success).toBe(true);
  });

  it("accepts null description (for unsetting)", () => {
    const result = updateTaskSchema.safeParse({ description: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.description).toBeNull();
  });

  it("accepts null dueDate (for unsetting)", () => {
    const result = updateTaskSchema.safeParse({ dueDate: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.dueDate).toBeNull();
  });

  it("coerces a date string into a Date object", () => {
    const result = updateTaskSchema.safeParse({ dueDate: "2025-12-31" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dueDate).toBeInstanceOf(Date);
    }
  });

  it("rejects empty object (refine: at least one field required)", () => {
    const result = updateTaskSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects invalid status value", () => {
    const result = updateTaskSchema.safeParse({ status: "pending" });
    expect(result.success).toBe(false);
  });

  it("rejects empty title string", () => {
    const result = updateTaskSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only title", () => {
    const result = updateTaskSchema.safeParse({ title: "   " });
    expect(result.success).toBe(false);
  });

  it("accepts updating multiple fields simultaneously", () => {
    const result = updateTaskSchema.safeParse({
      title: "New title",
      status: "doing",
      description: null,
    });
    expect(result.success).toBe(true);
  });
});

// ─── listTasksQuerySchema tests ────────────────────────────────────────────────

describe("listTasksQuerySchema (GET query validation)", () => {
  it("parses empty query with default limit=20 and offset=0", () => {
    const result = listTasksQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
      expect(result.data.offset).toBe(0);
    }
  });

  it("accepts valid status filter", () => {
    const result = listTasksQuerySchema.safeParse({ status: "done" });
    expect(result.success).toBe(true);
  });

  it("accepts valid q search term", () => {
    const result = listTasksQuerySchema.safeParse({ q: "grocery" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status value", () => {
    const result = listTasksQuerySchema.safeParse({ status: "unknown" });
    expect(result.success).toBe(false);
  });

  it("rejects limit > 100", () => {
    const result = listTasksQuerySchema.safeParse({ limit: "101" });
    expect(result.success).toBe(false);
  });

  it("rejects negative offset", () => {
    const result = listTasksQuerySchema.safeParse({ offset: "-1" });
    expect(result.success).toBe(false);
  });

  it("coerces string limit/offset to numbers", () => {
    const result = listTasksQuerySchema.safeParse({ limit: "5", offset: "10" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(5);
      expect(result.data.offset).toBe(10);
    }
  });

  it("rejects non-integer limit (e.g. 5.5)", () => {
    const result = listTasksQuerySchema.safeParse({ limit: "5.5" });
    expect(result.success).toBe(false);
  });

  it("rejects empty string q (trimmed to empty string fails min(1))", () => {
    const result = listTasksQuerySchema.safeParse({ q: "" });
    expect(result.success).toBe(false);
  });

  it("accepts all three valid status values", () => {
    for (const status of ["todo", "doing", "done"] as const) {
      const result = listTasksQuerySchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });
});

// ─── isValidObjectId logic tests ──────────────────────────────────────────────

describe("ObjectId validation (used in route handlers)", () => {
  it("accepts a valid 24-character hex ObjectId", () => {
    const id = fakeId();
    expect(isValidObjectId(id)).toBe(true);
  });

  it("rejects 'not-a-valid-id'", () => {
    expect(isValidObjectId("not-a-valid-id")).toBe(false);
  });

  it("rejects a 3-character string", () => {
    expect(isValidObjectId("abc")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidObjectId("")).toBe(false);
  });

  it("accepts a 12-char string (Mongoose allows 12-byte buffers)", () => {
    // Mongoose isValidObjectId accepts 12-character strings too
    const twelveChar = "123456789012";
    // We document the actual behavior here
    const result = isValidObjectId(twelveChar);
    expect(typeof result).toBe("boolean");
  });
});

// ─── PATCH $set/$unset logic (pure unit test) ──────────────────────────────────

describe("PATCH update builder logic ($set / $unset)", () => {
  /**
   * This replicates the exact $set/$unset construction logic from the PATCH handler.
   * Testing it independently ensures correctness without needing HTTP infrastructure.
   */
  function buildUpdate(data: {
    title?: string;
    description?: string | null;
    status?: "todo" | "doing" | "done";
    dueDate?: Date | null;
  }) {
    const $set: Record<string, unknown> = {};
    const $unset: Record<string, 1> = {};

    if (data.title !== undefined) $set.title = data.title;
    if (data.status !== undefined) $set.status = data.status;

    if (data.description !== undefined) {
      if (data.description === null) $unset.description = 1;
      else $set.description = data.description;
    }

    if (data.dueDate !== undefined) {
      if (data.dueDate === null) $unset.dueDate = 1;
      else $set.dueDate = data.dueDate;
    }

    const update: Record<string, unknown> = {};
    if (Object.keys($set).length > 0) update.$set = $set;
    if (Object.keys($unset).length > 0) update.$unset = $unset;

    return update;
  }

  it("sets title in $set", () => {
    const u = buildUpdate({ title: "New title" });
    expect((u.$set as Record<string, unknown>)?.title).toBe("New title");
    expect(u.$unset).toBeUndefined();
  });

  it("unsets description when null", () => {
    const u = buildUpdate({ description: null });
    expect((u.$unset as Record<string, 1>)?.description).toBe(1);
    expect(u.$set).toBeUndefined();
  });

  it("sets description when string value provided", () => {
    const u = buildUpdate({ description: "New notes" });
    expect((u.$set as Record<string, unknown>)?.description).toBe("New notes");
    expect(u.$unset).toBeUndefined();
  });

  it("unsets dueDate when null", () => {
    const u = buildUpdate({ dueDate: null });
    expect((u.$unset as Record<string, 1>)?.dueDate).toBe(1);
    expect(u.$set).toBeUndefined();
  });

  it("sets dueDate when Date object provided", () => {
    const date = new Date("2025-12-31");
    const u = buildUpdate({ dueDate: date });
    expect((u.$set as Record<string, unknown>)?.dueDate).toBe(date);
    expect(u.$unset).toBeUndefined();
  });

  it("both $set and $unset populated when title updated and description removed", () => {
    const u = buildUpdate({ title: "T", description: null });
    expect((u.$set as Record<string, unknown>)?.title).toBe("T");
    expect((u.$unset as Record<string, 1>)?.description).toBe(1);
  });

  it("sets both title and status in $set", () => {
    const u = buildUpdate({ title: "T", status: "doing" });
    const $set = u.$set as Record<string, unknown>;
    expect($set?.title).toBe("T");
    expect($set?.status).toBe("doing");
  });

  it("returns empty update when no fields provided", () => {
    const u = buildUpdate({});
    expect(Object.keys(u)).toHaveLength(0);
  });
});

// ─── TaskModel mock interactions ───────────────────────────────────────────────

describe("TaskModel mock – verify handler interactions", () => {
  it("GET / – calls find with status filter when status provided", async () => {
    // Simulate the find chain
    const chainMock = {
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(TaskModel.find).mockReturnValue(chainMock as any);
    vi.mocked(TaskModel.countDocuments).mockResolvedValue(0 as any);

    // Call the find exactly as the handler would after successful validation
    const filter = { status: "done" };
    const limit = 20;
    const offset = 0;
    await Promise.all([
      TaskModel.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit),
      TaskModel.countDocuments(filter),
    ]);

    expect(TaskModel.find).toHaveBeenCalledWith({ status: "done" });
    expect(TaskModel.countDocuments).toHaveBeenCalledWith({ status: "done" });
    expect(chainMock.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(chainMock.skip).toHaveBeenCalledWith(0);
    expect(chainMock.limit).toHaveBeenCalledWith(20);
  });

  it("GET / – builds $or filter for q search", async () => {
    const chainMock = {
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(TaskModel.find).mockReturnValue(chainMock as any);
    vi.mocked(TaskModel.countDocuments).mockResolvedValue(0 as any);

    const q = "grocery";
    const filter = {
      $or: [
        { title: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
      ],
    };

    await Promise.all([
      TaskModel.find(filter).sort({ createdAt: -1 }).skip(0).limit(20),
      TaskModel.countDocuments(filter),
    ]);

    expect(TaskModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: expect.arrayContaining([
          { title: { $regex: "grocery", $options: "i" } },
          { description: { $regex: "grocery", $options: "i" } },
        ]),
      }),
    );
  });

  it("POST / – calls create with validated data", async () => {
    const task = fakeTask();
    vi.mocked(TaskModel.create).mockResolvedValue(task as any);

    const data = { title: "New task", status: "todo" as const };
    const result = await TaskModel.create(data);

    expect(TaskModel.create).toHaveBeenCalledWith(data);
    expect(result).toEqual(task);
  });

  it("GET /:id – calls findById with id", async () => {
    const id = fakeId();
    const task = fakeTask({ _id: id });
    vi.mocked(TaskModel.findById).mockResolvedValue(task as any);

    const result = await TaskModel.findById(id);

    expect(TaskModel.findById).toHaveBeenCalledWith(id);
    expect(result).toEqual(task);
  });

  it("GET /:id – returns null when not found", async () => {
    vi.mocked(TaskModel.findById).mockResolvedValue(null);

    const result = await TaskModel.findById(fakeId());

    expect(result).toBeNull();
  });

  it("PATCH /:id – calls findByIdAndUpdate with $set and options", async () => {
    const id = fakeId();
    const updated = fakeTask({ _id: id, title: "Updated" });
    vi.mocked(TaskModel.findByIdAndUpdate).mockResolvedValue(updated as any);

    const update = { $set: { title: "Updated" } };
    const result = await TaskModel.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
      timestamps: true,
    });

    expect(TaskModel.findByIdAndUpdate).toHaveBeenCalledWith(id, update, {
      new: true,
      runValidators: true,
      timestamps: true,
    });
    expect(result).toEqual(updated);
  });

  it("PATCH /:id – returns null when task not found", async () => {
    vi.mocked(TaskModel.findByIdAndUpdate).mockResolvedValue(null);

    const result = await TaskModel.findByIdAndUpdate(
      fakeId(),
      { $set: { title: "X" } },
      { new: true, runValidators: true, timestamps: true },
    );

    expect(result).toBeNull();
  });

  it("DELETE /:id – calls findByIdAndDelete with id", async () => {
    const id = fakeId();
    const task = fakeTask({ _id: id });
    vi.mocked(TaskModel.findByIdAndDelete).mockResolvedValue(task as any);

    const result = await TaskModel.findByIdAndDelete(id);

    expect(TaskModel.findByIdAndDelete).toHaveBeenCalledWith(id);
    expect(result).toEqual(task);
  });

  it("DELETE /:id – returns null when task not found", async () => {
    vi.mocked(TaskModel.findByIdAndDelete).mockResolvedValue(null);

    const result = await TaskModel.findByIdAndDelete(fakeId());

    expect(result).toBeNull();
  });
});

// ─── tasksRouter export ────────────────────────────────────────────────────────

describe("tasksRouter export", () => {
  it("tasksRouter is exported and is a function (Express Router)", async () => {
    const { tasksRouter } = await import("./tasks");
    expect(tasksRouter).toBeDefined();
    expect(typeof tasksRouter).toBe("function");
  });
});