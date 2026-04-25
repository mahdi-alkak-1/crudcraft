import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Wraps an async Express handler and forwards rejected promises to `next()`.
 */
export function asyncHandler<
  Req extends Request = Request,
  Res extends Response = Response,
>(
  handler: (req: Req, res: Res, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(handler(req as Req, res as Res, next)).catch(next);
  };
}

