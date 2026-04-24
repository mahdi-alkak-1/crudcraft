import { Router } from "express";
import { z } from "zod";
import { isValidObjectId } from "mongoose";

import { TaskModel } from "../models/task";

const createTaskSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  status: z.enum(["todo", "doing", "done"]).optional(),
  dueDate: z.coerce.date().optional(),
});

export const tasksRouter = Router();

const listTasksQuerySchema = z.object({
  status: z.enum(["todo", "doing", "done"]).optional(),
  q: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// GET /api/tasks
tasksRouter.get("/", async (req, res) => {
  const parsed = listTasksQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid query", details: parsed.error.flatten() });
  }

  const { status, q, limit, offset } = parsed.data;
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (q) {
    filter.$or = [
      { title: { $regex: q, $options: "i" } },
      { description: { $regex: q, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    TaskModel.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit),
    TaskModel.countDocuments(filter),
  ]);

  return res.json({ items, total, limit, offset });
});

// POST /api/tasks
tasksRouter.post("/", async (req, res) => {
  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid body", details: parsed.error.flatten() });
  }

  const created = await TaskModel.create(parsed.data);
  return res.status(201).json(created);
});

// GET /api/tasks/:id
tasksRouter.get("/:id", async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  const found = await TaskModel.findById(id);
  if (!found) return res.status(404).json({ error: "Not found" });
  return res.json(found);
});
