import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import type { Env } from "./env";
import { healthRouter } from "./routes/health";

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

  return app;
}

