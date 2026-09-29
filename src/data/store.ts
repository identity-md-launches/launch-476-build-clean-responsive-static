// One store for the whole dashboard: loads the snapshot, polls live sources
// every 10 seconds while the tab is visible, and assembles the project model.

import { useEffect, useMemo, useRef, useState } from "react";
import { buildAgentCard, type AgentCard, type AgentInputs } from "./agents";
import { recordToday, type DayRecord } from "./cache";
import { HIVE, cachedHive, readHiveEth, readHiveEthLogs, readHiveRh, readHiveRhLogs, type HiveOnchain } from "./hive";
import { buildHiveProject } from "./hiveProject";
import { assembleProjects, type LiveOverlay } from "./projects";
import { fetchExplorerAgent, fetchJobs, fetchLaunches, fetchRecords, fetchSites, fetchSwarm, loadSnapshot, type ExplorerAgent } from "./sources";
import type { Project, SeatRecord, Snapshot, SnapshotJob, SnapshotLaunch, SnapshotSite, SourceState, SwarmFeed } from "./types";

export const REFRESH_MS = 10_000;
const LOG_SCAN_EVERY = 6; // ticks → once a minute
const EXPLORER_EVERY = 30; // ticks → every five minutes

export interface LiveState {
  swarm: { data: SwarmFeed | null; state: SourceState };
  records: { data: SeatRecord[] | null; state: SourceState };
  launches: { data: SnapshotLaunch[] | null; state: SourceState };
  sites: { data: SnapshotSite[] | null; state: SourceState };
  jobs: { data: SnapshotJob[] | null; state: SourceState };
  explorer: Record<string, ExplorerAgent | null>;
  explorerState: SourceState;
}

const idle = (label: SourceState["label"]): SourceState => ({ label, at: null, ok: false, note: "not loaded yet" });

const initialLive: LiveState = {
  swarm: { data: null, state: idle("Live") },
  records: { data: null, state: idle("Live") },
  launches: { data: null, state: idle("Live") },
  sites: { data: null, state: idle("Live") },
  jobs: { data: null, state: idle("Live") },
  explorer: {},
  explorerState: idle("Explorer"),
};

export interface Dashboard {
  ready: boolean;
  snapshot: Snapshot | null;
  live: LiveState;
  hive: HiveOnchain;
  projects: Project[];
  agentCard: (tokenId: string) => AgentCard;
  agentIds: string[];
  tick: number;
  lastRefresh: string | null;
  history: { today: DayRecord; previous: DayRecord | null } | null;
  refreshNow: () => void;
}

/** Seats we ask the explorer about: HIVE seats plus the busiest builders. */
function explorerTargets(snapshot: Snapshot | null, swarm: SwarmFeed | null): string[] {
  const ids = new Set<string>();
  for (const id of snapshot?.swarm?.hiveSeats ?? []) ids.add(String(id));
  const keeper = HIVE.keeper.toLowerCase();
  if (swarm) swarm.owners.forEach((o, i) => { if (o && o.toLowerCase() === keeper) ids.add(String(i)); });
  const top = Object.values(snapshot?.agents ?? {})
    .sort((a, b) => (b.accepted ?? 0) - (a.accepted ?? 0))
    .slice(0, 12);
  for (const a of top) ids.add(a.tokenId);
  return [...ids];
}

