// Assembles the HIVE project page from live reads. Facts, calculations and
// unverified claims are kept apart on purpose.

import { addressUrl, agentProfileUrl, explorerJobUrl, nftUrl, tokenUrl, txUrl } from "./chains";
import { HIVE, fmtToken, hexBig, sumValues, type HiveOnchain } from "./hive";
import { computeConfidence, computeScores, computeVerdict, type Signal } from "./scoring";
import type { EvidenceLink, FactRow, Project, ProjectAgent, PromiseRow, RiskItem, SeatRecord, SnapshotSwarm, SourceLabel, SwarmFeed } from "./types";

export const HIVE_PROJECT_ID = "hive";

export interface HiveInputs {
  onchain: HiveOnchain;
  swarm: SwarmFeed | null;
  swarmLive: boolean;
  swarmSnapshot: SnapshotSwarm | null;
  records: SeatRecord[] | null;
  recordsLive: boolean;
  now: number;
}

const ev = (label: string, url: string, kind: EvidenceLink["kind"]): EvidenceLink => ({ label, url, kind });

const CLAIMS: { promise: string; quote: string }[] = [
  { promise: "Trading fees buy identity.md agent seats", quote: "Fees buy identity.md seats, cheapest first, price-capped." },
  { promise: "Each seat runs as an AI agent and earns IMD", quote: "Each seat runs as an AI agent and earns IMD." },
  { promise: "Stakers receive the IMD the seats earn", quote: "Stakers claim the IMD the seats earn, pro-rata to their stake." },
  { promise: "No admin keys on splitter, staking and buyer contracts", quote: "Our splitter, staking and buyer contracts have no owner and fixed rules." },
  { promise: "Every protocol-owned seat is public onchain with its earnings", quote: "Every seat the protocol owns is on-chain, with its earnings, for anyone to check." },
  { promise: "The keeper can never withdraw funds or seats to itself", quote: "The buyer contract can only turn treasury ETH into an identity.md seat in the vault — the keeper can never withdraw funds or seats to itself." },
  { promise: "6.5% fee on every trade, split 5.5 / 0.5 / 0.2 / 0.3", quote: "Every trade pays 6.5%: 5.5% buys AI agents, 0.5% team, 0.2% running costs, 0.3% Pons launchpad." },
  { promise: "Loyalty multiplier grows a stake from 1× to 2× over 90 days", quote: "Stake it and a loyalty multiplier grows your share from 1× to 2× over 90 days." },
];

export function hiveSeatIds(inputs: HiveInputs): { ids: number[]; source: SourceLabel } {
  const keeper = HIVE.keeper.toLowerCase();
  if (inputs.swarm && inputs.swarmLive) {
    const ids: number[] = [];
    inputs.swarm.owners.forEach((o, i) => {
      if (o && o.toLowerCase() === keeper) ids.push(i);
    });
    return { ids, source: "Live" };
  }
  if (inputs.onchain.ethLogs.data) {
    const held = new Set<number>();
    for (const r of inputs.onchain.ethLogs.data.seatsIn) if (r.tokenId !== null) held.add(r.tokenId);
    for (const r of inputs.onchain.ethLogs.data.seatsOut) if (r.tokenId !== null) held.delete(r.tokenId);
    if (held.size) return { ids: [...held].sort((a, b) => a - b), source: "Onchain" };
  }
  return { ids: inputs.swarmSnapshot?.hiveSeats ?? [], source: "Snapshot" };
}

