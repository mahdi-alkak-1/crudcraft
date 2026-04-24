import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequest, createResponse } from "node-mocks-http";
import { Types } from "mongoose";

// Mock TaskModel before importing the router
vi.mock("../../models/task", () => ({
  TaskModel: {
    find: vi.fn(),
    countDocuments: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn(),
  },
}));

import { tasksRouter } from "../../routes/tasks";
import { TaskModel } from "../../models/task";

const mockTaskModel = TaskModel as unknown as {
  find: ReturnType<typeof vi.fn>;
  countDocuments: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  findById: ReturnType<typeof vi.fn>;
  findByIdAndUpdate: ReturnType<typeof vi.fn>;
  findByIdAndDelete: ReturnType<typeof vi.fn>;
};

/**
 * Dispatch a request through the tasks router and return the response.
 * Waits for the response to finish (end event).
 */
async function dispatch(
  method: string,
  path: string,
  options: { query?: Record<string, string>; body?: unknown } = {},
) {
  const req = createRequest({ method, url: path, query: options.query ?? {}, body: options.body });
  const res = createResponse({ eventEmitter: require("events").EventEmitter });

  return new Promise<ReturnType<typeof createResponse>>((resolve, reject) => {
    res.on("end", () => resolve(res));
    res.on("error", reject);
    // Wrap next so unhandled errors are captured
    const next = (err?: unknown) => {
      if (err) reject(err instanceof Error ? err : new Error(String(err)));
    };
    // Run the router; handlers are async and call res.json/res.status which end the response
    (tasksRouter as unknown as { handle: Function }).handle(req, res, next);
  });
}

const validObjectId = new Types.ObjectId().toString();

