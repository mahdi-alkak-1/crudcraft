import { Router } from "express";
import { z } from "zod";

import { TaskModel } from "../models/task";

const createTaskSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  status: z.enum(["todo", "doing", "done"]).optional(),
  dueDate: z.coerce.date().optional(),
});

export const tasksRouter = Router();

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
