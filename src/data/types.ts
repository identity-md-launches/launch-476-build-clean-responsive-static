// Shared types for the snapshot file, live sources and the assembled project model.

export type Verdict = "VERIFIED" | "PROMISING" | "SPECULATIVE" | "HIGH RISK" | "UNVERIFIED";
export type Confidence = "High" | "Medium" | "Low";
export type PromiseStatus = "Delivered" | "Partial" | "Pending" | "Broken" | "Unverified";
export type SourceLabel = "Live" | "Explorer" | "Onchain" | "Snapshot" | "Research";
export type FilterKey = "all" | "verified" | "promising" | "speculative" | "risk" | "unverified";
export type ProjectKind =
  | "Contracts"
  | "Uniswap v4 hook"
  | "Website"
  | "Research"
  | "Media"
  | "Audit"
  | "Indexer"
  | "Tooling"
  | "Strategy token"
  | "Other";

// ---------- snapshot shapes (mirrors scripts/snapshot.mjs) ----------

export interface SnapshotNode {
  key: string;
  role: string;
  state: string;
  attempt: number | null;
  revisions: number | null;
  seat: string | null;
  agentId: string | null;
  verdict: { status: string; evaluation: string | null; at: string | null; verifier: string | null } | null;
  note: string | null;
  failure: string | null;
}

export interface SnapshotReviewEntry {
  nodeKey: string;
  agentId: string;
  role: string;
  value: number;
}

export interface SnapshotReview {
  status: string;
  chainId: number | null;
  txHash: string | null;
  sentAt: string | null;
  entries: SnapshotReviewEntry[];
}

