import { useState } from "react";
import type { AgentCard } from "../data/agents";
import { agentAvatarUrl, agentProfileUrl } from "../data/chains";
import { ago, shortAddr } from "../data/sources";
import { SourceBadge } from "./Badges";

export function SimCard({ agent, role, detail, now }: { agent: AgentCard; role?: string; detail?: string; now: number }) {
  const [imgOk, setImgOk] = useState(true);
  const a = agent;
  const rate = a.acceptanceRate === null ? "Insufficient data" : `${Math.round(a.acceptanceRate * 100)}%`;
  const statusText = a.status === "working" ? "Working now" : a.status === "online" ? "Online" : a.status === "enrolled" ? "Enrolled" : a.status === "active" ? "Active" : a.status === "offline" ? "Offline" : "Unknown";
  return (
    <article className="simcard" aria-label={`SIMCARD for seat ${a.tokenId}`}>
      <div className="simcard-chip" aria-hidden="true">
        {imgOk ? <img src={agentAvatarUrl(a.tokenId)} alt="" width={48} height={48} loading="lazy" onError={() => setImgOk(false)} /> : null}
      </div>
      <div className="simcard-head">
        <div className="simcard-role">{role ?? "Agent"}</div>
        <div className="simcard-id">
          <a href={agentProfileUrl(a.tokenId)} target="_blank" rel="noopener noreferrer">
            NFT #{a.tokenId}
          </a>
        </div>
        {detail ? <div className="small muted">{detail}</div> : null}
      </div>
      <dl className="simcard-grid">
        <div>
          <dt>Agent ID</dt>
          <dd className="mono">{a.agentId ?? "not enrolled"}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <span className="live-dot" data-active={a.status === "working" || a.status === "online" ? "true" : "false"} aria-hidden="true" style={{ marginInlineEnd: "0.4em", background: a.status === "offline" || a.status === "unknown" ? "var(--color-border-strong)" : undefined }} />
            {statusText}
          </dd>
        </div>
        <div>
          <dt>Accepted work</dt>
          <dd>{a.accepted === null ? "Insufficient data" : `${a.accepted.toLocaleString()} of ${(a.attempts ?? 0).toLocaleString()}`}</dd>
        </div>
        <div>
          <dt>Acceptance rate</dt>
          <dd>{rate}</dd>
        </div>
        <div>
          <dt>Runtime</dt>
          <dd>{a.runtime ?? "Insufficient data"}</dd>
        </div>
        <div>
          <dt>Last work</dt>
          <dd>{a.lastWorkedAt ? ago(a.lastWorkedAt, now) : "unknown"}</dd>
        </div>
        <div>
          <dt>Owner</dt>
          <dd className="mono" title={a.owner ?? undefined}>
            {a.ownerName ?? shortAddr(a.owner)}
            {a.held ? ` · holds ${a.held}` : ""}
          </dd>
        </div>
        <div>
          <dt>Paired</dt>
          <dd>{a.pairedAt ? ago(a.pairedAt, now) : "unknown"}</dd>
        </div>
      </dl>
      <div className="simcard-foot">
        <SourceBadge label={a.workSource} ok={a.workSource !== "Snapshot"} />
        <a href={agentProfileUrl(a.tokenId)} target="_blank" rel="noopener noreferrer">
          Open agent profile
        </a>
      </div>
    </article>
  );
}
