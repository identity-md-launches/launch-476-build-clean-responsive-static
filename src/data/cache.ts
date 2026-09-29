// Browser-local persistence: last valid values per source, the watchlist and
// the daily history used for "since yesterday". Nothing leaves the browser.

const PREFIX = "swarmalpha.v1.";

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(PREFIX + key, value);
  } catch {
    // storage full or unavailable: live values still render, they are just not persisted
  }
}

export interface CachedValue<T> {
  at: string;
  data: T;
}

export function readCache<T>(key: string): CachedValue<T> | null {
  const raw = safeGet("cache." + key);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as CachedValue<T>;
    return v && typeof v.at === "string" ? v : null;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, data: T): CachedValue<T> {
  const v = { at: new Date().toISOString(), data };
  safeSet("cache." + key, JSON.stringify(v, (_k, val) => (typeof val === "bigint" ? "0x" + val.toString(16) : val)));
  return v;
}

// ---------- watchlist ----------

const WATCH_KEY = "watchlist";
const listeners = new Set<() => void>();
let watchCache: string[] | null = null;

export function getWatchlist(): string[] {
  if (watchCache) return watchCache;
  const raw = safeGet(WATCH_KEY);
  try {
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    watchCache = Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    watchCache = [];
  }
  return watchCache;
}

export function toggleWatch(id: string): void {
  const cur = getWatchlist();
  watchCache = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  safeSet(WATCH_KEY, JSON.stringify(watchCache));
  listeners.forEach((l) => l());
}

export function subscribeWatchlist(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

// ---------- daily history for "since yesterday" ----------

export interface DayRecord {
  date: string;
  projects: Record<string, { verdict: string; status: string }>;
  health: { agentsOnline: number; seatsEnrolled: number; sites: number; launchesLive: number } | null;
}

const DAYS_KEY = "days";

export function readDays(): DayRecord[] {
  const raw = safeGet(DAYS_KEY);
  try {
    const arr = raw ? (JSON.parse(raw) as DayRecord[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function recordToday(rec: Omit<DayRecord, "date">): { today: DayRecord; previous: DayRecord | null } {
  const date = new Date().toISOString().slice(0, 10);
  const days = readDays().filter((d) => d.date !== date);
  const previous = days.length ? days[days.length - 1] : null;
  const today: DayRecord = { date, ...rec };
  const next = [...days, today].slice(-4);
  safeSet(DAYS_KEY, JSON.stringify(next));
  return { today, previous };
}
