import { ConfidenceBadge, KindTag, SourceBadge, SourceStateBadge, StatusBadge, VERDICT_HELP, VerdictBadge } from "../components/Badges";
import { EvidenceInline, EvidenceList } from "../components/Evidence";
import { Empty, Section } from "../components/Section";
import { SimCard } from "../components/SimCard";
import { WatchButton } from "../components/WatchButton";
import { chainName } from "../data/chains";
import { HIVE_PROJECT_ID } from "../data/hiveProject";
import { ago, fmtDate, shortAddr } from "../data/sources";
import type { Dashboard } from "../data/store";
import type { AgentRole, FactRow, Project, RiskItem } from "../data/types";
import { hrefFor } from "../router";

const ROLE_ORDER: AgentRole[] = ["Builder", "Reviewer", "Verifier", "Publisher"];
const ROLE_HELP: Record<AgentRole, string> = {
  Builder: "Seats that implemented, tested or integrated the work.",
  Reviewer: "Seats that audited or reviewed the work independently.",
  Verifier: "Who re-ran and checked the submission before it counted.",
  Publisher: "Who pinned, named or deployed the result.",
};

export function ProjectPage({ dash, id }: { dash: Dashboard; id: string }) {
  const now = Date.now();
  const p = dash.projects.find((x) => x.id === id);
  if (!dash.ready) return <p className="muted">Loading project…</p>;
  if (!p) {
    return (
      <Empty
        title="Project not found"
        body="The link may be old or the project may have been renamed."
        action={
          <a className="btn btn-sm" href="#/">
            Back to all projects
          </a>
        }
      />
    );
  }
  const isHive = p.id === HIVE_PROJECT_ID;
  return (
    <>
      <div className="page-head">
        <p className="crumbs">
          <a href="#/">Projects</a> › {p.kind}
        </p>
        <div>
          <KindTag kind={p.kind} />
          <h1>{p.name}</h1>
        </div>
        <p className="lede">{p.purpose || "No public description."}</p>
        <div className="verdict-box" aria-label="Verdict">
          <div className="verdict-line">
            <VerdictBadge verdict={p.verdict} big />
            <ConfidenceBadge confidence={p.confidence} />
            {p.sources.map((s) => (
              <SourceBadge key={s} label={s} ok={s !== "Snapshot"} />
            ))}
          </div>
          <p className="small muted">{VERDICT_HELP[p.verdict]}</p>
          <div className="page-head-row small muted">
            <span>Status: {p.statusText}</span>
            <span>
              Last checked: <time dateTime={p.lastChecked}>{ago(p.lastChecked, now)}</time>
            </span>
            {p.chainId ? <span>Chain: {chainName(p.chainId)}</span> : null}
            {p.paidBy ? (
              <span>
                Requested by <span className="mono">{shortAddr(p.paidBy)}</span>
              </span>
            ) : null}
          </div>
          <div className="page-head-row">
            <WatchButton id={p.id} name={p.name} />
            {p.evidence
              .filter((e) => e.kind === "site" || e.kind === "web")
              .slice(0, 1)
              .map((e) => (
                <a key={e.url} className="btn" href={e.url} target="_blank" rel="noopener noreferrer">
                  Open the project site
                </a>
              ))}
            {p.evidence
              .filter((e) => e.kind === "github")
              .slice(0, 1)
              .map((e) => (
                <a key={e.url} className="btn" href={e.url} target="_blank" rel="noopener noreferrer">
                  View source on GitHub
                </a>
              ))}
          </div>
        </div>
      </div>

      <div className="two-col" style={{ marginBlockEnd: "var(--space-6)" }}>
        <div className="panel">
          <h2>What it promises</h2>
          <p className="small">{p.purpose || "No public request text."}</p>
          {isHive ? <p className="small muted">Quoted claims from the project site are listed under “Claims from the project” below.</p> : null}
        </div>
        <div className="panel">
          <h2>What works</h2>
          {p.works.length ? (
            <ul className="small">
              {p.works.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : (
            <p className="small muted">Nothing confirmed working yet.</p>
          )}
        </div>
        <div className="panel">
          <h2>What is missing</h2>
          {p.missing.length ? (
            <ul className="small">
              {p.missing.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : (
            <p className="small muted">No gaps found in the public record.</p>
          )}
        </div>
        <div className="panel">
          <h2>Risks</h2>
          <RiskList risks={p.risks} />
        </div>
      </div>

      <Section id="promises" title="Promises vs reality" intro="Each promise, its current status, the evidence behind it and when it was last checked.">
        <PromisesTable p={p} now={now} />
      </Section>

      {isHive ? (
        <>
          <Section id="facts" title="Facts and calculations" intro="Read live from Ethereum, Robinhood Chain and the swarm feed. Calculations say how they were made." aside={<HiveSourceBadges dash={dash} />}>
            <FactsTable rows={p.facts.filter((f) => f.kind !== "claim")} />
          </Section>
          <Section id="claims" title="Claims from the project" intro="Quoted from projecthive.fun. These are the project's words, not verified facts.">
            <FactsTable rows={p.facts.filter((f) => f.kind === "claim")} />
          </Section>
        </>
      ) : null}

      <Section id="scores" title="Scores" intro="Transparent 0–100 scores. Open each one to see every point and its reason.">
        <div className="two-col">
          <ScorePanel label="Product" help="Does it work?" value={p.scores.product} reasons={p.scores.reasons.product} />
          <ScorePanel label="Trust" help="Verified contracts, ownership controls and evidence." value={p.scores.trust} reasons={p.scores.reasons.trust} />
          <ScorePanel label="Traction" help="Usage, jobs, agents and recent activity." value={p.scores.traction} reasons={p.scores.reasons.traction} />
        </div>
        <p className="small muted" style={{ marginBlockStart: "var(--space-3)" }}>
          <a href="#/about">Read the full scoring rules</a>.
        </p>
      </Section>

      <Section id="evidence" title="Evidence" intro="Direct links to public websites, IPFS, GitHub, the IdentityMD Explorer, contracts and transactions.">
        <div className="panel">
          <EvidenceList items={p.evidence} />
        </div>
      </Section>

      <Section id="agents" title="Agents involved" intro="Builder, Reviewer, Verifier and Publisher are shown separately. Every known seat gets a SIMCARD linked to its public profile.">
        <AgentsByRole p={p} dash={dash} now={now} />
      </Section>

      {p.jobs.length || p.workflow ? (
        <Section id="history" title="Job history" intro="Every job that touched this project, oldest first.">
          <div className="table-wrap">
            <table className="data responsive">
              <thead>
                <tr>
                  <th scope="col">Job</th>
                  <th scope="col">Kind</th>
                  <th scope="col">State</th>
                  <th scope="col">Created</th>
                  <th scope="col">Steps</th>
                </tr>
              </thead>
              <tbody>
                {p.jobs.map((j) => (
                  <tr key={j.id}>
                    <td data-label="Job">
                      <a href={`https://explorer.imd.fun/jobs/${j.id}`} target="_blank" rel="noopener noreferrer" className="mono">
                        {j.id.slice(0, 8)}
                      </a>
                    </td>
                    <td data-label="Kind">{j.template.replace(/^skill:/, "").replace(/^shape:/, "workflow ")}</td>
                    <td data-label="State">{j.state}</td>
                    <td data-label="Created">{fmtDate(j.createdAt)}</td>
                    <td data-label="Steps">{j.nodes.length ? j.nodes.map((n) => `${n.key} (${n.state})`).join(", ") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}
      <p>
        <a href={hrefFor({ page: "home" })}>← Back to all projects</a>
      </p>
    </>
  );
}

function RiskList({ risks }: { risks: RiskItem[] }) {
  if (!risks.length) return <p className="small muted">No risks documented.</p>;
  const tone = (s: RiskItem["severity"]) => (s === "critical" ? "risk" : s === "warning" ? "caution" : "neutral");
  const label = (s: RiskItem["severity"]) => (s === "critical" ? "Critical" : s === "warning" ? "Warning" : "Note");
  return (
    <ul className="risk-list small">
      {risks.map((r, i) => (
        <li key={i} className="risk">
          <span className={`badge badge-${tone(r.severity)}`}>{label(r.severity)}</span>
          <span>
            {r.text}
            <small>
              Source: {r.source}
              {r.evidence?.length ? (
                <>
                  {" · "}
                  <EvidenceInline items={r.evidence} />
                </>
              ) : null}
            </small>
          </span>
        </li>
      ))}
    </ul>
  );
}

function PromisesTable({ p, now }: { p: Project; now: number }) {
  if (!p.promises.length) return <Empty title="No promises to check yet" body="Only the launch record is public for this project." />;
  return (
    <div className="table-wrap">
      <table className="data responsive">
        <thead>
          <tr>
            <th scope="col">Promise</th>
            <th scope="col">Status</th>
            <th scope="col">Evidence</th>
            <th scope="col">Last checked</th>
          </tr>
        </thead>
        <tbody>
          {p.promises.map((row) => (
            <tr key={row.promise}>
              <td data-label="Promise">
                {row.promise}
                {row.note ? <span className="cell-note">{row.note}</span> : null}
              </td>
              <td data-label="Status">
                <StatusBadge status={row.status} />
              </td>
              <td data-label="Evidence">
                <EvidenceInline items={row.evidence} />
              </td>
              <td data-label="Last checked">
                {row.lastChecked ? <time dateTime={row.lastChecked}>{ago(row.lastChecked, now)}</time> : "not checked live"}
                <span className="cell-note">{row.source}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FactsTable({ rows }: { rows: FactRow[] }) {
  return (
    <div className="table-wrap">
      <table className="data responsive">
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col">Value</th>
            <th scope="col">Type</th>
            <th scope="col">Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td data-label="Item">
                {r.label}
                {r.note ? <span className="cell-note">{r.note}</span> : null}
              </td>
              <td data-label="Value" className={r.kind === "claim" ? "" : "num"}>
                {r.value}
              </td>
              <td data-label="Type">
                <span className={`badge ${r.kind === "fact" ? "badge-good" : r.kind === "calculation" ? "badge-caution" : "badge-neutral"}`}>{r.kind === "fact" ? "Confirmed fact" : r.kind === "calculation" ? "Calculation" : "Unverified claim"}</span>
              </td>
              <td data-label="Source">
                <SourceBadge label={r.source} ok={r.source !== "Snapshot"} />
                {r.evidence?.length ? (
                  <span className="cell-note">
                    <EvidenceInline items={r.evidence} />
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScorePanel({ label, help, value, reasons }: { label: string; help: string; value: number | null; reasons: string[] }) {
  const tone = value === null ? "" : value >= 70 ? "meter-good" : value >= 40 ? "meter-caution" : "meter-risk";
  return (
    <div className="panel score">
      <div className="score-row">
        <h3>{label}</h3>
        <span className="score-value">{value === null ? "Insufficient data" : `${value}/100`}</span>
      </div>
      <p className="small muted">{help}</p>
      <div className={`meter ${tone}`} role="img" aria-label={value === null ? `${label}: insufficient data` : `${label} ${value} out of 100`}>
        <span style={{ width: `${value ?? 0}%` }} />
      </div>
      <details>
        <summary>How this was scored</summary>
        {reasons.length ? (
          <ul>
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        ) : (
          <p>No signal available for this dimension, so no score is shown.</p>
        )}
      </details>
    </div>
  );
}

function HiveSourceBadges({ dash }: { dash: Dashboard }) {
  return (
    <div className="inline-list">
      <SourceStateBadge state={dash.hive.eth.state} />
      <SourceStateBadge state={dash.hive.rh.state} />
      <SourceStateBadge state={dash.live.swarm.state} />
    </div>
  );
}

function AgentsByRole({ p, dash, now }: { p: Project; dash: Dashboard; now: number }) {
  return (
    <div className="stack" style={{ gap: "var(--space-5)" }}>
      {ROLE_ORDER.map((role) => {
        const items = p.agents.filter((a) => a.role === role);
        return (
          <div key={role} className="stack">
            <h3>
              {role}
              {items.length ? <span className="badge badge-outline">{items.length}</span> : null}
            </h3>
            <p className="small muted">{ROLE_HELP[role]}</p>
            {items.length ? (
              <div className="grid">
                {items.map((a) =>
                  a.tokenId.startsWith("service:") ? (
                    <div key={a.tokenId + a.role} className="panel small">
                      <strong>{a.tokenId === "service:verifier" ? "IdentityMD verifier service" : a.tokenId === "service:publisher" ? "IdentityMD publisher service" : "IdentityMD deployer service"}</strong>
                      <span className="muted">{a.detail}</span>
                    </div>
                  ) : (
                    <SimCard key={a.tokenId + a.role} agent={dash.agentCard(a.tokenId)} role={role} detail={a.detail} now={now} />
                  ),
                )}
              </div>
            ) : (
              <p className="small muted">No {role.toLowerCase()} recorded.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

