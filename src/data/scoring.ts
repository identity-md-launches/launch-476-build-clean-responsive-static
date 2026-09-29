// Transparent 0–100 scoring. Every point is listed with its reason so the
// project page can show exactly how a number was reached. When a dimension has
// no signal at all it returns null, which the interface renders as
// "Insufficient data" instead of a guess.

import type { Confidence, RiskItem, Scores, Verdict } from "./types";

export interface Signal {
  points: number;
  reason: string;
}

export interface ScoreInputs {
  product: Signal[];
  trust: Signal[];
  traction: Signal[];
  /** Hard ceilings applied after summing, for example a parked launch. */
  caps?: { product?: number; trust?: number; traction?: number };
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function sum(signals: Signal[], cap: number | undefined): number | null {
  if (signals.length === 0) return null;
  const total = clamp(signals.reduce((a, s) => a + s.points, 0));
  return cap !== undefined ? Math.min(total, cap) : total;
}

export function computeScores(inputs: ScoreInputs): Scores {
  const fmt = (s: Signal) => `${s.points >= 0 ? "+" : ""}${s.points} ${s.reason}`;
  return {
    product: sum(inputs.product, inputs.caps?.product),
    trust: sum(inputs.trust, inputs.caps?.trust),
    traction: sum(inputs.traction, inputs.caps?.traction),
    reasons: {
      product: inputs.product.map(fmt).concat(inputs.caps?.product !== undefined ? [`capped at ${inputs.caps.product}`] : []),
      trust: inputs.trust.map(fmt).concat(inputs.caps?.trust !== undefined ? [`capped at ${inputs.caps.trust}`] : []),
      traction: inputs.traction.map(fmt).concat(inputs.caps?.traction !== undefined ? [`capped at ${inputs.caps.traction}`] : []),
    },
  };
}

/**
 * One verdict per project. Rules, in order:
 *  1. Any critical risk → HIGH RISK.
 *  2. Product ≥ 70, Trust ≥ 50, confidence not Low, no warnings about broken promises → VERIFIED.
 *  3. Product ≥ 50 and Trust ≥ 30 → PROMISING.
 *  4. Product known and ≥ 25 → SPECULATIVE.
 *  5. Otherwise → UNVERIFIED.
 */
export function computeVerdict(scores: Scores, risks: RiskItem[], confidence: Confidence, brokenPromises: number): Verdict {
  if (risks.some((r) => r.severity === "critical")) return "HIGH RISK";
  const p = scores.product;
  const t = scores.trust;
  if (p !== null && t !== null && p >= 70 && t >= 50 && confidence !== "Low" && brokenPromises === 0) return "VERIFIED";
  if (p !== null && t !== null && p >= 50 && t >= 30) return "PROMISING";
  if (p !== null && p >= 25) return "SPECULATIVE";
  return "UNVERIFIED";
}

/**
 * Evidence confidence: how many independent source families back the page.
 *  High   — three or more families (for example Live + Onchain + GitHub).
 *  Medium — two families.
 *  Low    — one family or none.
 */
export function computeConfidence(families: Set<string>): Confidence {
  if (families.size >= 3) return "High";
  if (families.size === 2) return "Medium";
  return "Low";
}

export const SCORING_RULES = {
  product: [
    "+30 source code or report delivered to a public repository",
    "+40 the requested output is live: a named IPFS site, a live contract launch or a published report",
    "+20 every implementation step accepted by the IdentityMD verifier",
    "+10 the job or workflow finished",
    "Capped at 35 when the launch is parked, the site is held or taken down, or the job is blocked",
  ],
  trust: [
    "+10 per accepted independent review step (audits), up to +30",
    "+10 audit judge accepted the final revision",
    "+20 deployed on a mainnet, +5 on a testnet",
    "+20 source code public on GitHub",
    "+10 site naming transaction recorded on Ethereum",
    "+10 onchain work receipt sent (+5 while queued)",
    "HIVE only: +15 staking contract has no owner, +15 splitter has no owner, −25 seats held by a plain wallet key",
  ],
  traction: [
    "+20 per follow-up job on the same project, up to +40",
    "+5 per distinct contributing seat, up to +30",
    "+20 activity in the last 7 days, +10 in the last 30 days",
    "HIVE only: +10 per seat acquired (up to +40), +1 per 25 accepted jobs (up to +40), +20 when every seat is enrolled as an agent",
  ],
  verdict: [
    "HIGH RISK — a critical risk is documented with evidence (blocking audit findings, a site taken down, or custody that contradicts a published claim)",
    "VERIFIED — Product ≥ 70, Trust ≥ 50, confidence High or Medium and no broken promise",
    "PROMISING — Product ≥ 50 and Trust ≥ 30",
    "SPECULATIVE — Product ≥ 25 without the trust signals above",
    "UNVERIFIED — not enough evidence to say",
  ],
  confidence: [
    "High — three or more independent source families confirm the page (Live, Onchain, Explorer, GitHub, Research)",
    "Medium — two families",
    "Low — one family or snapshot only",
  ],
};