export function useDashboard(): Dashboard {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [ready, setReady] = useState(false);
  const [live, setLive] = useState<LiveState>(initialLive);
  const [hive, setHive] = useState<HiveOnchain>(() => cachedHive());
  const [tick, setTick] = useState(0);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const tickRef = useRef(0);
  const busy = useRef(false);
  const forceRef = useRef(false);

  useEffect(() => {
    let alive = true;
    loadSnapshot().then((s) => {
      if (!alive) return;
      setSnapshot(s);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    let alive = true;

    const refresh = async () => {
      if (busy.current || document.visibilityState === "hidden") return;
      busy.current = true;
      const n = tickRef.current++;
      const force = forceRef.current;
      forceRef.current = false;
      try {
        const [swarm, records, launches, sites, jobs, eth, rh] = await Promise.all([
          fetchSwarm(force),
          fetchRecords(),
          fetchLaunches(),
          fetchSites(),
          fetchJobs(),
          readHiveEth(),
          readHiveRh(),
        ]);
        if (!alive) return;
        setLive((prev) => ({
          ...prev,
          swarm: { data: swarm.data ?? prev.swarm.data, state: swarm.state },
          records: { data: records.data?.seats ?? prev.records.data, state: records.state },
          launches: { data: launches.data?.launches ?? prev.launches.data, state: launches.state },
          sites: { data: sites.data?.sites ?? prev.sites.data, state: sites.state },
          jobs: { data: jobs.data?.jobs ?? prev.jobs.data, state: jobs.state },
        }));
        setHive((prev) => ({ ...prev, eth: eth.data ? eth : prev.eth, rh: rh.data ? rh : prev.rh }));

        if (n % LOG_SCAN_EVERY === 0 || force) {
          const [ethLogs, rhLogs] = await Promise.all([readHiveEthLogs(eth.data?.block ?? null), readHiveRhLogs(rh.data?.block ?? null)]);
          if (!alive) return;
          setHive((prev) => ({ ...prev, ethLogs: ethLogs.data ? ethLogs : prev.ethLogs, rhLogs: rhLogs.data ? rhLogs : prev.rhLogs }));
        }
        if (n % EXPLORER_EVERY === 0 || force) {
          const targets = explorerTargets(snapshot, swarm.data);
          const results = await Promise.all(targets.map((id) => fetchExplorerAgent(id)));
          if (!alive) return;
          const explorer: Record<string, ExplorerAgent | null> = {};
          let okState: SourceState | null = null;
          results.forEach((r, i) => {
            explorer[targets[i]] = r.data;
            if (r.state.ok) okState = r.state;
          });
          setLive((prev) => ({ ...prev, explorer: { ...prev.explorer, ...explorer }, explorerState: okState ?? results[0]?.state ?? prev.explorerState }));
        }
        setLastRefresh(new Date().toISOString());
        setTick((t) => t + 1);
      } finally {
        busy.current = false;
      }
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ready, snapshot]);

  const projects = useMemo<Project[]>(() => {
    if (!snapshot) return [];
    const overlay: LiveOverlay = {
      launches: live.launches.data,
      sites: live.sites.data,
      jobs: live.jobs.data,
      records: live.records.data,
      launchesLive: live.launches.state.ok,
      sitesLive: live.sites.state.ok,
      jobsLive: live.jobs.state.ok,
    };
    const generic = assembleProjects(snapshot, overlay);
    const hiveProject = buildHiveProject({
      onchain: hive,
      swarm: live.swarm.data,
      swarmLive: live.swarm.state.ok,
      swarmSnapshot: snapshot.swarm,
      records: live.records.data ?? snapshot.records,
      recordsLive: live.records.state.ok,
      now: Date.now(),
    });
    return [hiveProject, ...generic];
  }, [snapshot, live, hive]);

  const agentInputs = useMemo<AgentInputs>(
    () => ({
      snapshot: snapshot?.agents ?? {},
      records: live.records.data ?? snapshot?.records ?? null,
      recordsLive: live.records.state.ok,
      swarmSeats: live.swarm.data?.seats ?? null,
      swarmLive: live.swarm.state.ok,
      explorer: live.explorer,
    }),
    [snapshot, live],
  );
  const agentCard = useMemo(() => {
    const memo = new Map<string, AgentCard>();
    return (tokenId: string) => {
      let c = memo.get(tokenId);
      if (!c) {
        c = buildAgentCard(tokenId, agentInputs);
        memo.set(tokenId, c);
      }
      return c;
    };
  }, [agentInputs]);

  const agentIds = useMemo(() => {
    const ids = new Set<string>(Object.keys(snapshot?.agents ?? {}));
    for (const r of live.records.data ?? []) ids.add(r.tokenId);
    for (const k of Object.keys(live.swarm.data?.seats ?? {})) ids.add(k);
    return [...ids];
  }, [snapshot, live]);

  // Daily history, written once per data change so "since yesterday" has something to compare with.
  const history = useMemo(() => {
    if (!ready || !projects.length) return null;
    const rec: Record<string, { verdict: string; status: string }> = {};
    for (const p of projects) rec[p.id] = { verdict: p.verdict, status: p.status };
    const h = live.swarm.data?.health ?? snapshot?.swarm?.health ?? null;
    const c = live.swarm.data?.counts ?? snapshot?.swarm?.counts ?? null;
    return recordToday({
      projects: rec,
      health: h && c ? { agentsOnline: h.agentsOnline, seatsEnrolled: h.seatsEnrolled, sites: c.sites, launchesLive: c.launchesLive } : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, projects.length, live.swarm.state.at]);

  return {
    ready,
    snapshot,
    live,
    hive,
    projects,
    agentCard,
    agentIds,
    tick,
    lastRefresh,
    history,
    refreshNow: () => {
      forceRef.current = true;
    },
  };
}
