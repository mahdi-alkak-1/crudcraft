import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import type { NextFunction, Request, Response } from "express";
import type { Env } from "./env";
import { healthRouter } from "./routes/health";
import { tasksRouter } from "./routes/tasks";

/**
 * Creates the Express application with routes and middleware wired up.
 */
export function createApp(env: Env) {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
    }),
  );
  app.use(express.json());
  app.use(morgan("dev"));

  app.get("/", (_req, res) => res.json({ name: "CrudCraft API" }));
  app.use("/api/health", healthRouter);
  app.use("/api/tasks", tasksRouter);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    // Keep the response generic; details can be found in server logs.
    console.error(err);
    if (res.headersSent) return;
    res.status(500).json({ error: "Internal Server Error" });
  });

  return app;
}