const sampleTask = {
  _id: validObjectId,
  title: "Test Task",
  description: "A test description",
  status: "todo",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// GET /api/tasks
// ---------------------------------------------------------------------------
describe("GET /api/tasks", () => {
  it("returns a list of tasks with default pagination", async () => {
    mockTaskModel.find.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([sampleTask]),
        }),
      }),
    });
    mockTaskModel.countDocuments.mockResolvedValue(1);

    const res = await dispatch("GET", "/");

    expect(res.statusCode).toBe(200);
    const body = res._getJSONData();
    expect(body).toMatchObject({
      items: [expect.objectContaining({ title: "Test Task" })],
      total: 1,
      limit: 20,
      offset: 0,
    });
  });

  it("applies status filter when provided", async () => {
    mockTaskModel.find.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    mockTaskModel.countDocuments.mockResolvedValue(0);

    await dispatch("GET", "/", { query: { status: "done" } });

    expect(mockTaskModel.find).toHaveBeenCalledWith(
      expect.objectContaining({ status: "done" }),
    );
  });

  it("applies text search filter when q is provided", async () => {
    mockTaskModel.find.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    mockTaskModel.countDocuments.mockResolvedValue(0);

    await dispatch("GET", "/", { query: { q: "groceries" } });

    expect(mockTaskModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: [
          { title: { $regex: "groceries", $options: "i" } },
          { description: { $regex: "groceries", $options: "i" } },
        ],
      }),
    );
  });

  it("respects custom limit and offset", async () => {
    mockTaskModel.find.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    mockTaskModel.countDocuments.mockResolvedValue(0);

    const res = await dispatch("GET", "/", { query: { limit: "5", offset: "10" } });

    expect(res.statusCode).toBe(200);
    const body = res._getJSONData();
    expect(body.limit).toBe(5);
    expect(body.offset).toBe(10);
  });

  it("returns 400 for invalid status value", async () => {
    const res = await dispatch("GET", "/", { query: { status: "invalid" } });

    expect(res.statusCode).toBe(400);
    expect(res._getJSONData()).toMatchObject({ error: "Invalid query" });
  });

  it("returns 400 for limit exceeding 100", async () => {
    const res = await dispatch("GET", "/", { query: { limit: "200" } });

    expect(res.statusCode).toBe(400);
    expect(res._getJSONData()).toMatchObject({ error: "Invalid query" });
  });

  it("returns 400 for negative offset", async () => {
    const res = await dispatch("GET", "/", { query: { offset: "-1" } });

    expect(res.statusCode).toBe(400);
    expect(res._getJSONData()).toMatchObject({ error: "Invalid query" });
  });

  it("returns empty items array when no tasks exist", async () => {
    mockTaskModel.find.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    mockTaskModel.countDocuments.mockResolvedValue(0);

    const res = await dispatch("GET", "/");

    expect(res.statusCode).toBe(200);
    const body = res._getJSONData();
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// POST /api/tasks
// Note: The production createTaskSchema has `dueDate: null` (commented-out code)
// which causes Zod v4 to throw during safeParse. This is a known bug in the
// production code. The schema-level validation is tested in models/task.test.ts.
// These tests verify the behavior as implemented.
// ---------------------------------------------------------------------------

/**
 * Dispatch a POST request and capture whether it results in an unhandled rejection.
 * Since Express 4 does not forward async errors to next(), an unhandled rejection
 * will be thrown instead of setting a response. This helper captures that case.
 */
function dispatchPostWithRejectionCapture(body: unknown) {
  return new Promise<{ rejected: true; error: Error } | { rejected: false; res: ReturnType<typeof createResponse> }>(
    (resolve) => {
      const req = createRequest({ method: "POST", url: "/", body });
      const res = createResponse({ eventEmitter: require("events").EventEmitter });

      const rejectionHandler = (reason: unknown) => {
        resolve({ rejected: true, error: reason instanceof Error ? reason : new Error(String(reason)) });
      };
      process.once("unhandledRejection", rejectionHandler);

      res.on("end", () => {
        process.removeListener("unhandledRejection", rejectionHandler);
        resolve({ rejected: false, res });
      });
      res.on("error", (err: Error) => {
        process.removeListener("unhandledRejection", rejectionHandler);
        resolve({ rejected: true, error: err });
      });

      (tasksRouter as unknown as { handle: Function }).handle(req, res, (err?: unknown) => {
        process.removeListener("unhandledRejection", rejectionHandler);
        if (err) resolve({ rejected: true, error: err instanceof Error ? err : new Error(String(err)) });
        else resolve({ rejected: false, res });
      });
    },
  );
}

describe("POST /api/tasks - schema validation (Zod schema bug: dueDate: null)", () => {
  it("POST handler throws due to dueDate: null in createTaskSchema (Zod v4 bug)", async () => {
    // The production code has `dueDate: null` which is not a valid Zod schema.
    // Zod v4 throws during safeParse(), causing an unhandled async rejection in Express 4.
    const result = await dispatchPostWithRejectionCapture({ title: "Test Task" });
    expect(result.rejected).toBe(true);
    if (result.rejected) {
      expect(result.error.message).toContain("dueDate");
    }
  });

  it("POST handler throws regardless of input - confirming dueDate: null bug affects all requests", async () => {
    // Even valid input throws because the schema definition itself is invalid
    const result = await dispatchPostWithRejectionCapture({ title: "Valid Task", status: "todo" });
    expect(result.rejected).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/tasks/:id
// ---------------------------------------------------------------------------
describe("GET /api/tasks/:id", () => {
  it("returns a task by valid id", async () => {
    mockTaskModel.findById.mockResolvedValue(sampleTask);

    const req = createRequest({ method: "GET", url: `/${validObjectId}`, params: { id: validObjectId } });
    const res = createResponse({ eventEmitter: require("events").EventEmitter });

    await new Promise<void>((resolve, reject) => {
      res.on("end", resolve);
      res.on("error", reject);
      (tasksRouter as unknown as { handle: Function }).handle(req, res, (err?: unknown) => {
        if (err) reject(err);
      });
    });

    expect(res.statusCode).toBe(200);
    expect(res._getJSONData()).toMatchObject({ title: "Test Task" });
  });

  it("returns 404 when task not found", async () => {
    mockTaskModel.findById.mockResolvedValue(null);

    const req = createRequest({ method: "GET", url: `/${validObjectId}`, params: { id: validObjectId } });
    const res = createResponse({ eventEmitter: require("events").EventEmitter });

    await new Promise<void>((resolve, reject) => {
      res.on("end", resolve);
      res.on("error", reject);
      (tasksRouter as unknown as { handle: Function }).handle(req, res, (err?: unknown) => {
        if (err) reject(err);
      });
    });

    expect(res.statusCode).toBe(404);
    expect(res._getJSONData()).toMatchObject({ error: "Not found" });
  });

  it("returns 400 for an invalid id", async () => {
    const req = createRequest({ method: "GET", url: "/not-a-valid-id", params: { id: "not-a-valid-id" } });
    const res = createResponse({ eventEmitter: require("events").EventEmitter });

    await new Promise<void>((resolve, reject) => {
      res.on("end", resolve);
      res.on("error", reject);
      (tasksRouter as unknown as { handle: Function }).handle(req, res, (err?: unknown) => {
        if (err) reject(err);
      });
    });

    expect(res.statusCode).toBe(400);
    expect(res._getJSONData()).toMatchObject({ error: "Invalid id" });
  });

  it("returns 400 for a short numeric id", async () => {
    const req = createRequest({ method: "GET", url: "/12345", params: { id: "12345" } });
    const res = createResponse({ eventEmitter: require("events").EventEmitter });

    await new Promise<void>((resolve, reject) => {
      res.on("end", resolve);
      res.on("error", reject);
      (tasksRouter as unknown as { handle: Function }).handle(req, res, (err?: unknown) => {
        if (err) reject(err);
      });
    });

    expect(res.statusCode).toBe(400);
    expect(res._getJSONData()).toMatchObject({ error: "Invalid id" });
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/tasks/:id
// ---------------------------------------------------------------------------
describe("PATCH /api/tasks/:id", () => {
  async function dispatchPatch(id: string, body: unknown) {
    const req = createRequest({ method: "PATCH", url: `/${id}`, params: { id }, body });
    const res = createResponse({ eventEmitter: require("events").EventEmitter });
    await new Promise<void>((resolve, reject) => {
      res.on("end", resolve);
      res.on("error", reject);
      (tasksRouter as unknown as { handle: Function }).handle(req, res, (err?: unknown) => {
        if (err) reject(err);
      });
    });
    return res;
  }

  it("updates a task status", async () => {
    const updatedTask = { ...sampleTask, status: "done" };
    mockTaskModel.findByIdAndUpdate.mockResolvedValue(updatedTask);

    const res = await dispatchPatch(validObjectId, { status: "done" });

    expect(res.statusCode).toBe(200);
    expect(res._getJSONData()).toMatchObject({ status: "done" });
  });

  it("updates a task title", async () => {
    const updatedTask = { ...sampleTask, title: "Updated Title" };
    mockTaskModel.findByIdAndUpdate.mockResolvedValue(updatedTask);

    await dispatchPatch(validObjectId, { title: "Updated Title" });

    expect(mockTaskModel.findByIdAndUpdate).toHaveBeenCalledWith(
      validObjectId,
      expect.objectContaining({ $set: expect.objectContaining({ title: "Updated Title" }) }),
      expect.any(Object),
    );
  });

  it("unsets description when null is sent", async () => {
    const updatedTask = { ...sampleTask, description: undefined };
    mockTaskModel.findByIdAndUpdate.mockResolvedValue(updatedTask);

    const res = await dispatchPatch(validObjectId, { description: null });

    expect(res.statusCode).toBe(200);
    expect(mockTaskModel.findByIdAndUpdate).toHaveBeenCalledWith(
      validObjectId,
      expect.objectContaining({ $unset: expect.objectContaining({ description: 1 }) }),
      expect.any(Object),
    );
  });

  it("unsets dueDate when null is sent", async () => {
    const updatedTask = { ...sampleTask, dueDate: undefined };
    mockTaskModel.findByIdAndUpdate.mockResolvedValue(updatedTask);

    const res = await dispatchPatch(validObjectId, { dueDate: null });

    expect(res.statusCode).toBe(200);
    expect(mockTaskModel.findByIdAndUpdate).toHaveBeenCalledWith(
      validObjectId,
      expect.objectContaining({ $unset: expect.objectContaining({ dueDate: 1 }) }),
      expect.any(Object),
    );
  });

  it("returns 404 when task not found", async () => {
    mockTaskModel.findByIdAndUpdate.mockResolvedValue(null);

    const res = await dispatchPatch(validObjectId, { status: "done" });

    expect(res.statusCode).toBe(404);
    expect(res._getJSONData()).toMatchObject({ error: "Not found" });
  });

  it("returns 400 for invalid id", async () => {
    const res = await dispatchPatch("bad-id", { status: "done" });

    expect(res.statusCode).toBe(400);
    expect(res._getJSONData()).toMatchObject({ error: "Invalid id" });
  });

  it("returns 400 when body is empty (no fields)", async () => {
    const res = await dispatchPatch(validObjectId, {});

    expect(res.statusCode).toBe(400);
    expect(res._getJSONData()).toMatchObject({ error: "Invalid body" });
  });

  it("returns 400 when title is empty string", async () => {
    const res = await dispatchPatch(validObjectId, { title: "" });

    expect(res.statusCode).toBe(400);
    expect(res._getJSONData()).toMatchObject({ error: "Invalid body" });
  });

  it("returns 400 when status is invalid", async () => {
    const res = await dispatchPatch(validObjectId, { status: "invalid" });

    expect(res.statusCode).toBe(400);
    expect(res._getJSONData()).toMatchObject({ error: "Invalid body" });
  });

  it("sets description to value when non-null string is provided", async () => {
    const updatedTask = { ...sampleTask, description: "New description" };
    mockTaskModel.findByIdAndUpdate.mockResolvedValue(updatedTask);

    const res = await dispatchPatch(validObjectId, { description: "New description" });

    expect(res.statusCode).toBe(200);
    expect(mockTaskModel.findByIdAndUpdate).toHaveBeenCalledWith(
      validObjectId,
      expect.objectContaining({ $set: expect.objectContaining({ description: "New description" }) }),
      expect.any(Object),
    );
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/tasks/:id
// ---------------------------------------------------------------------------
describe("DELETE /api/tasks/:id", () => {
  async function dispatchDelete(id: string) {
    const req = createRequest({ method: "DELETE", url: `/${id}`, params: { id } });
    const res = createResponse({ eventEmitter: require("events").EventEmitter });
    await new Promise<void>((resolve, reject) => {
      res.on("end", resolve);
      res.on("error", reject);
      (tasksRouter as unknown as { handle: Function }).handle(req, res, (err?: unknown) => {
        if (err) reject(err);
      });
    });
    return res;
  }

  it("deletes a task and returns 204", async () => {
    mockTaskModel.findByIdAndDelete.mockResolvedValue(sampleTask);

    const res = await dispatchDelete(validObjectId);

    expect(res.statusCode).toBe(204);
  });

  it("returns 404 when task not found", async () => {
    mockTaskModel.findByIdAndDelete.mockResolvedValue(null);

    const res = await dispatchDelete(validObjectId);

    expect(res.statusCode).toBe(404);
    expect(res._getJSONData()).toMatchObject({ error: "Not found" });
  });

  it("returns 400 for an invalid id", async () => {
    const res = await dispatchDelete("not-valid");

    expect(res.statusCode).toBe(400);
    expect(res._getJSONData()).toMatchObject({ error: "Invalid id" });
  });

  it("calls findByIdAndDelete with the correct id", async () => {
    mockTaskModel.findByIdAndDelete.mockResolvedValue(sampleTask);

    await dispatchDelete(validObjectId);

    expect(mockTaskModel.findByIdAndDelete).toHaveBeenCalledWith(validObjectId);
  });
});