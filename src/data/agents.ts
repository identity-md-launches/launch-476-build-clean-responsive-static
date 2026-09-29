// Agent (seat) cards: one compact record per identity.md seat, merged field by
// field from the snapshot, the live swarm feed, seat records and the explorer.

import type { ExplorerAgent } from "./sources";
import type { SeatRecord, SnapshotAgent, SourceLabel, SwarmSeat } from "./types";

export interface AgentCard {
  tokenId: string;
  agentId: string | null;
  status: string; // "working" | "online" | "active" | "offline" | "unknown"
  statusSource: SourceLabel;
  attempts: number | null;
  accepted: number | null;
  rejected: number | null;
  failed: number | null;
  pending: number | null;
  acceptanceRate: number | null; // 0..1
  workSource: SourceLabel;
  lastWorkedAt: string | null;
  runtime: string | null;
  runtimeSource: SourceLabel;
  pairedAt: string | null;
  owner: string | null;
  ownerName: string | null;
  held: number | null;
  daemonVersion: string | null;
}

export interface AgentInputs {
  snapshot: Record<string, SnapshotAgent>;
  records: SeatRecord[] | null;
  recordsLive: boolean;
  swarmSeats: Record<string, SwarmSeat> | null;
  swarmLive: boolean;
  explorer: Record<string, ExplorerAgent | null>;
}

export function buildAgentCard(tokenId: string, inputs: AgentInputs): AgentCard {
  const snap = inputs.snapshot[tokenId] ?? null;
  const rec = inputs.records?.find((r) => r.tokenId === tokenId) ?? null;
  const seat = inputs.swarmSeats?.[tokenId] ?? null;
  const ex = inputs.explorer[tokenId] ?? null;

  // Work counters: live swarm feed first, then seat records, then snapshot.
  let attempts: number | null = null;
  let accepted: number | null = null;
  let rejected: number | null = null;
  let failed: number | null = null;
  let pending: number | null = null;
  let workSource: SourceLabel = "Snapshot";
  if (seat && inputs.swarmLive) {
    ({ attempts, accepted, rejected, failed, pending } = seat);
    workSource = "Live";
  } else if (rec && inputs.recordsLive) {
    ({ attempts, accepted, rejected, failed, pending } = rec);
    workSource = "Live";
  } else if (ex) {
    attempts = ex.attempts;
    accepted = ex.accepted;
    workSource = "Explorer";
  }
  if (attempts === null && (snap?.attempts !== null && snap?.attempts !== undefined)) {
    attempts = snap.attempts;
    accepted = snap.accepted;
    rejected = snap.rejected;
    failed = snap.failed;
    pending = snap.pending;
    workSource = "Snapshot";
  } else if (attempts === null && rec) {
    ({ attempts, accepted, rejected, failed, pending } = rec);
    workSource = "Snapshot";
  } else if (attempts === null && seat) {
    ({ attempts, accepted, rejected, failed, pending } = seat);
    workSource = "Snapshot";
  }

  // Status: working (live) > online (explorer/live) > active (snapshot) > offline.
  let status = "unknown";
  let statusSource: SourceLabel = "Snapshot";
  if (seat && inputs.swarmLive) {
    status = seat.working ? "working" : "enrolled";
    statusSource = "Live";
  }
  if (ex) {
    status = seat?.working && inputs.swarmLive ? "working" : ex.online ? "online" : "offline";
    statusSource = "Explorer";
  } else if (status === "unknown" && snap) {
    status = snap.online ? "online" : snap.status ?? "unknown";
    statusSource = "Snapshot";
  }

  const lastWorkedAt = (inputs.swarmLive && seat?.last) || rec?.lastWorkedAt || seat?.last || null;
  const runtime = snap?.runtime ? [snap.runtime.id, snap.runtime.model].filter(Boolean).join(" · ") : null;

  return {
    tokenId,
    agentId: seat?.agentId ?? rec?.agentId ?? snap?.agentId ?? null,
    status,
    statusSource,
    attempts,
    accepted,
    rejected,
    failed,
    pending,
    acceptanceRate: attempts && accepted !== null ? accepted / attempts : null,
    workSource,
    lastWorkedAt,
    runtime,
    runtimeSource: "Snapshot",
    pairedAt: snap?.pairedAt ?? null,
    owner: ex?.owner ?? snap?.owner ?? null,
    ownerName: ex?.ownerName ?? snap?.ownerName ?? null,
    held: ex?.held ?? snap?.held ?? null,
    daemonVersion: snap?.daemonVersion ?? null,
  };
}
