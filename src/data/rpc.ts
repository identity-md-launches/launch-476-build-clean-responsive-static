// Minimal JSON-RPC helpers for read-only public EVM endpoints.
// No wallet, no signing, no keys: only eth_call, eth_getBalance, eth_getCode,
// eth_blockNumber and eth_getLogs against public nodes that answer browsers.

export interface RpcCall {
  method: string;
  params: unknown[];
}

export interface LogEntry {
  address: string;
  topics: string[];
  data: string;
  blockNumber: number;
  transactionHash: string;
}

export interface LogsEndpoint {
  url: string;
  /** Largest block span the endpoint accepts in one eth_getLogs request. */
  maxRange: number;
}

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export const SELECTORS = {
  name: "0x06fdde03",
  symbol: "0x95d89b41",
  decimals: "0x313ce567",
  totalSupply: "0x18160ddd",
  balanceOf: "0x70a08231",
  owner: "0x8da5cb5b",
  // keccak256("totalStaked()") first four bytes; the value equals the staking
  // contract's HIVE balance, which is how the selector was confirmed.
  totalStaked: "0x817b1cd2",
  // Read from projecthive.fun/dashboard.html: pendingCreatorTax(bytes32,address)
  // and pendingFees(bytes32,address) on the Pons MemeHook.
  pendingCreatorTax: "0xc8eaa792",
  pendingFees: "0x359b4f30",
} as const;

export const transferTopic = TRANSFER_TOPIC;

export function padAddress(addr: string): string {
  return addr.toLowerCase().replace(/^0x/, "").padStart(64, "0");
}

export function padUint(n: number | bigint): string {
  return BigInt(n).toString(16).padStart(64, "0");
}

export function callData(selector: string, ...words: string[]): string {
  return selector + words.join("");
}

export function decodeUint(hex: unknown): bigint | null {
  if (typeof hex !== "string" || !/^0x[0-9a-fA-F]*$/.test(hex) || hex === "0x") return null;
  try {
    return BigInt(hex.slice(0, 66));
  } catch {
    return null;
  }
}

export function decodeAddress(hex: unknown): string | null {
  if (typeof hex !== "string" || hex.length < 66) return null;
  return "0x" + hex.slice(26, 66).toLowerCase();
}

export function decodeString(hex: unknown): string | null {
  if (typeof hex !== "string" || hex.length < 130) return null;
  try {
    const len = Number(BigInt("0x" + hex.slice(66, 130)));
    const bytes = hex.slice(130, 130 + len * 2);
    const out = new Uint8Array(len);
    for (let i = 0; i < len; i++) out[i] = parseInt(bytes.slice(i * 2, i * 2 + 2), 16);
    return new TextDecoder().decode(out);
  } catch {
    return null;
  }
}

export function hexToNumber(hex: unknown): number | null {
  if (typeof hex !== "string") return null;
  const n = Number.parseInt(hex, 16);
  return Number.isFinite(n) ? n : null;
}

export function formatUnits(v: bigint | null, decimals = 18, digits = 2): string {
  if (v === null) return "—";
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = abs % base;
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, digits).replace(/0+$/, "");
  const wholeStr = whole.toLocaleString("en-US");
  return (neg ? "-" : "") + wholeStr + (fracStr ? "." + fracStr : "");
}

async function postJson(url: string, body: unknown, timeoutMs = 12000): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

/**
 * Sends one JSON-RPC batch, trying each endpoint in order. Returns results
 * aligned with `calls`; a call that reverted or errored yields null while the
 * rest of the batch keeps its values (one failure never hides another).
 */
export async function rpcBatch(urls: string[], calls: RpcCall[]): Promise<(unknown | null)[]> {
  const body = calls.map((c, i) => ({ jsonrpc: "2.0", id: i + 1, method: c.method, params: c.params }));
  let lastErr: unknown = null;
  for (const url of urls) {
    try {
      const res = await postJson(url, body);
      const arr = Array.isArray(res) ? res : [res];
      const out: (unknown | null)[] = new Array(calls.length).fill(null);
      let any = false;
      for (const r of arr as { id?: number; result?: unknown; error?: unknown }[]) {
        if (typeof r?.id === "number" && r.id >= 1 && r.id <= calls.length && r.result !== undefined && !r.error) {
          out[r.id - 1] = r.result;
          any = true;
        }
      }
      if (any) return out;
      lastErr = new Error("empty batch");
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("rpc failed");
}

export async function blockNumber(urls: string[]): Promise<number | null> {
  try {
    const [r] = await rpcBatch(urls, [{ method: "eth_blockNumber", params: [] }]);
    return hexToNumber(r);
  } catch {
    return null;
  }
}

/**
 * eth_getLogs over an arbitrary block span, split into chunks the endpoint
 * accepts. Tries endpoints in order; the first that completes wins.
 */
export async function getLogs(
  endpoints: LogsEndpoint[],
  filter: { address: string; topics: (string | null)[]; fromBlock: number; toBlock: number },
): Promise<LogEntry[] | null> {
  for (const ep of endpoints) {
    try {
      const out: LogEntry[] = [];
      let from = filter.fromBlock;
      let chunks = 0;
      while (from <= filter.toBlock) {
        const to = Math.min(filter.toBlock, from + ep.maxRange - 1);
        const [res] = await rpcBatch([ep.url], [
          {
            method: "eth_getLogs",
            params: [{ address: filter.address, topics: filter.topics, fromBlock: "0x" + from.toString(16), toBlock: "0x" + to.toString(16) }],
          },
        ]);
        if (!Array.isArray(res)) throw new Error("no logs result");
        for (const l of res as { address: string; topics: string[]; data: string; blockNumber: string; transactionHash: string }[]) {
          out.push({ address: l.address, topics: l.topics, data: l.data, blockNumber: hexToNumber(l.blockNumber) ?? 0, transactionHash: l.transactionHash });
        }
        from = to + 1;
        if (++chunks > 60) break; // safety valve for very old start blocks
      }
      return out;
    } catch {
      // try the next endpoint
    }
  }
  return null;
}
