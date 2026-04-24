import { Schema, model, models } from "mongoose";

export type TaskStatus = "todo" | "doing" | "done";

export type Task = {
  title: string;
  description?: string;
  status: TaskStatus;
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const taskSchema = new Schema<Task>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: false, trim: true },
    status: {
      type: String,
      required: true,
      enum: ["todo", "doing", "done"],
      default: "todo",
    },
    dueDate: { type: Date, required: false },
  },
  { timestamps: true },
);

export const TaskModel = models.Task ?? model<Task>("Task", taskSchema);

