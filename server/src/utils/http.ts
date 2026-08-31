import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function asyncHandler<T extends (req: Request, res: Response, next: NextFunction) => Promise<unknown>>(fn: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ success: false, message: "Route not found" });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: err.issues.map((i) => `${i.path.join(".") || "field"}: ${i.message}`).join(", "),
    });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ success: false, message: err.message });
  }
  const message = err instanceof Error ? err.message : "Unexpected server error";
  console.error("[error]", message);
  return res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
}
