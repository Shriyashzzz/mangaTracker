// The reader's own address, for the per-visitor limits and budgets.
// Requests reach us through Cloudflare, then Railway's proxy, so Express's
// req.ip is the Cloudflare edge that passed it on: shared by everyone near
// that edge. Cloudflare names the reader in CF-Connecting-IP (it overwrites
// any such header a visitor sends). Without it (a local run, the tests),
// req.ip. (Someone reaching Railway directly, around Cloudflare, could set
// the header themselves; that only moves which bucket they count in)
import type { Request } from "express";

const ADDRESS = /^[0-9a-f:.]{3,45}$/i;

export function clientIp(req: Request): string {
  const header = req.headers?.["cf-connecting-ip"];
  const named = (Array.isArray(header) ? header[0] : header)?.trim();
  if (named && ADDRESS.test(named)) return named;
  return req.ip ?? "unknown";
}
