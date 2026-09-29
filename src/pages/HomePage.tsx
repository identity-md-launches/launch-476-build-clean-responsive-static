import { useEffect, useMemo, useState } from "react";
import { SAFETY_LINE } from "../copy";
import { SourceStateBadge, VERDICT_HELP } from "../components/Badges";
import { ProjectCard } from "../components/ProjectCard";
import { Empty, Section } from "../components/Section";
import { SimCard } from "../components/SimCard";
import { useWatchlist } from "../components/WatchButton";
import type { Dashboard } from "../data/store";
import type { FilterKey, Project, Verdict } from "../data/types";
import { ago } from "../data/sources";
import { hrefFor } from "../router";

const DAY = 86_400_000;
const FILTERS: { key: FilterKey; label: string; verdict?: Verdict }[] = [
  { key: "all", label: "All" },
  { key: "verified", label: "Verified", verdict: "VERIFIED" },
  { key: "promising", label: "Promising", verdict: "PROMISING" },
  { key: "speculative", label: "Speculative", verdict: "SPECULATIVE" },
  { key: "risk", label: "High risk", verdict: "HIGH RISK" },
  { key: "unverified", label: "Unverified", verdict: "UNVERIFIED" },
];

function readQuery(): { q: string; f: FilterKey } {
  const m = window.location.hash.match(/\?(.*)$/);
  const sp = new URLSearchParams(m ? m[1] : "");
  const f = sp.get("filter") as FilterKey | null;
  return { q: sp.get("q") ?? "", f: f && FILTERS.some((x) => x.key === f) ? f : "all" };
}

