import { Router } from "express";

/**
 * Simple health check endpoint router.
 */
export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({ ok: true });
});
