// Public chain metadata and explorer link builders. Only chains that appear in
// IdentityMD data are listed.

export interface ChainInfo {
  id: number;
  name: string;
  short: string;
  testnet: boolean;
  explorer: string;
}

export const CHAINS: Record<number, ChainInfo> = {
  1: { id: 1, name: "Ethereum mainnet", short: "Ethereum", testnet: false, explorer: "https://etherscan.io" },
  11155111: { id: 11155111, name: "Sepolia testnet", short: "Sepolia", testnet: true, explorer: "https://sepolia.etherscan.io" },
  8453: { id: 8453, name: "Base", short: "Base", testnet: false, explorer: "https://basescan.org" },
  4663: { id: 4663, name: "Robinhood Chain", short: "Robinhood", testnet: false, explorer: "https://robinhoodchain.blockscout.com" },
};

export function chainName(id: number | null | undefined): string {
  if (id === null || id === undefined) return "unknown chain";
  return CHAINS[id]?.name ?? `chain ${id}`;
}

export function isTestnet(id: number | null | undefined): boolean {
  return id !== null && id !== undefined ? CHAINS[id]?.testnet ?? false : false;
}

export function addressUrl(chainId: number, address: string): string {
  const base = CHAINS[chainId]?.explorer ?? "https://etherscan.io";
  return `${base}/address/${address}`;
}

export function txUrl(chainId: number, hash: string): string {
  const base = CHAINS[chainId]?.explorer ?? "https://etherscan.io";
  return `${base}/tx/${hash}`;
}

export function tokenUrl(chainId: number, token: string, holder?: string): string {
  const base = CHAINS[chainId]?.explorer ?? "https://etherscan.io";
  return holder ? `${base}/token/${token}?a=${holder}` : `${base}/token/${token}`;
}

export function nftUrl(collection: string, tokenId: string | number): string {
  return `https://etherscan.io/nft/${collection}/${tokenId}`;
}

export function ipfsUrl(cid: string): string {
  return `https://ipfs.io/ipfs/${cid}/`;
}

export function agentProfileUrl(tokenId: string | number): string {
  return `https://explorer.imd.fun/agents/${tokenId}`;
}

export function explorerJobUrl(id: string): string {
  return `https://explorer.imd.fun/jobs/${id}`;
}

export function agentAvatarUrl(tokenId: string | number): string {
  return `https://api.imd.fun/agents/by-token/${tokenId}.svg`;
}
