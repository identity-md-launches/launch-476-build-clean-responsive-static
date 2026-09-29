import type { Confidence, PromiseStatus, SourceLabel, SourceState, Verdict } from "../data/types";
import { ago } from "../data/sources";

export const VERDICT_TONE: Record<Verdict, "good" | "caution" | "warn" | "risk" | "neutral"> = {
  VERIFIED: "good",
  PROMISING: "caution",
  SPECULATIVE: "warn",
  "HIGH RISK": "risk",
  UNVERIFIED: "neutral",
};

const VERDICT_GLYPH: Record<Verdict, string> = {
  VERIFIED: "✓",
  PROMISING: "◐",
  SPECULATIVE: "?",
  "HIGH RISK": "!",
  UNVERIFIED: "·",
};

export const VERDICT_HELP: Record<Verdict, string> = {
  VERIFIED: "Public evidence backs the main promises.",
  PROMISING: "Delivered work exists, but the claims are not independently checked.",
  SPECULATIVE: "Something exists, but trust signals are thin.",
  "HIGH RISK": "A documented risk contradicts a promise or blocks the project.",
  UNVERIFIED: "Not enough evidence to judge.",
};

export function VerdictBadge({ verdict, big = false }: { verdict: Verdict; big?: boolean }) {
  const tone = VERDICT_TONE[verdict];
  if (big) {
    return (
      <span className={`verdict-big verdict-${tone}`}>
        <span aria-hidden="true">{VERDICT_GLYPH[verdict]} </span>
        {verdict}
      </span>
    );
  }
  return (
    <span className={`badge badge-${tone}`} title={VERDICT_HELP[verdict]}>
      <span aria-hidden="true">{VERDICT_GLYPH[verdict]}</span>
      {verdict}
    </span>
  );
}

export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  return (
    <span className="badge badge-outline" title="How many independent source families back this page">
      Evidence confidence: {confidence}
    </span>
  );
}

const STATUS_TONE: Record<PromiseStatus, "good" | "caution" | "warn" | "risk" | "neutral"> = {
  Delivered: "good",
  Partial: "caution",
  Pending: "neutral",
  Broken: "risk",
  Unverified: "neutral",
};
const STATUS_GLYPH: Record<PromiseStatus, string> = { Delivered: "✓", Partial: "◐", Pending: "…", Broken: "✕", Unverified: "?" };

export function StatusBadge({ status }: { status: PromiseStatus }) {
  return (
    <span className={`badge badge-${STATUS_TONE[status]}`}>
      <span aria-hidden="true">{STATUS_GLYPH[status]}</span>
      {status}
    </span>
  );
}

export function SourceBadge({ label, at, ok }: { label: SourceLabel; at?: string | null; ok?: boolean }) {
  const live = ok === true && label !== "Snapshot";
  const text = at ? `${label} · ${ago(at)}` : label;
  const title =
    label === "Snapshot"
      ? "Copied from public IdentityMD data when this site was built."
      : ok === false
        ? `Last confirmed value; the ${label.toLowerCase()} source is not reachable from this browser right now.`
        : `${label} data, refreshed while this page is open.`;
  return (
    <span className="badge badge-source" data-live={live ? "true" : "false"} title={title}>
      {live ? <span className="dot" aria-hidden="true" /> : null}
      {text}
    </span>
  );
}

export function SourceStateBadge({ state }: { state: SourceState }) {
  return <SourceBadge label={state.at ? state.label : "Snapshot"} at={state.at} ok={state.ok} />;
}

export function KindTag({ kind }: { kind: string }) {
  return <span className="card-kind">{kind}</span>;
}
