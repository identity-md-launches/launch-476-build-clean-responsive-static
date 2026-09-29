import type { EvidenceLink } from "../data/types";

const KIND_LABEL: Record<EvidenceLink["kind"], string> = {
  site: "Website",
  ipfs: "IPFS",
  github: "GitHub",
  explorer: "Explorer",
  contract: "Contract",
  tx: "Transaction",
  api: "API",
  research: "Research",
  agent: "Agent",
  web: "Web",
};

export function EvidenceList({ items, compact = false }: { items: EvidenceLink[]; compact?: boolean }) {
  if (!items.length) return <p className="muted small">No public evidence link yet.</p>;
  return (
    <ul className={`evidence ${compact ? "small" : ""}`}>
      {items.map((e) => (
        <li key={e.url + e.label}>
          <span className="kind-tag">{KIND_LABEL[e.kind]}</span>
          <a href={e.url} target="_blank" rel="noopener noreferrer">
            {e.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function EvidenceInline({ items }: { items: EvidenceLink[] }) {
  if (!items.length) return <span className="muted">none yet</span>;
  return (
    <span className="inline-list">
      {items.map((e, i) => (
        <a key={e.url + i} href={e.url} target="_blank" rel="noopener noreferrer">
          {e.label}
        </a>
      ))}
    </span>
  );
}
