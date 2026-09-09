import type { NextFunction, Request, Response } from "express";
import { getSupabaseUser, type SupabaseUser } from "./supabaseAuth";

declare global {
  namespace Express {
    interface Request {
      authUser?: SupabaseUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authorization = req.headers.authorization ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return res.status(401).json({ message: "Authentication is required." });

  try {
    const user = await getSupabaseUser(token);
    if (!user?.id) return res.status(401).json({ message: "Your session is invalid or expired." });
    req.authUser = user;
    return next();
  } catch (error) {
    console.error("[auth] failed to validate session", error instanceof Error ? error.message : error);
    return res.status(503).json({ message: "Authentication service is temporarily unavailable." });
  }
}