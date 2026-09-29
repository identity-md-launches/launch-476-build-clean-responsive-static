// Project Hive ($HIVE): the first detailed example. Every number on the HIVE
// page is read at run time from public chains or the IdentityMD swarm feed.
// Addresses come from the project's own published configuration
// (https://projecthive.fun/config.js) and are recorded here with that source.

import { SELECTORS, callData, decodeAddress, decodeUint, formatUnits, getLogs, padAddress, rpcBatch, transferTopic, type LogEntry, type LogsEndpoint } from "./rpc";
import { readCache, writeCache } from "./cache";
import type { SourceState } from "./types";

export const HIVE = {
  token: "0xCdaE63D95D6dd4f89f6e508c77bD4388b4e5C8Ab",
  chainId: 4663,
  site: "https://projecthive.fun/",
  config: "https://projecthive.fun/config.js",
  x: "https://x.com/HIVE_imd",
  // From projecthive.fun/config.js (fetched 2026-09-29):
  staking: "0x4a56860781f90Cd4d9D9883b33c2B9bE94E88695",
  splitter: "0xCFd95537953236E7885f450F001b00960F496bC2",
  keeper: "0x84b31CB3D205EfD2d20F29eA7ccaB1bc34326DdB", // "seatVault" and "potWallet" in the config: the same address holds the seats and the fee pot
  memeHook: "0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044", // Pons launchpad hook where trading fees accrue
  curve: "0x27929453cDf906F3B536C2519621746bF417F890",
  poolId: "0x4674f978aab6c373c1634a6729771d9bd6b97bbf25fdfa70d601a81a339f6974",
  imdRobinhood: "0x5F7Bb59365ce557C26dbcAa4EE9d39A4b95B7127",
  imdEthereum: "0xD34a99Bc0f67aE1bbd63C660e6d0b0dd03E263B7",
  identityMd: "0x0000eC93127BAA929E58E97dd0095A2BFb38ec1D",
  ponsEscrow: "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e",
  // Independent research report commissioned on IdentityMD (job 3d3430dd):
  researchReport: "https://github.com/Identity-md/research/blob/main/jobs/3d3430dd-5761-4baa-bd91-2bd9bff9d7af/files/artifacts/report.md",
  researchJob: "3d3430dd-5761-4baa-bd91-2bd9bff9d7af",
  // Scan windows. The token was minted on Robinhood Chain at block 74,688,116
  // (2026-09-28) and the first seat reached the keeper at Ethereum block
  // 26,077,108 (2026-09-28). Scans start a little earlier so nothing is missed.
  ethStartBlock: 26_060_000,
  rhStartBlock: 74_600_000,
};

export const ETH_CALL_RPCS = ["https://ethereum-rpc.publicnode.com", "https://eth.drpc.org", "https://rpc.flashbots.net"];
export const ETH_LOG_RPCS: LogsEndpoint[] = [
  { url: "https://rpc.flashbots.net", maxRange: 99_000 },
  { url: "https://eth.drpc.org", maxRange: 9_990 },
];
export const RH_RPCS = ["https://rpc.mainnet.chain.robinhood.com", "https://robinhood-rpc.publicnode.com"];
export const RH_LOG_RPCS: LogsEndpoint[] = [
  { url: "https://rpc.mainnet.chain.robinhood.com", maxRange: 2_000_000 },
  { url: "https://robinhood-rpc.publicnode.com", maxRange: 50_000 },
];

export interface TransferRow {
  block: number;
  tx: string;
  from: string;
  to: string;
  tokenId: number | null;
  value: string | null; // hex wei
}

export interface HiveEthReads {
  at: string;
  block: number | null;
  seatsHeld: number | null;
  keeperCode: boolean | null; // true when the keeper address has contract code
  imdBalance: string | null; // hex
  keeperEth: string | null; // hex
}

export interface HiveEthLogs {
  at: string;
  fromBlock: number;
  toBlock: number;
  seatsIn: TransferRow[];
  seatsOut: TransferRow[];
  imdIn: TransferRow[];
  imdOut: TransferRow[];
}

export interface HiveRhReads {
  at: string;
  block: number | null;
  tokenSupply: string | null;
  totalStaked: string | null;
  hiveInStaking: string | null;
  imdInStaking: string | null;
  stakingOwner: string | null; // "none" when owner() reverts
  splitterOwner: string | null;
  hookOwner: string | null;
  hiveInHook: string | null;
  keeperEth: string | null;
  escrowClaimable: string | null;
  hookPendingTax: string | null;
  hookPendingFees: string | null;
  keeperCode: boolean | null;
  stakingCode: boolean | null;
  splitterCode: boolean | null;
}

export interface HiveRhLogs {
  at: string;
  fromBlock: number;
  toBlock: number;
  imdOutOfStaking: TransferRow[];
  imdIntoStaking: TransferRow[];
}

export interface HiveOnchain {
  eth: { data: HiveEthReads | null; state: SourceState };
  ethLogs: { data: HiveEthLogs | null; state: SourceState };
  rh: { data: HiveRhReads | null; state: SourceState };
  rhLogs: { data: HiveRhLogs | null; state: SourceState };
}

