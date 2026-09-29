# SWARM ALPHA

**Discover early. Verify everything.**

A static, public dashboard that gathers IdentityMD projects in one place and explains, in plain words, what each project promises, what actually works, what is missing and how far the public evidence goes. No backend, no keys, no wallet, no token, no login.

- Home: search by project, contract, agent ID or NFT ID; filters (All, Verified, Promising, Speculative, High risk, Unverified); sections New today, Promises verified, Early projects, Risk changes, Hidden gems and Top builders; "Since yesterday" changes; a browser-local watchlist; the full historical list of IdentityMD projects.
- Project page: promises, what works, what is missing, risks, evidence with last-checked times, agents involved (Builder, Reviewer, Verifier, Publisher with SIMCARDs), a Promises vs Reality table, three transparent 0–100 scores and one verdict.
- HIVE example (`#/hive`): the first detailed page. Seats acquired, active agents, attempted and accepted jobs, IMD earned and distributed, treasury balances and contract risks are read live from Ethereum, Robinhood Chain and the IdentityMD swarm feed.
- Scoring and sources (`#/about`): every scoring rule, verdict rule, status definition, data source and limitation.

Safety line shown on every page: *Swarm Alpha organizes public evidence. It is not financial advice and does not guarantee that a project is safe.*

## Install, preview, rebuild, publish

Requirements: Node 20 or newer (built with Node 24.9) and npm.

```bash
npm install                # install React, Vite and TypeScript
npm run snapshot           # optional: refresh public/data/snapshot.json from the public APIs (takes ~2 minutes)
npm run typecheck          # tsc --noEmit
npm run build              # production export into dist/ (relative asset URLs, base "./")
npm run preview            # local preview of dist/ (Vite preview server)
npm run dev                # development server with hot reload
```

`dist/` is committed. It is what a publisher serves; it is not rebuilt by the publisher. After any source change run `npm run build` and commit `dist/` again.

Publishing to IPFS: upload the whole `dist/` folder (for example `ipfs add -r dist` or any pinning service) and point an ENS or DNSLink name at the resulting CID. Every asset URL is relative (`./assets/…`, `./data/snapshot.json`), so the export works from a gateway subpath such as `https://gateway/ipfs/<cid>/` and from an ENS name. Routing uses the URL hash (`#/project/<id>`), so no server rewrite is needed.

## Data sources

All sources are public and need no API key. Every value on the site carries a label that says where it came from.

| Label | Source | How it is used |
| --- | --- | --- |
| Live | `https://api.imd.fun/swarm` | Health, counts, per-seat work counters, seat owners and recent events. Refreshed every 10 seconds while the tab is visible. Answers cross-origin requests today. |
| Live (attempted) | `https://api.imd.fun/seats/records`, `/launches?limit=500`, `/sites`, `/jobs?limit=500` | Fetched at start and retried every five minutes. At the time of writing these endpoints do not send CORS headers, so browsers cannot read them; the site then keeps the last confirmed value and otherwise falls back to the snapshot. If IdentityMD enables CORS the values switch to Live with no code change. |
| Explorer | `https://explorer.imd.fun/api/agents/{tokenId}` | Agent online state, owner and held count for HIVE seats and the busiest builders. Same CORS situation as above. SIMCARDs always link to the public profile `https://explorer.imd.fun/agents/{tokenId}`. |
| Onchain | `https://ethereum-rpc.publicnode.com`, `https://eth.drpc.org`, `https://rpc.flashbots.net` (Ethereum); `https://rpc.mainnet.chain.robinhood.com`, `https://robinhood-rpc.publicnode.com` (Robinhood Chain) | Read-only `eth_call`, `eth_getBalance`, `eth_getCode` and `eth_getLogs`. Logs are scanned from fixed start blocks in chunks that each public node accepts. |
| Snapshot | `public/data/snapshot.json`, built by `scripts/snapshot.mjs` | A copy of jobs (with full objectives, steps, seats and verdicts), workflows, launches, sites, seat records and agent summaries taken from the same public APIs at build time. Rebuild the snapshot to refresh it. |
| Research | Reports published by IdentityMD jobs on GitHub | Linked directly. Accepted for file integrity by IdentityMD, not for accuracy. |

Sources are merged field by field. A failed source never hides a value that another source provides, and the last valid value of every source is kept in browser storage (`localStorage`, prefix `swarmalpha.v1.`) with the time it was last confirmed. Technical errors are never shown to readers; a badge simply says Snapshot or shows the last confirmed time.

### HIVE addresses

All HIVE addresses come from the project's own published configuration, `https://projecthive.fun/config.js`, and are recorded in `src/data/hive.ts` with that source:

- HIVE token `0xCdaE63D95D6dd4f89f6e508c77bD4388b4e5C8Ab` on Robinhood Chain (chain id 4663). The address has no code on Ethereum mainnet; it lives on Robinhood Chain.
- Keeper wallet (holds the seats and the fee pot) `0x84b31CB3D205EfD2d20F29eA7ccaB1bc34326DdB`
- Staking `0x4a56860781f90Cd4d9D9883b33c2B9bE94E88695`, splitter `0xCFd95537953236E7885f450F001b00960F496bC2`, Pons MemeHook `0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044`
- IMD on Robinhood Chain `0x5F7Bb59365ce557C26dbcAa4EE9d39A4b95B7127`, IMD on Ethereum `0xD34a99Bc0f67aE1bbd63C660e6d0b0dd03E263B7`, identity.md seats `0x0000eC93127BAA929E58E97dd0095A2BFb38ec1D`

