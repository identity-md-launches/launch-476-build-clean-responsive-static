# SWARM ALPHA design system

This document describes the design as implemented in the final source. Values are taken from `src/styles.css` (tokens and components), the React components in `src/components/` and `src/pages/`, and the browser checks recorded in `artifacts/validation.md`. It exists so another page can be added that belongs to the same product.

## Overview

Audience: people who want to know whether an IdentityMD project is real before they trust it, including beginners. The interface is calm and evidence-first: a warm off-white page, white cards, dark text, one blue accent reserved for interaction, and three status hues (green, yellow, red) that each mean exactly one thing. Numbers and labels are short; long text is capped to a readable measure; every changing value carries a source badge.

System-wide rules:

- Content sits in one centered column (`.container`, max 72rem) with 16px side padding that respects safe-area insets.
- Groups are separated by space first (`--space-7` between sections, `--space-4` inside), then by white card surfaces; separator lines appear only inside tables.
- Every status is carried by a colour **and** a glyph or word (✓ Delivered, ◐ Partial, … Pending, ✕ Broken, ? Unverified; verdict badges use the same pattern).
- Interactive elements always have a fill or a border; static text never uses the accent colour.
- Page-specific arrangements (the hero pulse row, the HIVE facts table) are not rules for other pages.

## Colors

Defined once as CSS custom properties on `:root` in `src/styles.css`. Components reference semantic tokens only; primitives (`--sand-*`, `--ink-*`, `--blue-*`, `--green-*`, `--yellow-*`, `--orange-*`, `--red-*`, `--grey-*`) are never used directly.

| Token | Value | Job |
| --- | --- | --- |
| `--color-bg` | `#faf7f2` | Page background (warm off-white) |
| `--color-surface` | `#ffffff` | Cards, panels, table bodies, inputs |
| `--color-surface-2` | `#f3eee6` | Notices, table headers, chip hover, meter track, SIMCARD gradient end |
| `--color-border` | `#e6dfd4` | Card and table borders (structure) |
| `--color-border-strong` | `#d3c9ba` | Chips, buttons, outline badges, SIMCARD border |
| `--color-border-input` | `#8a7f70` | Text input boundary (3.5:1 on white) |
| `--color-text` | `#1f1b16` | Body text, headings, pressed chip fill |
| `--color-text-2` | `#5b544b` | Secondary text, descriptions, footer |
| `--color-text-3` | `#6f675d` | Labels, definition terms, kind tags |
| `--color-accent` / `--color-accent-strong` | `#1d4ed8` / `#1e40af` | Links and the single primary button; hover uses the strong value |
| `--color-focus` | `#1d4ed8` | Focus ring (`:focus-visible`, 2px solid, 2px offset) |
| `--color-good` / `-good-text` / `-good-soft` | `#15803d` / `#14532d` / `#dcfce7` | Green: VERIFIED, Delivered, live source badges, confirmed facts, good meter |
| `--color-caution` / `-caution-text` / `-caution-soft` | `#a16207` / `#713f12` / `#fef3c7` | Yellow: PROMISING, Partial, warnings, calculations, watching state, mid meter |
| `--color-warn-text` / `-warn-soft` | `#7c2d12` / `#ffedd5` | Orange: SPECULATIVE |
| `--color-risk` / `-risk-text` / `-risk-soft` | `#b91c1c` / `#7f1d1d` / `#fee2e2` | Red: HIGH RISK, Broken, critical risks, low meter |
| `--color-neutral-text` / `-neutral-soft` | `#3f3a33` / `#ece7df` | Grey: UNVERIFIED, Pending, Unverified, notes, claims |

Measured contrast (WCAG 2 ratio / APCA Lc, `test/scratch/contrast.mjs`): body text on page 16.0 / 99; secondary text 7.0 / 81; tertiary labels 5.2 / 73; links 6.3 / 78 on page and 6.7 / 82 on cards; white on accent 6.7; every badge text/tint pair between 7.8 and 9.2; meter fills against their track between 4.3 and 5.6; input border 3.5 on white. There is no dark theme; `color-scheme` is fixed to light.

## Typography

