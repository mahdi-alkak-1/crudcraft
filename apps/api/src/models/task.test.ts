import { describe, it, expect } from "vitest";
import { Schema } from "mongoose";

// Test the TypeScript types and schema structure by importing the module
// We test schema validation logic without a live database connection
// by inspecting the exported types and schema definitions.

describe("Task model types", () => {
  it("TaskStatus type covers all valid values", () => {
    // Compile-time check: these assignments must be valid TaskStatus values
    const statuses: import("./task").TaskStatus[] = ["todo", "doing", "done"];
    expect(statuses).toHaveLength(3);
    expect(statuses).toContain("todo");
    expect(statuses).toContain("doing");
    expect(statuses).toContain("done");
  });

  it("TaskModel is defined and exported", async () => {
    // Dynamically import to avoid top-level mongoose connection requirement
    // The model export uses 'models.Task ?? model(...)' pattern (idempotent registration)
    const { TaskModel } = await import("./task");
    expect(TaskModel).toBeDefined();
  });

  it("TaskModel has the correct model name", async () => {
    const { TaskModel } = await import("./task");
    expect(TaskModel.modelName).toBe("Task");
  });

  it("TaskModel schema has required title field", async () => {
    const { TaskModel } = await import("./task");
    const titlePath = TaskModel.schema.path("title");
    expect(titlePath).toBeDefined();
    expect((titlePath as Schema.Types.String).isRequired).toBe(true);
  });

  it("TaskModel schema has optional description field", async () => {
    const { TaskModel } = await import("./task");
    const descPath = TaskModel.schema.path("description");
    expect(descPath).toBeDefined();
    // description is not required
    expect((descPath as Schema.Types.String).isRequired).toBeFalsy();
  });

  it("TaskModel schema has status field with correct enum values", async () => {
    const { TaskModel } = await import("./task");
    const statusPath = TaskModel.schema.path("status");
    expect(statusPath).toBeDefined();
    const enumValues = (statusPath as Schema.Types.String).enumValues;
    expect(enumValues).toContain("todo");
    expect(enumValues).toContain("doing");
    expect(enumValues).toContain("done");
    expect(enumValues).toHaveLength(3);
  });

  it("TaskModel schema has status defaulting to 'todo'", async () => {
    const { TaskModel } = await import("./task");
    const statusPath = TaskModel.schema.path("status");
    expect((statusPath as Schema.Types.String).defaultValue).toBe("todo");
  });

  it("TaskModel schema has optional dueDate field", async () => {
    const { TaskModel } = await import("./task");
    const dueDatePath = TaskModel.schema.path("dueDate");
    expect(dueDatePath).toBeDefined();
    expect((dueDatePath as Schema.Types.Date).isRequired).toBeFalsy();
  });

  it("TaskModel schema has timestamps enabled (createdAt and updatedAt)", async () => {
    const { TaskModel } = await import("./task");
    // When timestamps: true, Mongoose adds createdAt and updatedAt paths
    const createdAtPath = TaskModel.schema.path("createdAt");
    const updatedAtPath = TaskModel.schema.path("updatedAt");
    expect(createdAtPath).toBeDefined();
    expect(updatedAtPath).toBeDefined();
  });

  it("re-importing TaskModel returns the same model instance (idempotent)", async () => {
    const { TaskModel: model1 } = await import("./task");
    const { TaskModel: model2 } = await import("./task");
    // Both imports should refer to the same cached module export
    expect(model1).toBe(model2);
  });
});