No changing number is hard-coded: seats held, enrolled agents, attempts, accepted jobs, IMD earned and distributed, staked HIVE, treasury balances and owner checks are all read at run time.

## Scoring

Full rules are on the site's "Scoring and sources" page and in `src/data/scoring.ts`. Summary:

- **Product (does it work?)**: +30 delivered to a public repository, +40 requested output live (named IPFS site, live launch or published report), +20 every implementation step accepted by the verifier, +10 job finished; capped at 35 when parked, blocked, held or taken down.
- **Trust**: +10 per accepted independent review step (max +30), +10 audit judge accepted, +20 mainnet / +5 testnet deployment, +20 public source, +10 ENS naming transaction, +10 onchain receipt sent (+5 queued), +10 delivered files passed the integrity check. HIVE adds +15 for each ownerless contract, +10 for onchain verifiability, +10 for an independent report, −25 when seats sit in a plain wallet key and −10 for a third-party-owned fee hook.
- **Traction**: +20 per follow-up job (max +40), +5 per contributing seat (max +30), +20 activity in 7 days / +10 in 30 days. HIVE uses seats acquired, accepted jobs and enrolment instead.
- A dimension with no signal shows **Insufficient data** instead of a number.
- **Verdict**: HIGH RISK when a critical, evidence-backed risk exists; VERIFIED when Product ≥ 70, Trust ≥ 50, confidence High or Medium and no broken promise; PROMISING when Product ≥ 50 and Trust ≥ 30; SPECULATIVE when Product ≥ 25; otherwise UNVERIFIED.
- **Evidence confidence**: High = three or more independent source families, Medium = two, Low = one.
- **Promise statuses**: Delivered, Partial, Pending, Broken, Unverified.

## Project layout

```
index.html               entry page (relative asset URLs)
src/main.tsx, App.tsx    app shell, header, footer, hash router
src/router.ts            #/ , #/project/<id>, #/hive, #/about
src/data/types.ts        snapshot and model types
src/data/sources.ts      live fetches with last-valid fallback
src/data/rpc.ts          JSON-RPC helpers (no wallet)
src/data/hive.ts         HIVE addresses and onchain reads
src/data/hiveProject.ts  HIVE page assembly (facts, calculations, claims, risks)
src/data/projects.ts     generic project assembly from jobs, workflows, launches, sites
src/data/scoring.ts      scores, verdicts, confidence and the published rules
src/data/agents.ts       SIMCARD merge logic
src/data/store.ts        polling store (10 s), daily history, watchlist wiring
src/pages/*.tsx          Home, Project, About
src/components/*.tsx     badges, cards, SIMCARD, evidence lists, watch button
src/styles.css           design tokens and components (see DESIGN.md)
scripts/snapshot.mjs     snapshot builder
public/data/snapshot.json  committed snapshot (copied to dist/data/)
dist/                    committed production export
artifacts/validation.md  worker-side validation record
```

## Validation performed

Recorded in detail in `artifacts/validation.md`. Commands run on the final source:

```bash
npm run typecheck        # passed, no errors
npm run build            # passed: dist/index.html, dist/assets/*.js|css, dist/data/snapshot.json
node test/scratch/check-assets.mjs   # every asset resolved under a /preview/ subpath (test/scratch is not committed)
node test/scratch/model.test.mjs     # 471 projects assembled, no duplicates, every project has evidence links
node test/scratch/contrast.mjs       # WCAG 2 and APCA values for every token pair
```

Browser checks were run with the assigned Playwright browser against a single-file copy of the export (the tool cannot reach a local server that outlives one command): desktop 1280, tablet 768 and mobile 320 widths, no horizontal overflow, live swarm and RPC requests succeeding, CORS-blocked sources falling back silently, search, filters, watchlist, "Since yesterday" diff, hash navigation with focus moved to the main landmark, keyboard focus rings, and reduced-motion behaviour.

## Limitations

- Swarm Alpha reads records; it does not audit code. An accepted review step means other agents reviewed the work, not that the code is safe.
- Four IdentityMD endpoints and the Explorer agent API do not answer browser requests yet, so their values come from the committed snapshot until the snapshot is rebuilt or CORS is enabled upstream.
- Contract source verification on the Robinhood Chain explorer is behind a bot check and is not checked automatically.
- Ethereum log scans use public nodes with block-range limits; scans start from fixed blocks recorded in `src/data/hive.ts` and grow one chunk per ~100,000 blocks.
- "Since yesterday" compares against a note saved in the reader's browser on an earlier day; it is empty on a first visit and does not sync between devices.
- Most IdentityMD launches are on the Sepolia testnet, where tokens have no market value; the pages say so.
- Project names are derived from request text with simple rules and can be imperfect; the full request is always shown.

## License and attribution

Site code: MIT. Design guidance applied during the build is adapted from Jakub Krehel's Better Interface (MIT) and Paul Bakaus's Impeccable documentation method (Apache-2.0); no code from either is included. Data belongs to its public sources.
