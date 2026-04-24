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

// PATCH /api/tasks/:id
tasksRouter.patch("/:id", async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  const parsed = updateTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid body", details: parsed.error.flatten() });
  }

  const $set: Record<string, unknown> = {};
  const $unset: Record<string, 1> = {};

  if (parsed.data.title !== undefined) $set.title = parsed.data.title;
  if (parsed.data.status !== undefined) $set.status = parsed.data.status;

  if (parsed.data.description !== undefined) {
    if (parsed.data.description === null) $unset.description = 1;
    else $set.description = parsed.data.description;
  }

  if (parsed.data.dueDate !== undefined) {
    if (parsed.data.dueDate === null) $unset.dueDate = 1;
    else $set.dueDate = parsed.data.dueDate;
  }

  const update: Record<string, unknown> = {};
  if (Object.keys($set).length > 0) update.$set = $set;
  if (Object.keys($unset).length > 0) update.$unset = $unset;

  const updated = await TaskModel.findByIdAndUpdate(id, update, {
    new: true,
    runValidators: true,
    timestamps: true,
  });

  if (!updated) return res.status(404).json({ error: "Not found" });
  return res.json(updated);
});
