import type { Request, Response, NextFunction } from 'express';
import { db } from './db.js';

// Resolves the active project from the X-Project-Id header (falls back to the
// first project). Stored on req.projectId for scoped queries.
export function resolveProject(req: Request, _res: Response, next: NextFunction) {
  const hdr = Number(req.header('X-Project-Id'));
  let pid = hdr;
  if (!pid || !db.prepare('SELECT 1 FROM projects WHERE id = ?').get(pid)) {
    const first = db.prepare('SELECT id FROM projects ORDER BY id LIMIT 1').get() as any;
    pid = first?.id ?? 1;
  }
  (req as any).projectId = pid;
  next();
}

export const projectId = (req: Request) => (req as any).projectId as number;