- Family: system stack `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` (`--font-sans`); no font files are shipped, so nothing is synthesised or downloaded. Monospace `--font-mono` for addresses, hashes and IDs (`.mono`, `code`).
- Scale (`--text-*`): xs 0.75rem, sm 0.875rem, base 1rem, lg 1.125rem, xl 1.375rem, 2xl 1.75rem, 3xl 2.25rem.
- Roles: `h1` 2xl (3xl from 48rem), weight 700, letter-spacing −0.01em; `h2` xl; `h3` lg; `h4` base. Headings use `line-height: 1.15` and `text-wrap: balance`. Body uses `1.55` and `text-wrap: pretty`.
- Labels: `.card-kind`, `.simcard-role`, `.kind-tag` and stacked-table labels are xs, weight 600–700, uppercase with +0.04–0.06em tracking. Nothing below 12px; nothing lighter than 400.
- Numbers that change use `font-variant-numeric: tabular-nums` (`.num`, `.pulse-value`, `.score-value`, SIMCARD values).
- Measure: long text is capped at `--measure: 65ch` (hero lead, notices, section intros, ledes). Card descriptions clamp to three lines (`.card-purpose`). Long IDs wrap with `overflow-wrap: anywhere`.
- Inputs render at 16px minimum (`font-size: max(1rem, …)`) so iOS does not zoom.
- Underlines come from the font (`text-decoration-thickness: from-font`, `text-underline-offset: 0.15em`, skip-ink).

## Layout

- Spacing scale on a 4px base: `--space-1` 4px, `-2` 8px, `-3` 12px, `-4` 16px, `-5` 24px, `-6` 32px, `-7` 48px, `-8` 64px. One step per level of subordination: 8px inside a control group, 16px inside a card, 48px between sections.
- Content width `--content-max: 72rem`; `.container` adds inline padding `max(16px, safe-area-inset)`.
- Grids are content-driven, not device-driven: `.grid` uses `repeat(auto-fill, minmax(min(100%, 18.5rem), 1fr))` for cards and SIMCARDs; `.two-col` uses `minmax(min(100%, 20rem), 1fr)`; `.pulse` uses `minmax(min(100%, 9rem), 1fr)`. Columns collapse when they stop fitting, so 320px shows one column and 1280px shows three.
- The only media queries: headings grow at `min-width: 48rem`; data tables with the `responsive` class stack into labelled rows at `max-width: 44rem` (each cell shows its column name from `data-label`).
- Header (`.site-header`) is sticky with a translucent blurred background; the nav is a single horizontally scrollable row so it never grows taller than two lines on narrow screens. `html { scroll-padding-top }` and `.section { scroll-margin-top }` keep anchored content clear of it.
- Reading order follows DOM order: hero, safety notice, live pulse, search, filters, then sections in importance order. On project pages: verdict box, four summary panels, promises table, (HIVE) facts and claims, scores, evidence, agents, job history.
- Observed in the browser: no horizontal overflow at 320, 768 or 1280 CSS pixels on the home, HIVE, generic project and about pages. 200% browser zoom and RTL mirroring were not checked.

## Elevation and depth

Mostly flat. Two shadows exist: `--shadow-card` (`0 1px 2px rgba(31,27,22,.06), 0 4px 12px rgba(31,27,22,.05)`) on `.card`, and `--shadow-raised` on the focused skip link. Panels, tables, notices and SIMCARDs use a 1px border only. The sticky header floats above content with `backdrop-filter: blur(8px)`. Table header rows use `--color-surface-2` as a tonal layer. Nothing is stacked above the header except the skip link (`z-index: 100`).

## Shapes

- Radii: `--radius-sm` 6px (SIMCARD chip, skip link), `--radius` 12px (inputs, buttons, notices, pulse tiles, table wrappers), `--radius-lg` 16px (cards, panels, SIMCARDs, verdict box), `--radius-pill` for chips and badges.
- Borders are 1px everywhere; the selected chip inverts to a dark fill instead of a heavier border.
- Meters (`.meter`) are 0.6rem pill tracks with a coloured fill.
- The SIMCARD is a card with a gold "chip" (`.simcard-chip`, `#f2c14e` fill, `#c99a2e` border) holding the seat's SVG avatar from `api.imd.fun`, arranged as chip + header on top and a two-column definition grid below.

## Components

