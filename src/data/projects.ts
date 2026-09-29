// Turns raw IdentityMD records (jobs, workflows, launches, sites) into the
// project model the pages render. All derivations are deterministic and the
// rules behind every score are listed in scoring.ts.

import { addressUrl, chainName, explorerJobUrl, ipfsUrl, isTestnet, txUrl } from "./chains";
import { computeConfidence, computeScores, computeVerdict, type Signal } from "./scoring";
import type {
  EvidenceLink,
  Project,
  ProjectAgent,
  ProjectKind,
  PromiseRow,
  RiskItem,
  SeatRecord,
  Snapshot,
  SnapshotJob,
  SnapshotLaunch,
  SnapshotSite,
  SnapshotWorkflow,
  SourceLabel,
} from "./types";

export interface LiveOverlay {
  launches: SnapshotLaunch[] | null;
  sites: SnapshotSite[] | null;
  jobs: SnapshotJob[] | null;
  records: SeatRecord[] | null;
  launchesLive: boolean;
  sitesLive: boolean;
  jobsLive: boolean;
}

const DAY = 86_400_000;

export function humanKey(key: string): string {
  return key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function deriveName(objective: string, fallback: string): string {
  // A quoted, capitalised name near the start of the request wins ("Pepe Panels", “SWARM ALPHA”).
  const called = objective.match(/\b(?:called|named|titled)\s+[“"]?([A-Z][^\n.,“”"]{1,40})/);
  if (called) return called[1].trim();
  const quoted = objective.slice(0, 400).match(/[“"]([A-Z$][^”"\n]{1,47})[”"]/);
  if (quoted) return quoted[1].trim();
  const sentences = objective
    .replace(/^\s*original request:\s*/i, "")
    .split(/\n|(?<=[a-z0-9)])\.\s/)
    .map((s) => s.trim())
    .filter(Boolean);
  // Skip sentences that are only a URL, an address, a hash or a two-word instruction.
  let first = sentences.find((s) => !/^(https?:\/\/|0x[0-9a-f]{6,}|[a-f0-9]{40,})/i.test(s) && /[a-zA-Z]{3,}/.test(s) && s.split(/\s+/).length >= 3) ?? "";
  first = first.replace(/^(please\s+)?(build|make|create|design|write|launch|implement|analy[sz]e|research|draw|produce|deploy|generate|improve|fix|audit|review)\s+(me\s+)?((a|an|the|this|my|our)\s+)?/i, "");
  first = first.replace(/^[^a-zA-Z0-9$]+/, "").trim();
  if (first.length < 3) return fallback;
  if (first.length > 64) {
    const cut = first.slice(0, 63);
    first = cut.slice(0, Math.max(30, cut.lastIndexOf(" "))) + "…";
  }
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function slugName(repoUrl: string | null, launchNumber?: number): string {
  const m = (repoUrl ?? "").match(/launch-(\d+)-([a-z0-9-]+)/);
  if (m) {
    const words = m[2].replace(/-/g, " ");
    return `Launch #${m[1]}: ${words.charAt(0).toUpperCase()}${words.slice(1)}`;
  }
  return launchNumber ? `Launch #${launchNumber}` : "Untitled project";
}

function kindFor(templates: string[], launch: SnapshotLaunch | null, hasSite: boolean): ProjectKind {
  if (launch?.kind === "univ4_hook") return "Uniswap v4 hook";
  if (launch) return "Contracts";
  const t = templates.join(" ");
  if (/build-website|frontend-for-contract|site-content-check/.test(t)) return "Website";
  if (/research/.test(t)) return "Research";
  if (/create-(image|video|audio)/.test(t)) return "Media";
  if (/audit|adversarial-review|fuzz/.test(t)) return "Audit";
  if (/ponder-indexer/.test(t)) return "Indexer";
  if (/build-contract-project|single|multi_contract|impl_tests|implement-and-test|shape:/.test(t)) return "Contracts";
  if (/scaffold|workflow-planner|write-readme/.test(t)) return "Tooling";
  if (hasSite) return "Website";
  return "Other";
}

interface Group {
  id: string;
  workflow: SnapshotWorkflow | null;
  jobs: SnapshotJob[];
  launch: SnapshotLaunch | null;
  sites: SnapshotSite[];
}

function groupRecords(snapshot: Snapshot, live: LiveOverlay): Group[] {
  const byId = new Map<string, SnapshotJob>();
  for (const j of snapshot.jobs) byId.set(j.id, j);
  // Live job list entries carry no nodes; overlay only state-level fields.
  for (const lj of live.jobs ?? []) {
    const cur = byId.get(lj.id);
    if (cur) byId.set(lj.id, { ...cur, state: lj.state, updatedAt: lj.updatedAt, blockedReason: lj.blockedReason, delivery: lj.delivery ?? cur.delivery });
    else if (lj.template !== "skill:oracle-assess" && !/^shape:/.test(lj.template)) byId.set(lj.id, { ...lj, nodes: [], reviews: [], detailed: false });
  }
  const workflows = new Map(snapshot.workflows.map((w) => [w.id, w]));
  const launches = new Map<string, SnapshotLaunch>();
  for (const l of snapshot.launches) launches.set(l.id, l);
  for (const l of live.launches ?? []) launches.set(l.id, { ...launches.get(l.id), ...l });
  const sites = new Map<string, SnapshotSite>();
  for (const s of snapshot.sites) sites.set(s.id, s);
  for (const s of live.sites ?? []) sites.set(s.id, { ...sites.get(s.id), ...s });

  const resolve = (j: SnapshotJob): string => {
    if (j.workflowId) return `wf:${j.workflowId}`;
    const parent = byId.get(j.projectId);
    if (parent?.workflowId) return `wf:${parent.workflowId}`;
    return `job:${j.projectId}`;
  };
  const groups = new Map<string, Group>();
  for (const w of workflows.values()) groups.set(`wf:${w.id}`, { id: `wf:${w.id}`, workflow: w, jobs: [], launch: null, sites: [] });
  for (const j of byId.values()) {
    const gid = resolve(j);
    const g = groups.get(gid) ?? { id: gid, workflow: null, jobs: [], launch: null, sites: [] };
    g.jobs.push(j);
    groups.set(gid, g);
  }
  const usedLaunches = new Set<string>();
  const usedSites = new Set<string>();
  for (const g of groups.values()) {
    g.jobs.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    const launchId = g.workflow?.launchId ?? g.jobs.map((j) => j.launchId).find(Boolean) ?? null;
    if (launchId && launches.has(launchId)) {
      g.launch = launches.get(launchId)!;
      usedLaunches.add(launchId);
    }
    const jobIds = new Set(g.jobs.map((j) => j.id));
    const seen = new Set<string>();
    const push = (s: SnapshotSite | null | undefined) => {
      if (!s || seen.has(s.id)) return;
      seen.add(s.id);
      usedSites.add(s.id);
      g.sites.push(sites.get(s.id) ?? s);
    };
    push(g.workflow?.site);
    for (const j of g.jobs) push(j.site);
    for (const s of sites.values()) if (jobIds.has(s.jobId)) push(s);
    g.sites.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }
  for (const l of launches.values()) {
    if (!usedLaunches.has(l.id)) groups.set(`launch:${l.id}`, { id: `launch:${l.id}`, workflow: null, jobs: [], launch: l, sites: [] });
  }
  for (const s of sites.values()) {
    if (!usedSites.has(s.id)) groups.set(`site:${s.id}`, { id: `site:${s.id}`, workflow: null, jobs: [], launch: null, sites: [s] });
  }
  return [...groups.values()];
}

function buildProject(g: Group, live: LiveOverlay, records: SeatRecord[] | null, now: number): Project | null {
  const jobs = g.jobs;
  const wf = g.workflow;
  const launch = g.launch;
  const site = g.sites.find((s) => !s.supersededBy) ?? g.sites[0] ?? null;
  const rootJob = jobs.find((j) => !j.workflowId) ?? jobs[0] ?? null;
  const objective = wf?.objective || rootJob?.objective || "";
  const repoUrl = wf?.contracts?.repoUrl || wf?.frontend?.repoUrl || jobs.map((j) => j.delivery?.repoUrl).find(Boolean) || launch?.sourceRepoUrl || null;
  const name = objective ? deriveName(objective, slugName(repoUrl, launch?.launchNumber)) : slugName(repoUrl, launch?.launchNumber) || site?.label || "Untitled project";
  const templates = jobs.map((j) => j.template);
  const kind = kindFor(templates, launch, g.sites.length > 0);
  const createdAt = wf?.createdAt ?? rootJob?.createdAt ?? launch?.createdAt ?? site?.createdAt ?? new Date(now).toISOString();
  const updatedAt = [wf?.updatedAt, ...jobs.map((j) => j.updatedAt), launch?.updatedAt, ...g.sites.map((s) => s.updatedAt)]
    .filter((x): x is string => !!x)
    .sort()
    .pop() ?? createdAt;
  const chainId = launch?.chainId ?? wf?.chainId ?? rootJob?.launchChainId ?? null;
  const sources: SourceLabel[] = [];
  const liveConfirmed = (launch && live.launchesLive) || (site && live.sitesLive) || (rootJob && live.jobsLive);
  sources.push(liveConfirmed ? "Live" : "Snapshot");

  // ---------- evidence ----------
  const evidence: EvidenceLink[] = [];
  const seenUrl = new Set<string>();
  const addEv = (e: EvidenceLink) => {
    if (!e.url || seenUrl.has(e.url)) return;
    seenUrl.add(e.url);
    evidence.push(e);
  };
  if (repoUrl) addEv({ label: "Source code on GitHub", url: repoUrl, kind: "github" });
  for (const j of jobs) {
    if (j.delivery?.pullRequestUrl) addEv({ label: "Pull request", url: j.delivery.pullRequestUrl, kind: "github" });
    if (j.delivery?.repoUrl && j.delivery.repoUrl !== repoUrl) addEv({ label: kind === "Research" ? "Published report" : "Delivered repository", url: j.delivery.repoUrl, kind: "github" });
  }
  for (const s of g.sites) {
    addEv({ label: `Live site (${s.ensName ?? s.label})`, url: s.url, kind: "site" });
    if (s.cid) addEv({ label: "IPFS content", url: ipfsUrl(s.cid), kind: "ipfs" });
    if (s.txHash) addEv({ label: "ENS naming transaction", url: txUrl(1, s.txHash), kind: "tx" });
  }
  if (launch) {
    for (const a of launch.artifacts) addEv({ label: `${a.name} contract on ${chainName(launch.chainId)}`, url: addressUrl(launch.chainId, a.address), kind: "contract" });
    const tx = launch.artifacts.find((a) => a.txHash)?.txHash;
    if (tx) addEv({ label: "Deployment transaction", url: txUrl(launch.chainId, tx), kind: "tx" });
  }
  if (wf) addEv({ label: "Workflow on IdentityMD Explorer", url: explorerJobUrl(wf.id), kind: "explorer" });
  for (const j of jobs) addEv({ label: `Job ${j.id.slice(0, 8)} on IdentityMD Explorer`, url: explorerJobUrl(j.id), kind: "explorer" });
  for (const j of jobs) for (const r of j.reviews) if (r.txHash && r.chainId) addEv({ label: "Onchain work receipt", url: txUrl(r.chainId, r.txHash), kind: "tx" });

  // ---------- agents ----------
  const agents: ProjectAgent[] = [];
  const seenAgent = new Set<string>();
  const agentByAgentId = new Map<string, string>();
  for (const j of jobs) for (const n of j.nodes) if (n.seat && n.agentId) agentByAgentId.set(n.agentId, n.seat);
  for (const r of records ?? []) if (r.agentId) agentByAgentId.set(r.agentId, r.tokenId);
  const addAgent = (tokenId: string, role: ProjectAgent["role"], detail: string) => {
    const k = `${tokenId}:${role}`;
    if (seenAgent.has(k)) return;
    seenAgent.add(k);
    agents.push({ tokenId, role, detail });
  };
  for (const j of jobs) {
    for (const n of j.nodes) {
      if (!n.seat) continue;
      const role = n.role === "review" ? "Reviewer" : "Builder";
      addAgent(n.seat, role, `${humanKey(n.key)} · ${n.state}`);
    }
    for (const r of j.reviews) {
      for (const e of r.entries) {
        const tokenId = agentByAgentId.get(e.agentId);
        if (!tokenId) continue;
        if (e.role.startsWith("verification")) addAgent(tokenId, "Verifier", `${e.role.replace("verification:", "")} check on ${humanKey(e.nodeKey)}`);
      }
    }
  }
  const verifierVersions = new Set(jobs.flatMap((j) => j.nodes.map((n) => n.verdict?.verifier).filter((v): v is string => !!v)));
  if (verifierVersions.size) addAgent("service:verifier", "Verifier", `IdentityMD verifier ${[...verifierVersions].map((v) => v.split("+")[0]).join(", ")} rebuilt and checked the submission`);
  if (g.sites.some((s) => s.status === "named" || s.status === "pinned")) addAgent("service:publisher", "Publisher", "IdentityMD publisher pinned the export to IPFS and named it on ENS");
  if (launch && launch.status === "live") addAgent("service:deployer", "Publisher", `IdentityMD deployer put the contracts on ${chainName(launch.chainId)}`);
  const builderSeats = agents.filter((a) => a.role === "Builder").map((a) => a.tokenId);
  const builder = builderSeats.length ? `Seat #${builderSeats[0]}${builderSeats.length > 1 ? ` +${builderSeats.length - 1}` : ""}` : "IdentityMD swarm";

  // ---------- promises vs reality ----------
  const promises: PromiseRow[] = [];
  const works: string[] = [];
  const missing: string[] = [];
  const risks: RiskItem[] = [];
  const lastChecked = liveConfirmed ? new Date(now).toISOString() : null;
  const src: SourceLabel = liveConfirmed ? "Live" : "Snapshot";
  const implNodes = jobs.flatMap((j) => j.nodes.filter((n) => n.role !== "review"));
  const reviewNodes = jobs.flatMap((j) => j.nodes.filter((n) => n.role === "review"));
  const anyJobDone = jobs.some((j) => j.state === "completed") || wf?.status === "completed";
  const anyExecuting = jobs.some((j) => j.state === "executing") || ["executing", "validating", "running"].includes(wf?.status ?? "");
  const blocked = jobs.some((j) => j.state === "blocked") || wf?.status === "blocked";
  const cancelled = jobs.length > 0 && jobs.every((j) => j.state === "cancelled") || wf?.status === "cancelled";

  if (jobs.length || wf) {
    const delivered = !!repoUrl;
    promises.push({
      promise: kind === "Research" ? "Report delivered to a public repository" : "Source code delivered to a public repository",
      status: delivered ? "Delivered" : anyExecuting ? "Pending" : cancelled ? "Broken" : "Pending",
      evidence: evidence.filter((e) => e.kind === "github").slice(0, 2),
      lastChecked,
      source: src,
    });
    if (delivered) works.push(kind === "Research" ? "The report is published on GitHub." : "Source code is public on GitHub.");
    else missing.push(kind === "Research" ? "No published report yet." : "No public source code yet.");
  }
  if (implNodes.length) {
    const accepted = implNodes.filter((n) => n.state === "accepted").length;
    const bad = implNodes.filter((n) => ["rejected", "failed", "exhausted"].includes(n.state)).length;
    const status: PromiseRow["status"] = accepted === implNodes.length ? "Delivered" : bad && !accepted ? "Broken" : accepted ? "Partial" : "Pending";
    promises.push({
      promise: "Work accepted by the IdentityMD verifier",
      status,
      evidence: evidence.filter((e) => e.kind === "explorer").slice(0, 1),
      lastChecked,
      source: src,
      note: `${accepted} of ${implNodes.length} implementation steps accepted`,
    });
    if (status === "Delivered") works.push("Every implementation step passed the verifier's rebuild check.");
    else if (status !== "Pending") missing.push(`${implNodes.length - accepted} implementation step(s) not accepted.`);
  }
  if (reviewNodes.length) {
    const accepted = reviewNodes.filter((n) => n.state === "accepted").length;
    promises.push({
      promise: "Independent review by other agents",
      status: accepted === reviewNodes.length ? "Delivered" : accepted ? "Partial" : "Pending",
      evidence: evidence.filter((e) => e.kind === "explorer").slice(0, 1),
      lastChecked,
      source: src,
      note: `${accepted} of ${reviewNodes.length} review steps accepted`,
    });
    if (accepted) works.push(`${accepted} independent review step(s) completed by other seats.`);
  } else if (kind === "Contracts" || kind === "Uniswap v4 hook") {
    missing.push("No independent review recorded for this project.");
    risks.push({ severity: "warning", text: "No independent review step is recorded; treat the code as unreviewed.", source: src });
  }
  if (launch || wf?.launchStatus || rootJob?.launchId) {
    const status = launch?.status ?? wf?.launchStatus ?? rootJob?.launchStatus ?? null;
    const ev = evidence.filter((e) => e.kind === "contract" || e.kind === "tx").slice(0, 4);
    const chain = chainName(launch?.chainId ?? chainId);
    promises.push({
      promise: `Contracts deployed on ${chain}`,
      status: status === "live" ? "Delivered" : status === "parked" ? "Broken" : status ? "Pending" : "Unverified",
      evidence: ev,
      lastChecked,
      source: src,
      note: launch?.parkedReason ?? undefined,
    });
    if (status === "live") works.push(`${launch?.artifacts.length ?? 0} contract(s) live on ${chain}.`);
    if (status === "parked") {
      missing.push("The launch was parked before deployment.");
      risks.push({
        severity: "critical",
        text: `Launch parked: ${launch?.parkedReason ?? wf?.failure ?? "blocking findings were never resolved"}`,
        source: src,
        evidence: ev.slice(0, 1),
      });
    }
    if (status === "live" && isTestnet(launch?.chainId ?? chainId)) {
      risks.push({ severity: "info", text: `Deployed on ${chain}: test tokens have no market value.`, source: src });
    }
  }
  if (g.sites.length || rootJob?.host || wf?.frontend) {
    const s = site;
    const ev = evidence.filter((e) => e.kind === "site" || e.kind === "ipfs" || e.label.includes("ENS")).slice(0, 3);
    const status: PromiseRow["status"] = !s
      ? anyExecuting ? "Pending" : "Pending"
      : s.takenDownAt || s.status === "held" || s.status === "failed"
        ? "Broken"
        : s.status === "named"
          ? "Delivered"
          : s.status === "pinned"
            ? "Partial"
            : "Pending";
    promises.push({ promise: "Website published on IPFS with an ENS name", status, evidence: ev, lastChecked, source: src, note: s?.takenDownReason ?? s?.holdReason ?? s?.failure ?? undefined });
    if (status === "Delivered") works.push(`The site is pinned on IPFS and named ${s?.ensName ?? ""}.`.trim());
    if (status === "Partial") works.push("The export is pinned on IPFS; ENS naming is still pending.");
    if (status === "Pending") missing.push("The site has not been published yet.");
    if (status === "Broken") {
      missing.push("The published site is not available.");
      risks.push({ severity: "critical", text: `Site ${s?.takenDownAt ? "taken down" : s?.status}: ${s?.takenDownReason ?? s?.holdReason ?? s?.failure ?? "no reason published"}`, source: src, evidence: ev.slice(0, 1) });
    }
  }
  const receipts = jobs.flatMap((j) => j.reviews);
  if (receipts.length) {
    const sent = receipts.filter((r) => r.txHash).length;
    promises.push({
      promise: "Work receipt and scores recorded on Ethereum",
      status: sent === receipts.length ? "Delivered" : sent ? "Partial" : "Pending",
      evidence: evidence.filter((e) => e.label === "Onchain work receipt").slice(0, 2),
      lastChecked,
      source: src,
      note: sent ? undefined : "queued by IdentityMD, not yet sent",
    });
  }
  if (blocked) {
    const reason = jobs.map((j) => j.blockedReason).find(Boolean) ?? wf?.failure ?? "blocked";
    risks.push({ severity: "critical", text: `Blocked: ${reason}`, source: src });
    missing.push("The job is blocked and did not finish.");
  }
  if (cancelled) risks.push({ severity: "warning", text: "The job was cancelled.", source: src });
  const unresolvedNotes = jobs.flatMap((j) => j.nodes.map((n) => n.note).filter((n): n is string => !!n));
  for (const note of unresolvedNotes.slice(0, 2)) risks.push({ severity: "warning", text: note, source: src });
  if (kind === "Research") risks.push({ severity: "info", text: "Research content was accepted for integrity, not for accuracy. Read the sources it cites.", source: src });
  if (kind === "Media") risks.push({ severity: "info", text: "Media files were accepted for integrity only.", source: src });
  if (!jobs.length && !wf) risks.push({ severity: "info", text: "Only the launch record is public; the original request is not in the job history.", source: src });

  // ---------- scores ----------
  const product: Signal[] = [];
  const trust: Signal[] = [];
  const traction: Signal[] = [];
  if (repoUrl) product.push({ points: 30, reason: "delivered to a public repository" });
  const liveOutput = site?.status === "named" || launch?.status === "live" || (kind === "Research" && !!repoUrl) || (kind === "Media" && !!repoUrl);
  if (liveOutput) product.push({ points: 40, reason: "requested output is live" });
  if (implNodes.length && implNodes.every((n) => n.state === "accepted")) product.push({ points: 20, reason: "all implementation steps accepted by the verifier" });
  if (anyJobDone) product.push({ points: 10, reason: "job finished" });
  const capProduct = launch?.status === "parked" || blocked || (site && (site.takenDownAt || site.status === "held")) ? 35 : undefined;

  const acceptedReviews = reviewNodes.filter((n) => n.state === "accepted").length;
  if (acceptedReviews) trust.push({ points: Math.min(30, acceptedReviews * 10), reason: `${acceptedReviews} accepted independent review step(s)` });
  if (reviewNodes.some((n) => n.key === "audit_judge" && n.state === "accepted" && !n.note)) trust.push({ points: 10, reason: "audit judge accepted the final revision" });
  if (launch?.status === "live") trust.push(isTestnet(launch.chainId) ? { points: 5, reason: "deployed on a testnet" } : { points: 20, reason: "deployed on a mainnet" });
  if (repoUrl) trust.push({ points: 20, reason: "source public on GitHub" });
  if (site?.txHash) trust.push({ points: 10, reason: "site naming transaction on Ethereum" });
  if (receipts.length) trust.push(receipts.some((r) => r.txHash) ? { points: 10, reason: "onchain work receipt sent" } : { points: 5, reason: "onchain work receipt queued" });
  if (implNodes.length && implNodes.every((n) => n.state === "accepted") && repoUrl) trust.push({ points: 10, reason: "delivered files passed the verifier's integrity check" });

  const followUps = Math.max(0, jobs.filter((j) => !j.workflowId).length - 1) + (wf && jobs.length > 2 ? jobs.length - 2 : 0);
  if (followUps) traction.push({ points: Math.min(40, followUps * 20), reason: `${followUps} follow-up job(s)` });
  const seats = new Set(agents.filter((a) => !a.tokenId.startsWith("service:")).map((a) => a.tokenId));
  if (seats.size) traction.push({ points: Math.min(30, seats.size * 5), reason: `${seats.size} contributing seat(s)` });
  const ageMs = now - Date.parse(updatedAt);
  if (ageMs < 7 * DAY) traction.push({ points: 20, reason: "activity in the last 7 days" });
  else if (ageMs < 30 * DAY) traction.push({ points: 10, reason: "activity in the last 30 days" });

  const scores = computeScores({ product, trust, traction, caps: { product: capProduct } });
  const families = new Set<string>(["api"]);
  if (site?.txHash || launch?.artifacts.some((a) => a.txHash) || receipts.some((r) => r.txHash)) families.add("chain");
  if (acceptedReviews) families.add("review");
  const confidence = computeConfidence(families);
  const brokenPromises = promises.filter((p) => p.status === "Broken").length;
  const verdict = computeVerdict(scores, risks, confidence, brokenPromises);

  const status = wf?.status ?? launch?.status ?? site?.status ?? rootJob?.state ?? "unknown";
  const statusBits = [
    wf ? `workflow ${wf.status}` : rootJob ? `job ${rootJob.state}` : null,
    launch ? `launch ${launch.status}` : null,
    site ? `site ${site.takenDownAt ? "taken down" : site.status}` : null,
  ].filter(Boolean);

  const searchText = [name, objective, kind, launch?.artifacts.map((a) => a.address).join(" "), launch?.sourceRepoUrl, g.sites.map((s) => `${s.url} ${s.cid ?? ""} ${s.ensName ?? ""}`).join(" "), jobs.map((j) => j.id).join(" "), wf?.id, launch?.id, [...seats].map((s) => `#${s} seat ${s}`).join(" "), rootJob?.paidBy]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return {
    id: g.id,
    name,
    purpose: objective || (launch ? `Contract launch #${launch.launchNumber} (${launch.kind === "univ4_hook" ? "Uniswap v4 hook" : "EVM project"}) published from ${launch.sourceRepoUrl ?? "an IdentityMD job"}.` : site ? `Website ${site.ensName ?? site.label} published by the IdentityMD swarm.` : ""),
    kind,
    status,
    statusText: statusBits.join(" · ") || status,
    createdAt,
    updatedAt,
    lastChecked: lastChecked ?? updatedAt,
    verdict,
    confidence,
    scores,
    promises,
    works,
    missing,
    risks,
    evidence,
    agents,
    builder,
    chainId,
    launch,
    sites: g.sites,
    jobs,
    workflow: wf,
    paidBy: rootJob?.paidBy ?? null,
    sources,
    facts: [],
    featured: false,
    searchText,
  };
}

export function assembleProjects(snapshot: Snapshot, live: LiveOverlay, now = Date.now()): Project[] {
  const records = live.records ?? snapshot.records;
  const out: Project[] = [];
  for (const g of groupRecords(snapshot, live)) {
    const p = buildProject(g, live, records, now);
    if (p) out.push(p);
  }
  out.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  return out;
}
