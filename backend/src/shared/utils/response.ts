import type { Response } from 'express';

/** The success envelope from api_contract.md. */
export function ok<T>(res: Response, data: T, meta?: Record<string, unknown>): void {
  res.status(200).json({ success: true, data, ...(meta ? { meta } : {}) });
}

export function created<T>(res: Response, data: T): void {
  res.status(201).json({ success: true, data });
}

export function paginated<T>(res: Response, items: T[], nextCursor: string | null): void {
  res.status(200).json({ success: true, data: items, meta: { nextCursor } });
}
