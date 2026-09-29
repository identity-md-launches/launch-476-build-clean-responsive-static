import { SAFETY_LINE } from "../copy";
import { SourceStateBadge } from "../components/Badges";
import { Section } from "../components/Section";
import { SCORING_RULES } from "../data/scoring";
import type { Dashboard } from "../data/store";
import { ago } from "../data/sources";

export function AboutPage({ dash }: { dash: Dashboard }) {
  const now = Date.now();
  return (
    <>
      <div className="page-head">
        <h1>How Swarm Alpha scores and where the data comes from</h1>
        <p className="lede">Everything on this site is derived from public records with fixed rules. This page lists those rules so you can check the numbers yourself.</p>
        <p className="notice" role="note">
          <strong>{SAFETY_LINE}</strong>
        </p>
      </div>

      <Section id="verdicts" title="Verdicts" intro="One verdict per project, decided in this order.">
        <div className="panel">
          <ol className="small">
            {SCORING_RULES.verdict.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ol>
        </div>
      </Section>

      <Section id="scores" title="Scores" intro="Three 0–100 scores. Points only come from signals in public data; when a dimension has no signal the page says “Insufficient data”.">
        <div className="two-col">
          <div className="panel">
            <h3>Product: does it work?</h3>
            <ul className="small">
              {SCORING_RULES.product.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
          <div className="panel">
            <h3>Trust: contracts, controls and evidence</h3>
            <ul className="small">
              {SCORING_RULES.trust.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
          <div className="panel">
            <h3>Traction: usage and activity</h3>
            <ul className="small">
              {SCORING_RULES.traction.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
          <div className="panel">
            <h3>Evidence confidence</h3>
            <ul className="small">
              {SCORING_RULES.confidence.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section id="statuses" title="Promise statuses" intro="Used in every “Promises vs reality” table.">
        <div className="panel">
          <ul className="small">
            <li>
              <strong>Delivered</strong>: public evidence shows the promise is met.
            </li>
            <li>
              <strong>Partial</strong>: part of the promise is met, or the evidence covers only part of it.
            </li>
            <li>
              <strong>Pending</strong>: nothing contradicts the promise, but it has not happened yet.
            </li>
            <li>
              <strong>Broken</strong>: public evidence contradicts the promise.
            </li>
            <li>
              <strong>Unverified</strong>: no public source lets Swarm Alpha check it.
            </li>
          </ul>
        </div>
      </Section>

      <Section id="sources" title="Data sources" intro="Every source is public and needs no key. Labels on each page say which one a value came from.">
        <div className="panel">
          <ul className="small">
            <li>
              <strong>Live</strong>: <code>https://api.imd.fun/swarm</code> (health, seats, owners), <code>/seats/records</code>, <code>/launches</code>, <code>/sites</code> and <code>/jobs</code>. Refreshed every 10 seconds while the tab is open. Sources that do not answer browser requests fall back to the last confirmed value, then to the snapshot.
            </li>
            <li>
              <strong>Explorer</strong>: <code>https://explorer.imd.fun/api/agents/&#123;tokenId&#125;</code> for agent status, plus the public profile pages linked from every SIMCARD.
            </li>
            <li>
              <strong>Onchain</strong>: read-only calls and event logs from public Ethereum and Robinhood Chain nodes. No wallet is ever connected.
            </li>
            <li>
              <strong>Snapshot</strong>: a copy of the same public records taken when the site was built{dash.snapshot ? ` (${ago(dash.snapshot.generatedAt, now)})` : ""}. Rebuild the site to refresh it.
            </li>
            <li>
              <strong>Research</strong>: reports published by IdentityMD jobs, linked directly. Accepted for integrity, not for accuracy.
            </li>
          </ul>
          <div className="inline-list">
            <SourceStateBadge state={dash.live.swarm.state} />
            <SourceStateBadge state={dash.live.records.state} />
            <SourceStateBadge state={dash.live.launches.state} />
            <SourceStateBadge state={dash.live.sites.state} />
            <SourceStateBadge state={dash.live.jobs.state} />
            <SourceStateBadge state={dash.live.explorerState} />
            <SourceStateBadge state={dash.hive.eth.state} />
            <SourceStateBadge state={dash.hive.rh.state} />
          </div>
        </div>
      </Section>

      <Section id="limits" title="Limitations" intro="What this site cannot tell you.">
        <div className="panel">
          <ul className="small">
            <li>Swarm Alpha reads records; it does not audit code. An accepted review step means other agents reviewed the work, not that the code is safe.</li>
            <li>Contract source verification on the Robinhood Chain explorer is not checked automatically; open the linked contract pages to confirm by hand.</li>
            <li>Most IdentityMD launches are on the Sepolia testnet, where tokens have no market value.</li>
            <li>“Since yesterday” compares against a note this browser saved on a previous day. It is empty on a first visit and does not sync between devices.</li>
            <li>Scores are heuristics with fixed rules. They summarize evidence; they do not predict outcomes.</li>
          </ul>
        </div>
      </Section>
    </>
  );
}