export function HomePage({ dash }: { dash: Dashboard }) {
  const [{ q, f }, setQuery] = useState(readQuery);
  const [showAll, setShowAll] = useState(24);
  const watch = useWatchlist();
  const now = Date.now();
  const projects = dash.projects;

  useEffect(() => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (f !== "all") sp.set("filter", f);
    const next = "#/" + (sp.toString() ? `?${sp}` : "");
    if (window.location.hash !== next && (window.location.hash === "" || window.location.hash.startsWith("#/?") || window.location.hash === "#/")) {
      window.history.replaceState(null, "", next);
    }
  }, [q, f]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of projects) c[p.verdict] = (c[p.verdict] ?? 0) + 1;
    return c;
  }, [projects]);

  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const active = terms.length > 0 || f !== "all";
  const filtered = useMemo(() => {
    const verdict = FILTERS.find((x) => x.key === f)?.verdict;
    return projects.filter((p) => (!verdict || p.verdict === verdict) && terms.every((t) => p.searchText.includes(t)));
  }, [projects, f, terms.join(" ")]);

  const agentHits = useMemo(() => {
    if (!terms.length) return [] as string[];
    const hits = new Set<string>();
    for (const t of terms) {
      const id = t.replace(/^#/, "");
      if (/^\d+$/.test(id)) {
        if (dash.agentIds.includes(id)) hits.add(id);
        for (const aid of dash.agentIds) {
          const card = dash.agentCard(aid);
          if (card.agentId === id) hits.add(aid);
        }
      }
    }
    return [...hits].slice(0, 6);
  }, [terms.join(" "), dash]);

  const newToday = projects.filter((p) => now - Date.parse(p.createdAt) < DAY);
  const verified = projects.filter((p) => p.verdict === "VERIFIED");
  const early = projects.filter((p) => now - Date.parse(p.createdAt) < 7 * DAY && p.jobs.length <= 2 && p.verdict !== "HIGH RISK" && !p.featured);
  const changed = dash.history?.previous ? diffProjects(projects, dash.history.previous.projects) : [];
  const riskChanges = projects.filter((p) => p.verdict === "HIGH RISK" && (now - Date.parse(p.updatedAt) < 3 * DAY || changed.some((c) => c.id === p.id)));
  const hiddenGems = projects.filter((p) => (p.scores.product ?? 0) >= 60 && (p.scores.traction ?? 0) <= 40 && now - Date.parse(p.createdAt) > DAY && p.verdict !== "HIGH RISK" && !p.featured);
  const builders = useMemo(() => {
    const acc = new Map<string, number>();
    for (const p of projects) for (const a of p.agents) if (a.role === "Builder" && !a.tokenId.startsWith("service:")) acc.set(a.tokenId, (acc.get(a.tokenId) ?? 0) + 1);
    return [...acc.entries()]
      .map(([id, n]) => ({ id, n, card: dash.agentCard(id) }))
      .sort((a, b) => (b.card.accepted ?? 0) - (a.card.accepted ?? 0))
      .slice(0, 8);
  }, [projects, dash]);
  const watched = projects.filter((p) => watch.includes(p.id));
  const health = dash.live.swarm.data?.health ?? dash.snapshot?.swarm?.health ?? null;
  const counts2 = dash.live.swarm.data?.counts ?? dash.snapshot?.swarm?.counts ?? null;

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <h1 id="hero-title">Every IdentityMD project, with its promises checked</h1>
        <p className="hero-lead">
          Swarm Alpha gathers the projects built on the IdentityMD swarm and explains, in plain words, what each one promises, what already works, what is missing and how far the evidence goes.
        </p>
        <p className="notice" role="note">
          <span aria-hidden="true">ⓘ</span>
          <span>
            <strong>{SAFETY_LINE}</strong> Facts, calculations and unverified claims are labelled separately on every page.
          </span>
        </p>
        <div className="pulse" aria-label="Swarm pulse">
          <div className="pulse-item">
            <span className="pulse-value">{health ? health.agentsOnline.toLocaleString() : "—"}</span>
            <span className="pulse-label">agents online</span>
          </div>
          <div className="pulse-item">
            <span className="pulse-value">{health ? health.workingNow.toLocaleString() : "—"}</span>
            <span className="pulse-label">working right now</span>
          </div>
          <div className="pulse-item">
            <span className="pulse-value">{health ? health.acceptedLastDay.toLocaleString() : "—"}</span>
            <span className="pulse-label">steps accepted in 24 h</span>
          </div>
          <div className="pulse-item">
            <span className="pulse-value">{counts2 ? counts2.sites.toLocaleString() : "—"}</span>
            <span className="pulse-label">live sites</span>
          </div>
          <div className="pulse-item">
            <span className="pulse-value">{projects.length.toLocaleString()}</span>
            <span className="pulse-label">projects tracked</span>
          </div>
        </div>
        <div className="status-line" role="status" aria-live="polite">
          <SourceStateBadge state={dash.live.swarm.state} />
          <span>Swarm feed refreshes every 10 seconds while this tab is open{dash.lastRefresh ? ` · last check ${ago(dash.lastRefresh, now)}` : ""}.</span>
          {dash.snapshot ? <span>Snapshot built {ago(dash.snapshot.generatedAt, now)}.</span> : null}
        </div>
      </section>

      <div className="toolbar">
        <div className="search">
          <label htmlFor="search">Search by project, contract, agent ID or NFT ID</label>
          <div className="search-row">
            <input
              id="search"
              type="search"
              value={q}
              placeholder="e.g. HIVE, 0xCdaE63…, 1639, site-b7794925"
              autoComplete="off"
              enterKeyHint="search"
              onChange={(e) => setQuery({ q: e.target.value, f })}
            />
            {active ? (
              <button type="button" className="btn" onClick={() => setQuery({ q: "", f: "all" })}>
                Clear filters
              </button>
            ) : null}
          </div>
        </div>
        <div className="chips" role="group" aria-label="Filter by verdict">
          {FILTERS.map((x) => (
            <button key={x.key} type="button" className="chip" aria-pressed={f === x.key} onClick={() => setQuery({ q, f: x.key })} title={x.verdict ? VERDICT_HELP[x.verdict] : "Every project"}>
              {x.label}
              <span className="chip-count">{x.verdict ? (counts[x.verdict] ?? 0) : projects.length}</span>
            </button>
          ))}
        </div>
      </div>

      {!dash.ready ? <p className="muted">Loading projects…</p> : null}

      {active ? (
        <Section id="results" title={`${filtered.length + agentHits.length} result${filtered.length + agentHits.length === 1 ? "" : "s"}`} intro={terms.length ? `Matching “${q.trim()}”${f !== "all" ? ` in ${FILTERS.find((x) => x.key === f)?.label}` : ""}.` : `Projects with the verdict ${FILTERS.find((x) => x.key === f)?.label}.`}>
          {agentHits.length ? (
            <div className="grid" style={{ marginBlockEnd: "var(--space-4)" }}>
              {agentHits.map((id) => (
                <SimCard key={id} agent={dash.agentCard(id)} now={now} role="Agent" />
              ))}
            </div>
          ) : null}
          {filtered.length ? (
            <div className="grid">
              {filtered.slice(0, 60).map((p) => (
                <ProjectCard key={p.id} project={p} now={now} />
              ))}
            </div>
          ) : !agentHits.length ? (
            <Empty
              title={`No results for “${q.trim() || FILTERS.find((x) => x.key === f)?.label}”`}
              body="Try a project name, a contract address, a job ID, a seat number or an agent ID."
              action={
                <button type="button" className="btn btn-sm" onClick={() => setQuery({ q: "", f: "all" })}>
                  Clear filters
                </button>
              }
            />
          ) : null}
        </Section>
      ) : (
        <>
          {watched.length ? (
            <Section id="watchlist" title="Your watchlist" intro="Saved in this browser only. No login, nothing sent anywhere.">
              <div className="grid">
                {watched.map((p) => (
                  <ProjectCard key={p.id} project={p} now={now} />
                ))}
              </div>
            </Section>
          ) : null}

          <Section id="since-yesterday" title="Since yesterday" intro="What changed compared with the note this browser kept from the previous day.">
            <SinceYesterday dash={dash} projects={projects} changed={changed} newToday={newToday} now={now} />
          </Section>

          <Section id="new-today" title="New today" intro={newToday.length > 12 ? `${newToday.length} projects started in the last 24 hours; the 12 most recent are shown here and all of them are in the full list below.` : "Projects that started in the last 24 hours."}>
            <Cards items={newToday.slice(0, 12)} now={now} emptyTitle="Nothing new in the last 24 hours" emptyBody="New jobs and launches appear here as soon as the swarm picks them up." />
          </Section>

          <Section id="promises-verified" title="Promises verified" intro="Public evidence backs the main promises: delivered, reviewed and recorded.">
            <Cards items={verified.slice(0, 12)} now={now} emptyTitle="No project has earned VERIFIED yet" emptyBody="A project needs Product 70+, Trust 50+ and no broken promise." />
          </Section>

          <Section id="early-projects" title="Early projects" intro="Less than a week old with one or two steps done. Early means unproven.">
            <Cards items={early.slice(0, 12)} now={now} emptyTitle="No early projects right now" />
          </Section>

          <Section id="risk-changes" title="Risk changes" intro="Projects that recently became HIGH RISK, or whose verdict moved since yesterday.">
            <Cards items={riskChanges.slice(0, 12)} now={now} emptyTitle="No new risk changes" emptyBody="High-risk projects that changed in the last three days show here." />
          </Section>

          <Section id="hidden-gems" title="Hidden gems" intro="Working output with little follow-up attention so far.">
            <Cards items={hiddenGems.slice(0, 12)} now={now} emptyTitle="No hidden gems found" />
          </Section>

          <Section id="top-builders" title="Top builders" intro="Seats with the most accepted work across the tracked projects. Each SIMCARD links to the public agent profile.">
            {builders.length ? (
              <div className="grid">
                {builders.map((b) => (
                  <SimCard key={b.id} agent={b.card} now={now} role="Builder" detail={`${b.n} tracked project${b.n === 1 ? "" : "s"}`} />
                ))}
              </div>
            ) : (
              <Empty title="No builder data yet" />
            )}
          </Section>

          <Section id="all-projects" title="All projects" intro="Every tracked IdentityMD project, newest activity first, including historical launches.">
            <div className="grid">
              {projects.slice(0, showAll).map((p) => (
                <ProjectCard key={p.id} project={p} now={now} />
              ))}
            </div>
            {projects.length > showAll ? (
              <p style={{ marginBlockStart: "var(--space-4)" }}>
                <button type="button" className="btn" onClick={() => setShowAll((n) => n + 24)}>
                  Show more projects ({projects.length - showAll} left)
                </button>
              </p>
            ) : null}
          </Section>
        </>
      )}
    </>
  );
}

