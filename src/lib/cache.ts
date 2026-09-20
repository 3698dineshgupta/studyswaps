/**
 * Tiny in-memory TTL cache (per server instance) for data that is read on nearly every page load but changes rarely.
 * Never use it for anything money- or permission-critical.
 */
const store = new Map<string, { v: unknown; exp: number }>()

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key)
  if (hit && hit.exp > Date.now()) return hit.v as T
  const v = await load()
  if (store.size > 5000) for (const [k, e] of Array.from(store)) if (e.exp <= Date.now()) store.delete(k)
  store.set(key, { v, exp: Date.now() + ttlMs })
  return v
}

export function forget(key: string) { store.delete(key) }
