import type { Project } from "../data/types";
import { ago } from "../data/sources";
import { hrefFor } from "../router";
import { ConfidenceBadge, KindTag, SourceBadge, VerdictBadge } from "./Badges";
import { WatchButton } from "./WatchButton";

export function ProjectCard({ project, now }: { project: Project; now: number }) {
  const p = project;
  const primarySource = p.sources[0] ?? "Snapshot";
  return (
    <article className="card" aria-labelledby={`card-${cssId(p.id)}`}>
      <div className="card-top">
        <div>
          <KindTag kind={p.kind} />
          <h3 className="card-title" id={`card-${cssId(p.id)}`}>
            <a href={hrefFor({ page: "project", id: p.id })}>{p.name}</a>
          </h3>
        </div>
        <VerdictBadge verdict={p.verdict} />
      </div>
      <p className="card-purpose">{p.purpose || "No public description."}</p>
      <dl className="card-meta">
        <dt>Confidence</dt>
        <dd>{p.confidence}</dd>
        <dt>Updated</dt>
        <dd>
          <time dateTime={p.updatedAt}>{ago(p.updatedAt, now)}</time>
        </dd>
        <dt>Builder</dt>
        <dd>{p.builder}</dd>
        <dt>Status</dt>
        <dd>{p.statusText}</dd>
      </dl>
      <div className="card-foot">
        <div className="card-badges">
          <SourceBadge label={primarySource} ok={primarySource !== "Snapshot"} />
          <span className="visually-hidden">
            <ConfidenceBadge confidence={p.confidence} />
          </span>
        </div>
        <WatchButton id={p.id} name={p.name} small />
      </div>
    </article>
  );
}

export function cssId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}