export function buildHiveProject(inputs: HiveInputs): Project {
  const { onchain, now } = inputs;
  const eth = onchain.eth.data;
  const ethLogs = onchain.ethLogs.data;
  const rh = onchain.rh.data;
  const rhLogs = onchain.rhLogs.data;
  const ethSrc: SourceLabel = onchain.eth.state.ok ? "Onchain" : eth ? "Snapshot" : "Snapshot";
  const rhSrc: SourceLabel = onchain.rh.state.ok ? "Onchain" : "Snapshot";
  const seats = hiveSeatIds(inputs);
  const seatSrc = seats.source;

  // Live agent counters for the HIVE seats.
  const seatStats = seats.ids.map((id) => {
    const live = inputs.swarm?.seats[String(id)];
    const rec = inputs.records?.find((r) => r.tokenId === String(id));
    const s = live && inputs.swarmLive ? live : rec ?? live ?? null;
    return { id, enrolled: !!(live || rec), attempts: s?.attempts ?? 0, accepted: s?.accepted ?? 0, working: live?.working ?? false, last: live?.last ?? rec?.lastWorkedAt ?? null };
  });
  const enrolled = seatStats.filter((s) => s.enrolled).length;
  const attempts = seatStats.reduce((a, s) => a + s.attempts, 0);
  const accepted = seatStats.reduce((a, s) => a + s.accepted, 0);
  const activeDay = seatStats.filter((s) => s.last && now - Date.parse(s.last) < 86_400_000).length;
  const working = seatStats.filter((s) => s.working).length;
  const statsSrc: SourceLabel = inputs.swarmLive ? "Live" : inputs.recordsLive ? "Live" : "Snapshot";

  const imdEarned = ethLogs ? sumValues(ethLogs.imdIn) : null;
  const imdOut = ethLogs ? sumValues(ethLogs.imdOut) : null;
  const imdDistributed = rhLogs ? sumValues(rhLogs.imdOutOfStaking) : null;
  const imdIntoStaking = rhLogs ? sumValues(rhLogs.imdIntoStaking) : null;
  const seatsHeld = eth?.seatsHeld ?? (seats.ids.length || null);
  const keeperIsWallet = eth?.keeperCode === false;
  const stakingOwnerless = rh?.stakingOwner === "none";
  const splitterOwnerless = rh?.splitterOwner === "none";
  const checkedAt = onchain.eth.state.at ?? onchain.rh.state.at ?? null;

  // ---------- evidence ----------
  const evidence: EvidenceLink[] = [
    ev("Project website", HIVE.site, "web"),
    ev("Published contract addresses (config.js)", HIVE.config, "web"),
    ev("HIVE token on Robinhood Chain explorer", tokenUrl(4663, HIVE.token), "contract"),
    ev("Seats held by the keeper wallet (Etherscan)", tokenUrl(1, HIVE.identityMd, HIVE.keeper), "contract"),
    ev("Keeper wallet on Ethereum", addressUrl(1, HIVE.keeper), "contract"),
    ev("Keeper wallet on Robinhood Chain", addressUrl(4663, HIVE.keeper), "contract"),
    ev("Staking contract", addressUrl(4663, HIVE.staking), "contract"),
    ev("Splitter contract", addressUrl(4663, HIVE.splitter), "contract"),
    ev("Trading-fee hook (Pons MemeHook)", addressUrl(4663, HIVE.memeHook), "contract"),
    ev("IMD token on Robinhood Chain", tokenUrl(4663, HIVE.imdRobinhood), "contract"),
    ev("Independent research report (IdentityMD job)", HIVE.researchReport, "research"),
    ev("Research job on IdentityMD Explorer", explorerJobUrl(HIVE.researchJob), "explorer"),
  ];
  const seatTxLinks: EvidenceLink[] = (ethLogs?.seatsIn ?? []).slice(-6).map((r) => ev(`Seat #${r.tokenId} received (tx)`, txUrl(1, r.tx), "tx"));
  const seatLinks: EvidenceLink[] = seats.ids.map((id) => ev(`Agent #${id} profile`, agentProfileUrl(id), "agent"));
  evidence.push(...seatTxLinks, ...seats.ids.slice(0, 6).map((id) => ev(`Seat #${id} NFT`, nftUrl(HIVE.identityMd, id), "contract")));

  // ---------- promises vs reality ----------
  const promises: PromiseRow[] = [];
  const claim = (i: number) => CLAIMS[i].promise;
  promises.push({
    promise: claim(0),
    status: seatsHeld && seatsHeld > 0 ? "Delivered" : seatsHeld === 0 ? "Pending" : "Unverified",
    evidence: [evidence[3], ...seatTxLinks.slice(0, 3)],
    lastChecked: onchain.eth.state.at,
    source: ethSrc,
    note: seatsHeld !== null ? `${seatsHeld} seat(s) held by the keeper wallet` : "seat balance not readable right now",
  });
  promises.push({
    promise: claim(1),
    status: seats.ids.length === 0 ? "Pending" : enrolled === seats.ids.length && accepted > 0 ? "Delivered" : enrolled > 0 ? "Partial" : "Pending",
    evidence: seatLinks.slice(0, 4),
    lastChecked: inputs.swarm?.at ? new Date(inputs.swarm.at).toISOString() : null,
    source: statsSrc,
    note: `${enrolled} of ${seats.ids.length} seats enrolled as agents · ${accepted.toLocaleString()} accepted jobs`,
  });
  promises.push({
    promise: claim(2),
    status: imdDistributed === null ? "Unverified" : imdDistributed > 0n ? "Delivered" : (imdIntoStaking ?? 0n) > 0n || hexBig(rh?.imdInStaking) ? "Partial" : "Pending",
    evidence: [evidence[9], evidence[6]],
    lastChecked: onchain.rhLogs.state.at,
    source: onchain.rhLogs.state.ok ? "Onchain" : "Snapshot",
    note: imdDistributed === null ? "IMD transfer history not readable right now" : imdDistributed > 0n ? `${fmtToken("0x" + imdDistributed.toString(16))} IMD paid out of the staking contract` : "no IMD has left the staking contract yet",
  });
  promises.push({
    promise: claim(3),
    status: rh ? (stakingOwnerless && splitterOwnerless ? "Partial" : "Broken") : "Unverified",
    evidence: [evidence[6], evidence[7], evidence[1]],
    lastChecked: onchain.rh.state.at,
    source: rhSrc,
    note: rh
      ? `staking owner(): ${rh.stakingOwner === "none" ? "none" : rh.stakingOwner ?? "unknown"} · splitter owner(): ${rh.splitterOwner === "none" ? "none" : rh.splitterOwner ?? "unknown"} · no buyer contract address is published`
      : "owner() not readable right now",
  });
  promises.push({
    promise: claim(4),
    status: seatsHeld && seatsHeld > 0 ? (imdEarned !== null && imdEarned > 0n ? "Delivered" : "Partial") : "Unverified",
    evidence: [evidence[3], evidence[4]],
    lastChecked: onchain.ethLogs.state.at ?? onchain.eth.state.at,
    source: onchain.ethLogs.state.ok ? "Onchain" : ethSrc,
    note: imdEarned === null ? "seats are visible onchain; IMD transfer history not readable right now" : imdEarned > 0n ? `${fmtToken("0x" + imdEarned.toString(16))} IMD received by the keeper wallet` : "seats are visible onchain; no IMD has reached the keeper wallet in the scanned window",
  });
  promises.push({
    promise: claim(5),
    status: eth ? (keeperIsWallet ? "Broken" : "Unverified") : "Unverified",
    evidence: [evidence[4], evidence[5], evidence[1]],
    lastChecked: onchain.eth.state.at,
    source: ethSrc,
    note: keeperIsWallet ? "the seats and the fee pot sit in a plain wallet address with no contract code, so the key holder can move them" : "keeper code check not readable right now",
  });
  promises.push({
    promise: claim(6),
    status: "Unverified",
    evidence: [evidence[8], evidence[10]],
    lastChecked: onchain.rh.state.at,
    source: "Research",
    note: "fee parameters live in the launchpad hook and were not read; the research report observed fees accruing there",
  });
  promises.push({
    promise: claim(7),
    status: "Unverified",
    evidence: [evidence[6]],
    lastChecked: null,
    source: "Snapshot",
    note: "the multiplier curve was not checked",
  });

  // ---------- facts / calculations / claims ----------
  const facts: FactRow[] = [];
  facts.push({ label: "Seats acquired", value: seatsHeld === null ? "Insufficient data" : `${seatsHeld}`, source: ethSrc, kind: "fact", evidence: [evidence[3]], note: seats.ids.length ? `#${seats.ids.join(", #")}` : undefined });
  facts.push({ label: "Seats enrolled as agents", value: seats.ids.length ? `${enrolled} of ${seats.ids.length}` : "Insufficient data", source: seatSrc === "Live" ? "Live" : statsSrc, kind: "fact", evidence: seatLinks.slice(0, 3) });
  facts.push({ label: "Agents active in the last 24 h", value: seats.ids.length ? `${activeDay}${working ? ` (${working} working now)` : ""}` : "Insufficient data", source: statsSrc, kind: "fact" });
  facts.push({ label: "Jobs attempted", value: seats.ids.length ? attempts.toLocaleString() : "Insufficient data", source: statsSrc, kind: "fact" });
  facts.push({ label: "Jobs accepted", value: seats.ids.length ? `${accepted.toLocaleString()}${attempts ? ` (${Math.round((accepted / attempts) * 100)}%)` : ""}` : "Insufficient data", source: statsSrc, kind: "calculation", note: "sum over the HIVE seats' work records" });
  facts.push({ label: "IMD earned by seats", value: imdEarned === null ? "Insufficient data" : `${fmtToken("0x" + imdEarned.toString(16))} IMD`, source: onchain.ethLogs.state.ok ? "Onchain" : "Snapshot", kind: "calculation", evidence: [evidence[4]], note: ethLogs ? `sum of IMD transfers into the keeper wallet on Ethereum, blocks ${ethLogs.fromBlock.toLocaleString()}–${ethLogs.toBlock.toLocaleString()}` : undefined });
  facts.push({ label: "IMD moved out of the keeper", value: imdOut === null ? "Insufficient data" : `${fmtToken("0x" + imdOut.toString(16))} IMD`, source: onchain.ethLogs.state.ok ? "Onchain" : "Snapshot", kind: "calculation", note: "transfers from the keeper wallet on Ethereum in the scanned window" });
  facts.push({ label: "IMD distributed to stakers", value: imdDistributed === null ? "Insufficient data" : `${fmtToken("0x" + imdDistributed.toString(16))} IMD`, source: onchain.rhLogs.state.ok ? "Onchain" : "Snapshot", kind: "calculation", evidence: [evidence[9]], note: rhLogs ? `sum of IMD transfers out of the staking contract on Robinhood Chain (${rhLogs.imdOutOfStaking.length} transfer(s))` : undefined });
  facts.push({ label: "IMD waiting in the staking contract", value: rh?.imdInStaking === undefined ? "Insufficient data" : `${fmtToken(rh?.imdInStaking)} IMD`, source: rhSrc, kind: "fact", evidence: [evidence[9]] });
  facts.push({ label: "HIVE staked", value: rh ? `${fmtToken(rh.totalStaked, 0)} HIVE` : "Insufficient data", source: rhSrc, kind: "fact", evidence: [evidence[6]], note: rh?.tokenSupply && rh.totalStaked ? `${((Number(hexBig(rh.totalStaked) ?? 0n) / Number(hexBig(rh.tokenSupply) ?? 1n)) * 100).toFixed(1)}% of supply` : undefined });
  facts.push({ label: "Treasury ETH on the keeper (Robinhood Chain)", value: rh ? `${fmtToken(rh.keeperEth, 4)} ETH` : "Insufficient data", source: rhSrc, kind: "fact", evidence: [evidence[5]] });
  facts.push({ label: "Treasury ETH on the keeper (Ethereum)", value: eth ? `${fmtToken(eth.keeperEth, 4)} ETH` : "Insufficient data", source: ethSrc, kind: "fact", evidence: [evidence[4]] });
  facts.push({ label: "Fees claimable from the launchpad escrow", value: rh ? `${fmtToken(rh.escrowClaimable, 4)} ETH` : "Insufficient data", source: rhSrc, kind: "fact", note: "balance of the splitter in the Pons escrow contract" });
  facts.push({ label: "Fees still pending in the hook", value: rh ? `${fmtToken(rh.hookPendingTax, 5)} + ${fmtToken(rh.hookPendingFees, 5)} ETH` : "Insufficient data", source: rhSrc, kind: "fact", note: "creator tax and pool fees not yet swept by the launchpad" });
  facts.push({ label: "HIVE held by the fee hook", value: rh ? `${fmtToken(rh.hiveInHook, 0)} HIVE` : "Insufficient data", source: rhSrc, kind: "fact", evidence: [evidence[8]] });
  facts.push({ label: "Staking contract owner()", value: rh ? (rh.stakingOwner === "none" ? "No owner function" : rh.stakingOwner ?? "unknown") : "Insufficient data", source: rhSrc, kind: "fact", evidence: [evidence[6]] });
  facts.push({ label: "Splitter contract owner()", value: rh ? (rh.splitterOwner === "none" ? "No owner function" : rh.splitterOwner ?? "unknown") : "Insufficient data", source: rhSrc, kind: "fact", evidence: [evidence[7]] });
  facts.push({
    label: "Fee hook owner()",
    value: rh ? (rh.hookOwner ? `${rh.hookOwner.slice(0, 6)}…${rh.hookOwner.slice(-4)}` : "unknown") : "Insufficient data",
    source: rhSrc,
    kind: "fact",
    evidence: rh?.hookOwner ? [evidence[8], ev("Hook owner address", addressUrl(4663, rh.hookOwner), "contract")] : [evidence[8]],
    note: "the hook belongs to the Pons launchpad, not to HIVE",
  });
  facts.push({ label: "Keeper address has contract code", value: eth ? (eth.keeperCode ? "Yes" : "No: plain wallet key") : "Insufficient data", source: ethSrc, kind: "fact", evidence: [evidence[4]] });
  for (const c of CLAIMS) facts.push({ label: c.promise, value: `“${c.quote}”`, source: "Snapshot", kind: "claim", evidence: [evidence[0]] });

  // ---------- risks ----------
  const risks: RiskItem[] = [];
  if (keeperIsWallet) {
    risks.push({
      severity: "critical",
      text: "The seats and the fee pot are held by a plain wallet address (no contract code on Ethereum or Robinhood Chain). Whoever holds that key can move them, which contradicts the site's claim that the keeper can never withdraw funds or seats.",
      source: ethSrc,
      evidence: [evidence[4], evidence[5]],
    });
  }
  if (rh?.hookOwner) {
    risks.push({
      severity: "warning",
      text: `The trading-fee hook is owned by ${rh.hookOwner.slice(0, 6)}…${rh.hookOwner.slice(-4)}. That owner, not HIVE, controls how fees are routed and released.`,
      source: rhSrc,
      evidence: [evidence[8], ev("Hook owner address", addressUrl(4663, rh.hookOwner), "contract")],
    });
  }
  if (rh && !stakingOwnerless) risks.push({ severity: "warning", text: "The staking contract exposes an owner.", source: rhSrc, evidence: [evidence[6]] });
  if (rh && !splitterOwnerless) risks.push({ severity: "warning", text: "The splitter contract exposes an owner.", source: rhSrc, evidence: [evidence[7]] });
  risks.push({ severity: "warning", text: "No buyer contract address is published, so the 'price-capped buying' and 'cannot cash out' claims cannot be checked.", source: "Snapshot", evidence: [evidence[1]] });
  risks.push({ severity: "info", text: "Contract source verification could not be checked automatically: the Robinhood Chain explorer sits behind a bot check. Open the contract pages to check by hand.", source: "Snapshot", evidence: [evidence[6], evidence[7]] });
  risks.push({ severity: "info", text: "The independent research report notes a 6.5% fee per trade (about 13% per round trip), thin liquidity and scheduled selling of HIVE by the fee hook.", source: "Research", evidence: [evidence[10]] });
  if (imdDistributed === 0n) risks.push({ severity: "info", text: "No IMD has been distributed to stakers yet; the yield claim is unproven so far.", source: "Onchain", evidence: [evidence[9]] });

  // ---------- works / missing ----------
  const works: string[] = [];
  const missing: string[] = [];
  if (seatsHeld) works.push(`${seatsHeld} identity.md seat(s) are held by the keeper wallet.`);
  if (enrolled) works.push(`${enrolled} seat(s) are enrolled as agents with ${accepted.toLocaleString()} accepted jobs.`);
  if (rh && (hexBig(rh.totalStaked) ?? 0n) > 0n) works.push(`Staking is live with ${fmtToken(rh.totalStaked, 0)} HIVE staked.`);
  if (rh && stakingOwnerless && splitterOwnerless) works.push("The staking and splitter contracts have no owner function.");
  if (imdDistributed !== null && imdDistributed === 0n) missing.push("No IMD has been paid to stakers yet.");
  if (imdEarned !== null && imdEarned === 0n) missing.push("No IMD earnings have reached the keeper wallet in the scanned window.");
  missing.push("No buyer or vault contract: seats sit in a wallet address.");
  missing.push("No public source code repository is published.");

  // ---------- agents ----------
  const agents: ProjectAgent[] = seats.ids.map((id) => ({ tokenId: String(id), role: "Builder", detail: "HIVE-owned seat running as an agent" }));
  agents.push({ tokenId: "1943", role: "Reviewer", detail: "Wrote the independent research report (job 3d3430dd)" });
  agents.push({ tokenId: "service:verifier", role: "Verifier", detail: "IdentityMD verifier checked the research report's files" });

  // ---------- scores ----------
  const product: Signal[] = [];
  const trust: Signal[] = [];
  const traction: Signal[] = [];
  if (seatsHeld) product.push({ points: 30, reason: "seats bought with fees" });
  if (enrolled && accepted > 0) product.push({ points: 30, reason: "seats enrolled and accepting work" });
  if (rh && (hexBig(rh.totalStaked) ?? 0n) > 0n) product.push({ points: 20, reason: "staking live" });
  if (imdDistributed !== null && imdDistributed > 0n) product.push({ points: 20, reason: "IMD distributed to stakers" });
  if (rh) {
    if (stakingOwnerless) trust.push({ points: 15, reason: "staking contract has no owner" });
    if (splitterOwnerless) trust.push({ points: 15, reason: "splitter contract has no owner" });
    if (rh.hookOwner) trust.push({ points: -10, reason: "fee hook owned by a third-party multisig" });
  }
  if (eth) {
    trust.push({ points: 10, reason: "seats and pot verifiable onchain" });
    if (keeperIsWallet) trust.push({ points: -25, reason: "seats held by a plain wallet key" });
  }
  trust.push({ points: 10, reason: "independent research report exists" });
  if (seatsHeld) traction.push({ points: Math.min(40, seatsHeld * 10), reason: `${seatsHeld} seat(s) acquired` });
  if (accepted) traction.push({ points: Math.min(40, Math.floor(accepted / 25)), reason: `${accepted.toLocaleString()} accepted jobs` });
  if (seats.ids.length && enrolled === seats.ids.length) traction.push({ points: 20, reason: "every seat enrolled" });
  const scores = computeScores({ product, trust, traction });
  const families = new Set<string>(["research"]);
  if (onchain.eth.state.ok || onchain.rh.state.ok) families.add("onchain");
  if (inputs.swarmLive) families.add("live");
  if (!onchain.eth.state.ok && !onchain.rh.state.ok && !inputs.swarmLive) families.add("snapshot");
  const confidence = computeConfidence(families);
  const verdict = computeVerdict(scores, risks, confidence, promises.filter((p) => p.status === "Broken").length);
  const sources: SourceLabel[] = [];
  if (inputs.swarmLive) sources.push("Live");
  if (onchain.eth.state.ok || onchain.rh.state.ok) sources.push("Onchain");
  sources.push("Research");
  if (!sources.includes("Live") && !sources.includes("Onchain")) sources.push("Snapshot");

  const lastChecked = checkedAt ?? new Date(now).toISOString();
  return {
    id: HIVE_PROJECT_ID,
    name: "HIVE (Project Hive)",
    purpose:
      "A strategy token on Robinhood Chain. Trading fees are meant to buy identity.md agent seats, run them as AI agents, and pay the IMD they earn to HIVE stakers. Swarm Alpha checks those promises against the chains and the IdentityMD swarm feed.",
    kind: "Strategy token",
    status: "live",
    statusText: `token live on Robinhood Chain · ${seatsHeld ?? "?"} seat(s) held`,
    createdAt: "2026-09-28T09:25:00.000Z",
    updatedAt: lastChecked,
    lastChecked,
    verdict,
    confidence,
    scores,
    promises,
    works,
    missing,
    risks,
    evidence,
    agents,
    builder: "Project Hive team (projecthive.fun)",
    chainId: 4663,
    launch: null,
    sites: [],
    jobs: [],
    workflow: null,
    paidBy: null,
    sources,
    facts,
    featured: true,
    searchText: ["hive", "project hive", "$hive", HIVE.token, HIVE.keeper, HIVE.staking, HIVE.splitter, HIVE.memeHook, "robinhood", "strategy token", "staking", ...seats.ids.map((i) => `#${i} seat ${i}`)].join(" ").toLowerCase(),
  };
}
