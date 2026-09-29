// Live data sources. Each source is fetched independently; a failure in one
// never hides values from another. The last valid value of every source is
// kept in browser storage so a temporary outage keeps showing real data,
// labelled with the time it was last confirmed.

import { readCache, writeCache } from "./cache";
import type { SeatRecord, Snapshot, SnapshotJob, SnapshotLaunch, SnapshotSite, SourceLabel, SourceState, SwarmFeed } from "./types";

export const API = "https://api.imd.fun";
export const EXPLORER = "https://explorer.imd.fun";

export interface ExplorerAgent {
  tokenId: string;
  online: boolean;
  owner: string | null;
  ownerName: string | null;
  held: number | null;
  attempts: number | null;
  accepted: number | null;
}

export interface SourceValue<T> {
  data: T | null;
  state: SourceState;
}

const RETRY_AFTER_FAILURE_MS = 5 * 60 * 1000;
const lastFailure = new Map<string, number>();

async function getJson<T>(url: string, timeoutMs = 10000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { accept: "application/json" }, signal: ctrl.signal, mode: "cors" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Fetches a source, persists it on success and falls back to the last valid
 * value on failure. Sources that fail (for example because the endpoint does
 * not allow browser requests yet) are retried every five minutes rather than
 * every tick, to keep the console quiet and the network polite.
 */
export async function loadSource<T>(key: string, url: string, label: SourceLabel, opts: { force?: boolean } = {}): Promise<SourceValue<T>> {
  const cached = readCache<T>(key);
  const failedAt = lastFailure.get(key) ?? 0;
  if (!opts.force && failedAt && Date.now() - failedAt < RETRY_AFTER_FAILURE_MS) {
    return { data: cached?.data ?? null, state: { label: cached ? label : "Snapshot", at: cached?.at ?? null, ok: false, note: "waiting to retry" } };
  }
  try {
    const data = await getJson<T>(url);
    lastFailure.delete(key);
    const v = writeCache(key, data);
    return { data, state: { label, at: v.at, ok: true, note: "" } };
  } catch {
    lastFailure.set(key, Date.now());
    return {
      data: cached?.data ?? null,
      state: { label: cached ? label : "Snapshot", at: cached?.at ?? null, ok: false, note: cached ? "showing last confirmed values" : "not reachable from this browser" },
    };
  }
}

export const fetchSwarm = (force = false) => loadSource<SwarmFeed>("swarm", `${API}/swarm`, "Live", { force });
export const fetchRecords = () => loadSource<{ count: number; seats: SeatRecord[] }>("records", `${API}/seats/records`, "Live");
export const fetchLaunches = () => loadSource<{ count: number; launches: SnapshotLaunch[] }>("launches", `${API}/launches?limit=500`, "Live");
export const fetchSites = () => loadSource<{ count: number; total: number; live: number; sites: SnapshotSite[] }>("sites", `${API}/sites`, "Live");
export const fetchJobs = () => loadSource<{ count: number; jobs: SnapshotJob[] }>("jobs", `${API}/jobs?limit=500`, "Live");
export const fetchExplorerAgent = (tokenId: string) => loadSource<ExplorerAgent>(`agent.${tokenId}`, `${EXPLORER}/api/agents/${tokenId}`, "Explorer");

declare global {
  interface Window {
    __SWARM_SNAPSHOT__?: Snapshot;
  }
}

export async function loadSnapshot(): Promise<Snapshot | null> {
  // A single-file build (used for offline review) inlines the snapshot as a global.
  if (window.__SWARM_SNAPSHOT__ && Array.isArray(window.__SWARM_SNAPSHOT__.jobs)) return window.__SWARM_SNAPSHOT__;
  try {
    const r = await fetch("./data/snapshot.json", { cache: "default" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()) as Snapshot;
  } catch {
    return null;
  }
}

/** Age label for a timestamp, kept short for cards and badges. */
export function ago(iso: string | number | null | undefined, now = Date.now()): string {
  if (iso === null || iso === undefined) return "unknown";
  const t = typeof iso === "number" ? iso : Date.parse(iso);
  if (!Number.isFinite(t)) return "unknown";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 45) return `${d} d ago`;
  const mo = Math.round(d / 30);
  return `${mo} mo ago`;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "unknown";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "unknown";
  return new Date(t).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function shortAddr(a: string | null | undefined): string {
  if (!a) return "unknown";
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

export function shortHash(h: string | null | undefined): string {
  if (!h) return "unknown";
  return h.length > 14 ? `${h.slice(0, 8)}…${h.slice(-4)}` : h;
}
