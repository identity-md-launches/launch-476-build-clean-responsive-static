#!/usr/bin/env node
/**
 * Builds public/data/snapshot.json from public IdentityMD sources.
 *
 * The snapshot is the offline fallback the site ships with. At run time the
 * browser re-fetches every source that answers cross-origin requests and
 * merges field by field on top of these values. Nothing here is secret and
 * nothing is invented: every value is copied from a public endpoint and the
 * endpoint is recorded next to it.
 *
 * Sources (all public, no keys):
 *   https://api.imd.fun/jobs?limit=500&before=<iso>   job list, paged
 *   https://api.imd.fun/jobs/<id>                      job detail: objective, nodes, seats, verdicts
 *   https://api.imd.fun/workflows?limit=500            workflows: contracts + frontend stages, launch, site
 *   https://api.imd.fun/launches?limit=500             deployed contract launches
 *   https://api.imd.fun/sites                          published IPFS sites
 *   https://api.imd.fun/swarm                          live swarm feed (health, seats, owners)
 *   https://api.imd.fun/seats/records                  per-seat work records
 *   https://api.imd.fun/seats/<tokenId>?work=0         seat detail (status, runtime, owner, pairedAt)
 *   https://explorer.imd.fun/api/agents/<tokenId>      explorer agent summary (online, owner name, held)
 *
 * Usage: node scripts/snapshot.mjs   (writes public/data/snapshot.json, copied into dist/ by the build)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API = "https://api.imd.fun";
const EXPLORER = "https://explorer.imd.fun";
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/data/snapshot.json");
const HIVE_KEEPER = "0x84b31cb3d205efd2d20f29ea7ccab1bc34326ddb";

const log = (...a) => console.error(new Date().toISOString().slice(11, 19), ...a);

async function getJson(url, tries = 8) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { accept: "application/json", "user-agent": "swarm-alpha-snapshot/1.0" } });
      if (r.status === 404) return null;
      if (r.status === 429) {
        // Public API rate limit: honour Retry-After, otherwise back off progressively.
        const ra = Number(r.headers.get("retry-after")) || 0;
        await new Promise((res) => setTimeout(res, Math.max(ra * 1000, 1500 * (i + 1))));
        lastErr = new Error("HTTP 429");
        continue;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      lastErr = e;
      await new Promise((res) => setTimeout(res, 800 * (i + 1)));
    }
  }
  log("giving up on", url, String(lastErr));
  return null;
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

async function pageJobs() {
  let before = null;
  const all = [];
  for (let page = 0; page < 40; page++) {
    const j = await getJson(`${API}/jobs?limit=500${before ? `&before=${encodeURIComponent(before)}` : ""}`);
    if (!j || !Array.isArray(j.jobs) || j.jobs.length === 0) break;
    all.push(...j.jobs);
    const last = j.jobs[j.jobs.length - 1].createdAt;
    if (j.jobs.length < 500 || last === before) break;
    before = last;
  }
  return all;
}

const clip = (s, n) => (typeof s === "string" && s.length > n ? s.slice(0, n - 1) + "…" : s ?? null);

const compactNode = (n) => ({
  key: n.key,
  role: n.role,
  state: n.state,
  attempt: n.attempt ?? null,
  revisions: n.revisions ?? null,
  seat: n.seat?.tokenId ?? null,
  agentId: n.seat?.agentId ?? null,
  verdict: n.verdict ? { status: n.verdict.status, evaluation: n.verdict.evaluation, at: null, verifier: n.verdict.verifierVersion?.split("+")[0] ?? null } : null,
  note: clip(n.dispatchNote, 300),
  failure: clip(n.failureReason, 300),
});

const compactReviews = (reviews) =>
  (reviews || []).map((r) => ({
    status: r.status,
    chainId: r.chainId ?? null,
    txHash: r.txHash ?? null,
    sentAt: r.sentAt ?? null,
    entries: (r.entries || []).map((e) => ({ nodeKey: e.nodeKey, agentId: e.agentId, role: e.role, value: e.value })),
  }));

const compactSite = (s) =>
  s
    ? {
        id: s.id,
        jobId: s.jobId,
        url: s.url,
        status: s.status,
        holdReason: clip(s.holdReason, 300),
        takenDownAt: s.takenDownAt,
        takenDownReason: clip(s.takenDownReason, 300),
        label: s.label,
        cid: s.cid,
        bytes: s.bytes,
        ensName: s.ensName,
        txHash: s.txHash,
        blockNumber: s.blockNumber,
        failure: clip(s.failure, 300),
        pinnedAt: s.pinnedAt,
        namedAt: s.namedAt,
        supersededBy: s.supersededBy,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      }
    : null;

const compactLaunch = (l) =>
  l
    ? {
        id: l.id,
        launchNumber: l.launchNumber,
        kind: l.kind,
        status: l.status,
        chainId: l.chainId,
        sourceRepoUrl: l.sourceRepoUrl,
        sourceCommit: l.sourceCommit,
        parkedReason: clip(l.parkedReason, 400),
        artifacts: (l.artifacts || []).map((a) => ({ role: a.role, name: a.name, address: a.address, txHash: a.txHash, blockNumber: a.blockNumber })),
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
      }
    : null;

const knownSiteIds = new Set();

function compactJob(d) {
  const objective = d.objective || "";
  // Workflow stage jobs carry a long boilerplate preamble; the workflow record holds the real request.
  const isStageBoilerplate = /^WORKFLOW [A-Z ]+STAGE CONTEXT/.test(objective);
  return {
    id: d.id,
    state: d.state,
    template: d.template,
    objective: clip(objective, isStageBoilerplate ? 240 : 700),
    detailed: Array.isArray(d.nodes),
    blockedReason: d.blockedReason ?? null,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    paidBy: d.paidBy ?? null,
    parentJobId: d.parentJobId ?? null,
    projectId: d.project?.id ?? d.id,
    projectHead: d.project?.head ?? d.id,
    workflowId: d.workflow?.id ?? null,
    host: !!d.host,
    delivery: d.delivery
      ? { repoUrl: d.delivery.repoUrl, pullRequestUrl: d.delivery.pullRequestUrl, commit: d.delivery.commit, deliveredAt: d.delivery.deliveredAt }
      : null,
    launchId: d.launch?.id ?? null,
    launchStatus: d.launch?.status ?? null,
    launchChainId: d.launch?.chainId ?? null,
    site: d.site && !knownSiteIds.has(d.site.id) ? compactSite(d.site) : null,
    siteId: d.site?.id ?? null,
    nodes: (d.nodes || []).map(compactNode),
    reviews: compactReviews(d.reviews),
  };
}

async function main() {
  log("paging jobs…");
  const jobs = await pageJobs();
  log("jobs:", jobs.length);
  const projectJobs = jobs.filter((j) => j.template !== "skill:oracle-assess");
  log("workflows, launches, sites, swarm, records…");
  const [wfRes, launchRes, siteRes, swarm, records] = await Promise.all([
    getJson(`${API}/workflows?limit=500`),
    getJson(`${API}/launches?limit=500`),
    getJson(`${API}/sites`),
    getJson(`${API}/swarm`),
    getJson(`${API}/seats/records`),
  ]);
  for (const s of siteRes?.sites || []) knownSiteIds.add(s.id);

  log("non-oracle jobs:", projectJobs.length, "fetching details…");
  const details = (await mapLimit(projectJobs, 3, async (j) => {
    const d = await getJson(`${API}/jobs/${j.id}`);
    return d && d.id ? compactJob(d) : compactJob({ ...j, objective: j.objective });
  })).filter(Boolean);
  log("workflow details…");
  const wfDetails = await mapLimit(wfRes?.workflows || [], 3, async (w) => (await getJson(`${API}/workflows/${w.id}`)) || w);
  const workflows = wfDetails.map((w) => ({
    id: w.id,
    objective: clip(w.objective || "", 1200),
    status: w.status,
    failure: clip(w.failure, 400),
    chainId: w.chainId ?? null,
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
    contracts: w.contracts ? { id: w.contracts.id, state: w.contracts.state, failure: clip(w.contracts.failure, 300), repoUrl: w.contracts.repoUrl, commit: w.contracts.commit } : w.contractsJobId ? { id: w.contractsJobId, state: null, failure: null, repoUrl: null, commit: null } : null,
    frontend: w.frontend ? { id: w.frontend.id, state: w.frontend.state, failure: clip(w.frontend.failure, 300), repoUrl: w.frontend.repoUrl, commit: w.frontend.commit } : w.frontendJobId ? { id: w.frontendJobId, state: null, failure: null, repoUrl: null, commit: null } : null,
    launchId: w.launch?.id ?? null,
    launchStatus: w.launch?.status ?? null,
    site: compactSite(w.site),
  }));
  const launches = (launchRes?.launches || []).map(compactLaunch);
  const sites = (siteRes?.sites || []).map(compactSite);
  log("workflows:", workflows.length, "launches:", launches.length, "sites:", sites.length);

  // Agents worth describing: every seat that appears in a project node, every
  // HIVE seat, and the busiest seats overall.
  const seatIds = new Set();
  for (const d of details) for (const n of d.nodes) if (n.seat) seatIds.add(String(n.seat));
  if (swarm?.owners) swarm.owners.forEach((o, i) => { if (o && o.toLowerCase() === HIVE_KEEPER) seatIds.add(String(i)); });
  const topRecords = [...(records?.seats || [])].sort((a, b) => (b.accepted || 0) - (a.accepted || 0)).slice(0, 40);
  for (const r of topRecords) seatIds.add(String(r.tokenId));
  log("agents to describe:", seatIds.size);
  const agents = {};
  await mapLimit([...seatIds], 2, async (id) => {
    const [ex, seat] = await Promise.all([getJson(`${EXPLORER}/api/agents/${id}`), getJson(`${API}/seats/${id}?work=0`)]);
    agents[id] = {
      tokenId: id,
      agentId: seat?.agentId ?? null,
      status: seat?.status ?? null,
      owner: seat?.owner ?? ex?.owner ?? null,
      ownerName: ex?.ownerName ?? null,
      ownership: seat?.ownership ?? null,
      pairedAt: seat?.pairedAt ?? null,
      online: seat?.online ?? ex?.online ?? null,
      daemonVersion: seat?.daemonVersion ?? null,
      runtime: seat?.runtimes?.[0] ? { id: seat.runtimes[0].id, version: seat.runtimes[0].version, model: seat.runtimes[0].premiumModel?.model ?? null } : null,
      devices: seat?.devices ?? null,
      held: ex?.held ?? null,
      attempts: seat?.attempts ?? ex?.attempts ?? null,
      accepted: seat?.accepted ?? ex?.accepted ?? null,
      rejected: seat?.rejected ?? null,
      failed: seat?.failed ?? null,
      pending: seat?.pending ?? null,
      collaboratorJobs: seat?.collaboratorJobs ?? null,
    };
  });

  const snapshot = {
    generatedAt: new Date().toISOString(),
    sources: {
      jobs: `${API}/jobs`,
      jobDetail: `${API}/jobs/{id}`,
      workflows: `${API}/workflows`,
      launches: `${API}/launches`,
      sites: `${API}/sites`,
      swarm: `${API}/swarm`,
      records: `${API}/seats/records`,
      seat: `${API}/seats/{tokenId}`,
      explorerAgent: `${EXPLORER}/api/agents/{tokenId}`,
    },
    jobs: details,
    workflows,
    launches,
    sites,
    agents,
    records: (records?.seats || []).map((r) => ({
      tokenId: String(r.tokenId),
      agentId: r.agentId ?? null,
      attempts: r.attempts ?? 0,
      accepted: r.accepted ?? 0,
      rejected: r.rejected ?? 0,
      failed: r.failed ?? 0,
      pending: r.pending ?? 0,
      lastWorkedAt: r.lastWorkedAt ?? null,
    })),
    swarm: swarm
      ? {
          at: swarm.at,
          health: swarm.health,
          counts: swarm.counts,
          chain: swarm.chain,
          hiveSeats: (swarm.owners || []).map((o, i) => (o && o.toLowerCase() === HIVE_KEEPER ? i : -1)).filter((i) => i >= 0),
          distinctOwners: new Set((swarm.owners || []).filter(Boolean).map((o) => o.toLowerCase())).size,
        }
      : null,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(snapshot));
  log("wrote", OUT, (fs.statSync(OUT).size / 1024).toFixed(0) + " KB");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
