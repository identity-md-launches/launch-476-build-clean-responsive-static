import { useSyncExternalStore } from "react";
import { getWatchlist, subscribeWatchlist, toggleWatch } from "../data/cache";

export function useWatchlist(): string[] {
  return useSyncExternalStore(subscribeWatchlist, getWatchlist, getWatchlist);
}

export function WatchButton({ id, name, small = false }: { id: string; name: string; small?: boolean }) {
  const list = useWatchlist();
  const on = list.includes(id);
  return (
    <button
      type="button"
      className={`btn ${small ? "btn-sm" : ""}`}
      aria-pressed={on}
      aria-label={on ? `Unwatch ${name}` : `Watch ${name}`}
      onClick={() => toggleWatch(id)}
    >
      <span aria-hidden="true">{on ? "★" : "☆"}</span>
      {on ? "Watching" : "Watch"}
    </button>
  );
}