const okState = (at: string): SourceState => ({ label: "Onchain", at, ok: true, note: "" });
const cachedState = (at: string | null): SourceState => ({ label: "Onchain", at, ok: false, note: at ? "showing last confirmed values" : "not reachable from this browser" });

function toHex(v: bigint | null): string | null {
  return v === null ? null : "0x" + v.toString(16);
}

export function hexBig(h: string | null | undefined): bigint | null {
  if (!h) return null;
  try {
    return BigInt(h);
  } catch {
    return null;
  }
}

function rows(logs: LogEntry[], erc721: boolean): TransferRow[] {
  return logs
    .map((l) => ({
      block: l.blockNumber,
      tx: l.transactionHash,
      from: "0x" + (l.topics[1] ?? "").slice(26),
      to: "0x" + (l.topics[2] ?? "").slice(26),
      tokenId: erc721 && l.topics[3] ? Number(BigInt(l.topics[3])) : null,
      value: erc721 ? null : l.data,
    }))
    .sort((a, b) => a.block - b.block);
}

async function withCache<T>(key: string, fn: () => Promise<T>): Promise<{ data: T | null; state: SourceState }> {
  try {
    const data = await fn();
    const v = writeCache(key, data);
    return { data, state: okState(v.at) };
  } catch {
    const c = readCache<T>(key);
    return { data: c?.data ?? null, state: cachedState(c?.at ?? null) };
  }
}

export async function readHiveEth(): Promise<{ data: HiveEthReads | null; state: SourceState }> {
  return withCache("hive.eth", async () => {
    const keeper = padAddress(HIVE.keeper);
    const res = await rpcBatch(ETH_CALL_RPCS, [
      { method: "eth_blockNumber", params: [] },
      { method: "eth_call", params: [{ to: HIVE.identityMd, data: callData(SELECTORS.balanceOf, keeper) }, "latest"] },
      { method: "eth_getCode", params: [HIVE.keeper, "latest"] },
      { method: "eth_call", params: [{ to: HIVE.imdEthereum, data: callData(SELECTORS.balanceOf, keeper) }, "latest"] },
      { method: "eth_getBalance", params: [HIVE.keeper, "latest"] },
    ]);
    const seats = decodeUint(res[1]);
    return {
      at: new Date().toISOString(),
      block: typeof res[0] === "string" ? Number.parseInt(res[0], 16) : null,
      seatsHeld: seats === null ? null : Number(seats),
      keeperCode: typeof res[2] === "string" ? res[2] !== "0x" : null,
      imdBalance: toHex(decodeUint(res[3])),
      keeperEth: toHex(decodeUint(res[4])),
    };
  });
}

export async function readHiveEthLogs(toBlock: number | null): Promise<{ data: HiveEthLogs | null; state: SourceState }> {
  return withCache("hive.ethLogs", async () => {
    if (!toBlock) throw new Error("no head block");
    const keeper = "0x" + padAddress(HIVE.keeper);
    const [seatsIn, seatsOut, imdIn, imdOut] = await Promise.all([
      getLogs(ETH_LOG_RPCS, { address: HIVE.identityMd, topics: [transferTopic, null, keeper], fromBlock: HIVE.ethStartBlock, toBlock }),
      getLogs(ETH_LOG_RPCS, { address: HIVE.identityMd, topics: [transferTopic, keeper], fromBlock: HIVE.ethStartBlock, toBlock }),
      getLogs(ETH_LOG_RPCS, { address: HIVE.imdEthereum, topics: [transferTopic, null, keeper], fromBlock: HIVE.ethStartBlock, toBlock }),
      getLogs(ETH_LOG_RPCS, { address: HIVE.imdEthereum, topics: [transferTopic, keeper], fromBlock: HIVE.ethStartBlock, toBlock }),
    ]);
    if (!seatsIn || !seatsOut || !imdIn || !imdOut) throw new Error("logs unavailable");
    return {
      at: new Date().toISOString(),
      fromBlock: HIVE.ethStartBlock,
      toBlock,
      seatsIn: rows(seatsIn, true),
      seatsOut: rows(seatsOut, true),
      imdIn: rows(imdIn, false),
      imdOut: rows(imdOut, false),
    };
  });
}

