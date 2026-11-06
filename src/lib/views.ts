import "server-only";

/**
 * View counts, kept in a Redis-compatible REST store (Upstash / Vercel KV).
 * Without the environment variables the site still works; the dashboard then
 * says counting is off. Keys: views:total, views:photo (hash), views:day (hash).
 */
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

export const viewsEnabled = Boolean(url && token);

async function redis(...command: (string | number)[]): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`redis ${command[0]} → ${res.status}`);
  const data = (await res.json()) as { result?: unknown; error?: string };
  if (data.error) throw new Error(data.error);
  return data.result;
}

async function pipeline(commands: (string | number)[][]): Promise<unknown[]> {
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`redis pipeline → ${res.status}`);
  const data = (await res.json()) as { result?: unknown; error?: string }[];
  return data.map((d) => d.result);
}

export async function recordView(photoId: string): Promise<void> {
  if (!viewsEnabled) return;
  const day = new Date().toISOString().slice(0, 10);
  await pipeline([
    ["INCR", "views:total"],
    ["HINCRBY", "views:photo", photoId, 1],
    ["HINCRBY", "views:day", day, 1],
  ]);
}

export type Views = { total: number; byPhoto: Record<string, number>; byDay: Record<string, number> };

function toRecord(flat: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!Array.isArray(flat)) return out;
  for (let i = 0; i + 1 < flat.length; i += 2) out[String(flat[i])] = Number(flat[i + 1]);
  return out;
}

export async function getViews(): Promise<Views | null> {
  if (!viewsEnabled) return null;
  const [total, byPhoto, byDay] = await pipeline([
    ["GET", "views:total"],
    ["HGETALL", "views:photo"],
    ["HGETALL", "views:day"],
  ]);
  return { total: Number(total ?? 0), byPhoto: toRecord(byPhoto), byDay: toRecord(byDay) };
}

void redis;