export interface SnapshotSite {
  id: string;
  jobId: string;
  url: string;
  status: string;
  holdReason: string | null;
  takenDownAt: string | null;
  takenDownReason: string | null;
  label: string;
  cid: string | null;
  bytes: number | null;
  ensName: string | null;
  txHash: string | null;
  blockNumber: number | null;
  failure: string | null;
  pinnedAt: string | null;
  namedAt: string | null;
  supersededBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotLaunchArtifact {
  role: string;
  name: string;
  address: string;
  txHash: string | null;
  blockNumber: number | null;
}

export interface SnapshotLaunch {
  id: string;
  launchNumber: number;
  kind: string;
  status: string;
  chainId: number;
  sourceRepoUrl: string | null;
  sourceCommit: string | null;
  parkedReason: string | null;
  artifacts: SnapshotLaunchArtifact[];
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotJob {
  id: string;
  state: string;
  template: string;
  objective: string;
  detailed?: boolean;
  blockedReason: string | null;
  createdAt: string;
  updatedAt: string;
  paidBy: string | null;
  parentJobId: string | null;
  projectId: string;
  projectHead: string;
  workflowId: string | null;
  host: boolean;
  delivery: { repoUrl: string | null; pullRequestUrl: string | null; commit: string | null; deliveredAt: string | null } | null;
  launchId: string | null;
  launchStatus: string | null;
  launchChainId: number | null;
  site: SnapshotSite | null;
  siteId?: string | null;
  nodes: SnapshotNode[];
  reviews: SnapshotReview[];
}

export interface SnapshotWorkflowStage {
  id: string;
  state: string | null;
  failure: string | null;
  repoUrl: string | null;
  commit: string | null;
}

export interface SnapshotWorkflow {
  id: string;
  objective: string;
  status: string;
  failure: string | null;
  chainId: number | null;
  createdAt: string;
  updatedAt: string;
  contracts: SnapshotWorkflowStage | null;
  frontend: SnapshotWorkflowStage | null;
  launchId: string | null;
  launchStatus: string | null;
  site: SnapshotSite | null;
}

export interface SnapshotAgent {
  tokenId: string;
  agentId: string | null;
  status: string | null;
  owner: string | null;
  ownerName: string | null;
  ownership: string | null;
  pairedAt: string | null;
  online: boolean | null;
  daemonVersion: string | null;
  runtime: { id: string; version: string | null; model: string | null } | null;
  devices: number | null;
  held: number | null;
  attempts: number | null;
  accepted: number | null;
  rejected: number | null;
  failed: number | null;
  pending: number | null;
  collaboratorJobs: number | null;
}

export interface SeatRecord {
  tokenId: string;
  agentId: string | null;
  attempts: number;
  accepted: number;
  rejected: number;
  failed: number;
  pending: number;
  lastWorkedAt: string | null;
}

export interface SwarmHealth {
  reachable: boolean;
  agentsOnline: number;
  workingNow: number;
  acceptedLastDay: number;
  jobsDoneLastDay: number;
  oraclesDoneLastDay: number;
  seatsEnrolled: number;
  verifierUp: boolean;
  publisherUp: boolean;
  deployerUp: boolean;
}

export interface SwarmCounts {
  jobs: number;
  jobStates: Record<string, number>;
  tasksInProgress: number;
  launchesLive: number;
  sites: number;
  inferenceTokens: number;
}

export interface SwarmSeat {
  tokenId: number;
  agentId: string;
  attempts: number;
  accepted: number;
  rejected: number;
  failed: number;
  pending: number;
  last: string | null;
  working: boolean;
  queued: number;
}

export interface SwarmEvent {
  kind: string;
  at: string;
  tokenId?: number;
  state?: string;
  jobId?: string;
  objective?: string;
  step?: string;
  role?: string;
}

/** Shape of https://api.imd.fun/swarm (the one endpoint that answers cross-origin). */
export interface SwarmFeed {
  at: number;
  health: SwarmHealth;
  counts: SwarmCounts;
  seats: Record<string, SwarmSeat>;
  events: SwarmEvent[];
  owners: string[];
  chain: { chainId: number; collection: string };
}

export interface SnapshotSwarm {
  at: number;
  health: SwarmHealth;
  counts: SwarmCounts;
  chain: { chainId: number; collection: string };
  hiveSeats: number[];
  distinctOwners: number;
}

export interface Snapshot {
  generatedAt: string;
  sources: Record<string, string>;
  jobs: SnapshotJob[];
  workflows: SnapshotWorkflow[];
  launches: SnapshotLaunch[];
  sites: SnapshotSite[];
  agents: Record<string, SnapshotAgent>;
  records: SeatRecord[];
  swarm: SnapshotSwarm | null;
}

// ---------- assembled model ----------

export type EvidenceKind = "site" | "ipfs" | "github" | "explorer" | "contract" | "tx" | "api" | "research" | "agent" | "web";

export interface EvidenceLink {
  label: string;
  url: string;
  kind: EvidenceKind;
}

export interface PromiseRow {
  promise: string;
  status: PromiseStatus;
  evidence: EvidenceLink[];
  lastChecked: string | null;
  source: SourceLabel;
  note?: string;
}

export interface RiskItem {
  severity: "critical" | "warning" | "info";
  text: string;
  evidence?: EvidenceLink[];
  source: SourceLabel;
}

export interface Scores {
  product: number | null;
  trust: number | null;
  traction: number | null;
  reasons: { product: string[]; trust: string[]; traction: string[] };
}

export type AgentRole = "Builder" | "Reviewer" | "Verifier" | "Publisher";

export interface ProjectAgent {
  tokenId: string;
  role: AgentRole;
  detail: string;
}

export interface FactRow {
  label: string;
  value: string;
  source: SourceLabel;
  kind: "fact" | "calculation" | "claim";
  evidence?: EvidenceLink[];
  note?: string;
}

export interface Project {
  id: string;
  name: string;
  purpose: string;
  kind: ProjectKind;
  status: string;
  statusText: string;
  createdAt: string;
  updatedAt: string;
  lastChecked: string;
  verdict: Verdict;
  confidence: Confidence;
  scores: Scores;
  promises: PromiseRow[];
  works: string[];
  missing: string[];
  risks: RiskItem[];
  evidence: EvidenceLink[];
  agents: ProjectAgent[];
  builder: string;
  chainId: number | null;
  launch: SnapshotLaunch | null;
  sites: SnapshotSite[];
  jobs: SnapshotJob[];
  workflow: SnapshotWorkflow | null;
  paidBy: string | null;
  sources: SourceLabel[];
  facts: FactRow[];
  featured: boolean;
  searchText: string;
}

export interface SourceState {
  label: SourceLabel;
  at: string | null;
  ok: boolean;
  note: string;
}