function Cards({ items, now, emptyTitle, emptyBody }: { items: Project[]; now: number; emptyTitle: string; emptyBody?: string }) {
  if (!items.length) return <Empty title={emptyTitle} body={emptyBody} />;
  return (
    <div className="grid">
      {items.map((p) => (
        <ProjectCard key={p.id} project={p} now={now} />
      ))}
    </div>
  );
}

interface Change {
  id: string;
  name: string;
  text: string;
}

function diffProjects(projects: Project[], prev: Record<string, { verdict: string; status: string }>): Change[] {
  const out: Change[] = [];
  for (const p of projects) {
    const old = prev[p.id];
    if (!old) continue;
    if (old.verdict !== p.verdict) out.push({ id: p.id, name: p.name, text: `verdict ${old.verdict} → ${p.verdict}` });
    else if (old.status !== p.status) out.push({ id: p.id, name: p.name, text: `status ${old.status} → ${p.status}` });
  }
  return out;
}

function SinceYesterday({ dash, projects, changed, newToday, now }: { dash: Dashboard; projects: Project[]; changed: Change[]; newToday: Project[]; now: number }) {
  const prev = dash.history?.previous ?? null;
  const today = dash.history?.today ?? null;
  const added = prev ? projects.filter((p) => !prev.projects[p.id]) : newToday;
  const healthDelta =
    prev?.health && today?.health
      ? [
          { label: "agents online", d: today.health.agentsOnline - prev.health.agentsOnline },
          { label: "seats enrolled", d: today.health.seatsEnrolled - prev.health.seatsEnrolled },
          { label: "live sites", d: today.health.sites - prev.health.sites },
          { label: "live launches", d: today.health.launchesLive - prev.health.launchesLive },
        ].filter((x) => x.d !== 0)
      : [];
  const live = dash.live.swarm.data?.health;
  return (
    <div className="panel">
      {!prev ? (
        <p className="muted small">
          First visit on this browser: a daily note of every verdict was saved just now, so from tomorrow this section shows what moved. Until then it lists projects that started in the last 24 hours.
        </p>
      ) : (
        <p className="muted small">
          Compared with {prev.date}. {changed.length} verdict or status change{changed.length === 1 ? "" : "s"}, {added.length} new project{added.length === 1 ? "" : "s"}.
        </p>
      )}
      <ul className="delta-list">
        {live ? (
          <li>
            <strong className="num">{live.acceptedLastDay.toLocaleString()}</strong> work steps accepted by the swarm in the last 24 hours ({live.jobsDoneLastDay.toLocaleString()} jobs done).
          </li>
        ) : null}
        {healthDelta.map((x) => (
          <li key={x.label}>
            <strong className="num">
              {x.d > 0 ? "+" : ""}
              {x.d.toLocaleString()}
            </strong>{" "}
            {x.label}
          </li>
        ))}
        {changed.slice(0, 8).map((c) => (
          <li key={c.id}>
            <a href={hrefFor({ page: "project", id: c.id })}>{c.name}</a> <span className="muted">{c.text}</span>
          </li>
        ))}
        {added.slice(0, 8).map((p) => (
          <li key={p.id}>
            <a href={hrefFor({ page: "project", id: p.id })}>{p.name}</a> <span className="muted">new · {ago(p.createdAt, now)}</span>
          </li>
        ))}
        {!changed.length && !added.length && !healthDelta.length && !live ? <li className="muted">No changes recorded yet.</li> : null}
      </ul>
    </div>
  );
}