| Component | Source | Use and states |
| --- | --- | --- |
| `VerdictBadge`, `StatusBadge`, `ConfidenceBadge`, `SourceBadge`, `SourceStateBadge`, `KindTag` | `src/components/Badges.tsx`, `.badge*` in CSS | Pill badges. Verdict and promise statuses map to `badge-good/caution/warn/risk/neutral` with a glyph. `SourceBadge` shows Live/Explorer/Onchain/Snapshot/Research with a dot and "· n min ago" when the source was confirmed live; a `title` explains fallback state. `big` renders the verdict as `.verdict-big` text. |
| `ProjectCard` | `src/components/ProjectCard.tsx`, `.card*` | Kind tag, title (stretched link over the card via `::after`), three-line purpose, `dl.card-meta` (Confidence, Updated, Builder, Status), source badge and a small Watch button raised above the stretched link with `z-index`. |
| `SimCard` | `src/components/SimCard.tsx`, `.simcard*` | Compact agent card: NFT number (links to the Explorer profile), role label, agent ID, status dot + word, accepted work, acceptance rate, runtime, last work, owner, paired date, source badge and "Open agent profile". Avatar failures hide the image silently. |
| `WatchButton` | `src/components/WatchButton.tsx` | `button[aria-pressed]` with visible "Watch/Watching" and an accessible "Watch X / Unwatch X" name; pressed state uses the yellow tint. State lives in `localStorage` via `src/data/cache.ts`. |
| `Section`, `Empty` | `src/components/Section.tsx` | Section with `h2`, optional intro and an aside slot; empty state with a title, a sentence and one action, rendered with `role="status"`. |
| `EvidenceList`, `EvidenceInline` | `src/components/Evidence.tsx` | Link lists prefixed by a kind tag (Website, IPFS, GitHub, Explorer, Contract, Transaction, Research, Agent). All external links open in a new tab with `rel="noopener noreferrer"`. |
| Buttons | `.btn`, `.btn-primary`, `.btn-sm` | 44px tall (36px small), bordered white fill, 12px radius, `scale(0.96)` on press, 120ms transitions on colour properties only. Only one `.btn-primary` should exist per view (none on the current pages). |
| Filter chips | `.chip` | `button[aria-pressed]` group labelled "Filter by verdict"; pressed chip inverts to dark. |
| Search | `.search` | Visible `label`, `input[type=search]` with example placeholder, "Clear filters" appears only when a query or filter is active. |
| Data tables | `table.data`, `.table-wrap`, `.responsive` | Bordered, horizontally scrollable wrapper; header row on `--color-surface-2`; `responsive` tables stack under 44rem with `data-label` captions. Used for Promises vs reality, Facts and calculations, Claims and Job history. |
| Score panel | `ProjectPage.tsx` `ScorePanel`, `.score`, `.meter` | Value or "Insufficient data", `role="img"` meter with an accessible label, and a native `<details>` listing every point. |
| Verdict box | `.verdict-box` | Big verdict, confidence, source badges, one-line explanation, status line and actions (Watch, Open the project site, View source on GitHub). |
| Skip link, landmarks | `App.tsx`, `.skip-link` | "Skip to content" is the first focusable element; one `header`, one `nav[aria-label=Main]`, one `main#main[tabindex=-1]` that receives focus on route change, one `footer`. |

Motion: only `.live-dot[data-active=true]` pulses (2s opacity keyframes) and buttons/chips transition colour for 120ms; both are removed under `prefers-reduced-motion: reduce`. Hover styles are gated by `@media (hover: hover)`. Forced-colours mode restores borders on badges, chips and buttons and paints meter fills with `CanvasText`.

## Do's and don'ts

- Start a new page from `App.tsx`: add a route in `src/router.ts`, render inside `<main>` through the existing `.container`, and compose with `Section`, `.panel`, `.grid`, `ProjectCard` and `SimCard`.
- Take every colour from a semantic token. Add a token to `:root` if a role is missing; never reuse a border token for text or a status hue for decoration.
- Use green only for verified/delivered/live, yellow for partial/promising/warning, red for broken/high risk/critical, grey for unknown. Do not use the blue accent for anything that is not a link or the primary action.
- Give every status a glyph or word beside the colour. Every changing value gets a `SourceBadge` and a "last checked" time.
- Write "Insufficient data" instead of 0 or a guess when a source is missing.
- Keep buttons verb-first ("Watch", "Clear filters", "Show more projects", "Open the project site"), sentence case, and empty states with one next action.
- Use logical properties (`inline-start`, `block-end`) and the spacing scale; do not add device breakpoints.
- Do not add fonts, a dark theme, modals, animation libraries or wallet connections; the product does not need them.

Recipe for one more page: create `src/pages/NewPage.tsx` returning `<div className="page-head">` (crumbs, `h1`, `.lede`) followed by `Section` blocks whose children are `.panel` or `.grid` containers; register it in `parseHash`/`hrefFor` in `src/router.ts`; add a nav link in `App.tsx` with `aria-current`; run `npm run typecheck && npm run build`.