export async function readHiveRh(): Promise<{ data: HiveRhReads | null; state: SourceState }> {
  return withCache("hive.rh", async () => {
    const staking = padAddress(HIVE.staking);
    const splitter = padAddress(HIVE.splitter);
    const hook = padAddress(HIVE.memeHook);
    const poolWord = HIVE.poolId.replace(/^0x/, "");
    const zero = "0".repeat(64);
    const res = await rpcBatch(RH_RPCS, [
      { method: "eth_blockNumber", params: [] },
      { method: "eth_call", params: [{ to: HIVE.token, data: SELECTORS.totalSupply }, "latest"] },
      { method: "eth_call", params: [{ to: HIVE.staking, data: SELECTORS.totalStaked }, "latest"] },
      { method: "eth_call", params: [{ to: HIVE.token, data: callData(SELECTORS.balanceOf, staking) }, "latest"] },
      { method: "eth_call", params: [{ to: HIVE.imdRobinhood, data: callData(SELECTORS.balanceOf, staking) }, "latest"] },
      { method: "eth_call", params: [{ to: HIVE.staking, data: SELECTORS.owner }, "latest"] },
      { method: "eth_call", params: [{ to: HIVE.splitter, data: SELECTORS.owner }, "latest"] },
      { method: "eth_call", params: [{ to: HIVE.memeHook, data: SELECTORS.owner }, "latest"] },
      { method: "eth_call", params: [{ to: HIVE.token, data: callData(SELECTORS.balanceOf, hook) }, "latest"] },
      { method: "eth_getBalance", params: [HIVE.keeper, "latest"] },
      { method: "eth_call", params: [{ to: HIVE.ponsEscrow, data: callData(SELECTORS.balanceOf, splitter) }, "latest"] },
      { method: "eth_call", params: [{ to: HIVE.memeHook, data: callData(SELECTORS.pendingCreatorTax, poolWord, zero) }, "latest"] },
      { method: "eth_call", params: [{ to: HIVE.memeHook, data: callData(SELECTORS.pendingFees, poolWord, zero) }, "latest"] },
      { method: "eth_getCode", params: [HIVE.keeper, "latest"] },
      { method: "eth_getCode", params: [HIVE.staking, "latest"] },
      { method: "eth_getCode", params: [HIVE.splitter, "latest"] },
    ]);
    const ownerOf = (r: unknown, codeKnown: boolean) => {
      const a = decodeAddress(r);
      if (a) return a;
      return codeKnown ? "none" : null; // owner() reverted on a contract with code: there is no owner function
    };
    const stakingCode = typeof res[14] === "string" ? res[14] !== "0x" : null;
    const splitterCode = typeof res[15] === "string" ? res[15] !== "0x" : null;
    return {
      at: new Date().toISOString(),
      block: typeof res[0] === "string" ? Number.parseInt(res[0], 16) : null,
      tokenSupply: toHex(decodeUint(res[1])),
      totalStaked: toHex(decodeUint(res[2])),
      hiveInStaking: toHex(decodeUint(res[3])),
      imdInStaking: toHex(decodeUint(res[4])),
      stakingOwner: ownerOf(res[5], stakingCode === true),
      splitterOwner: ownerOf(res[6], splitterCode === true),
      hookOwner: decodeAddress(res[7]),
      hiveInHook: toHex(decodeUint(res[8])),
      keeperEth: toHex(decodeUint(res[9])),
      escrowClaimable: toHex(decodeUint(res[10])),
      hookPendingTax: toHex(decodeUint(res[11])),
      hookPendingFees: toHex(decodeUint(res[12])),
      keeperCode: typeof res[13] === "string" ? res[13] !== "0x" : null,
      stakingCode,
      splitterCode,
    };
  });
}

export async function readHiveRhLogs(toBlock: number | null): Promise<{ data: HiveRhLogs | null; state: SourceState }> {
  return withCache("hive.rhLogs", async () => {
    if (!toBlock) throw new Error("no head block");
    const staking = "0x" + padAddress(HIVE.staking);
    const [out, into] = await Promise.all([
      getLogs(RH_LOG_RPCS, { address: HIVE.imdRobinhood, topics: [transferTopic, staking], fromBlock: HIVE.rhStartBlock, toBlock }),
      getLogs(RH_LOG_RPCS, { address: HIVE.imdRobinhood, topics: [transferTopic, null, staking], fromBlock: HIVE.rhStartBlock, toBlock }),
    ]);
    if (!out || !into) throw new Error("logs unavailable");
    return { at: new Date().toISOString(), fromBlock: HIVE.rhStartBlock, toBlock, imdOutOfStaking: rows(out, false), imdIntoStaking: rows(into, false) };
  });
}

export function sumValues(rowsIn: TransferRow[] | undefined): bigint {
  let s = 0n;
  for (const r of rowsIn ?? []) s += hexBig(r.value) ?? 0n;
  return s;
}

export const fmtToken = (hex: string | null | undefined, digits = 2) => formatUnits(hexBig(hex), 18, digits);

/** Reads persisted values without touching the network (first paint). */
export function cachedHive(): HiveOnchain {
  const eth = readCache<HiveEthReads>("hive.eth");
  const ethLogs = readCache<HiveEthLogs>("hive.ethLogs");
  const rh = readCache<HiveRhReads>("hive.rh");
  const rhLogs = readCache<HiveRhLogs>("hive.rhLogs");
  return {
    eth: { data: eth?.data ?? null, state: cachedState(eth?.at ?? null) },
    ethLogs: { data: ethLogs?.data ?? null, state: cachedState(ethLogs?.at ?? null) },
    rh: { data: rh?.data ?? null, state: cachedState(rh?.at ?? null) },
    rhLogs: { data: rhLogs?.data ?? null, state: cachedState(rhLogs?.at ?? null) },
  };
}
