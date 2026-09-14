# RugRadar

A decentralized court for tokens, built on GenLayer.

Give it a token address on Robinhood Chain. A network of AI validators reads the
on-chain evidence (holders, liquidity, trading, source code) against a public
rulebook, and code alone renders the verdict: **SAFE**, **SUSPICIOUS**, or
**SCAM**, with reasons, recorded on-chain for anyone to verify.

Built for the GenLayer Agent Tank Hackathon, Onchain Justice theme.

**Live contract (GenLayer Studionet):**
[`0x3035D639c3d7af963E3d50d80496Ba0677d22AEa`](https://explorer-studio.genlayer.com/address/0x3035D639c3d7af963E3d50d80496Ba0677d22AEa)

Also deployed to the public GenLayer Bradbury Testnet:
[`0xe297716bA5Aab8672539D97d646e8010EcCCc6Da`](https://explorer-bradbury.genlayer.com/address/0xe297716bA5Aab8672539D97d646e8010EcCCc6Da)

## Why "a court" and not "a bot"

RugRadar does not trade, snipe, or advise on price. It only reads public
evidence and issues a public ruling. The token is the defendant, the rulebook
is public and fixed in advance, and the ruling is reproducible by anyone who
re-runs the same evidence through the same code.

## How it works

RugRadar runs three phases as Intelligent Contract methods, each backed by
GenLayer's multi-validator consensus:

1. **Evidence (`scan_token`)** - reads objective facts straight from public
   APIs, no AI involved: holder count and concentration, liquidity, 24h
   volume, buy/sell counts, pool age, verification status. Every validator
   independently re-fetches Blockscout and GeckoTerminal and the network only
   accepts the result if they agree byte-for-byte (`strict_eq`).
2. **Testimony (`observe_token`)** - an LLM reads the token's verified source
   code and answers five fixed yes/no questions (can the owner mint more
   tokens, pause trading, block selling, charge arbitrary fees, or swap the
   code via a proxy). The model returns **only** these five booleans, nothing
   else, and never proposes a score. Because different validators run
   different LLMs, agreement is checked by an AI judge against a stated
   principle (`prompt_comparative`), not by exact string matching.
3. **Verdict (`compute_verdict`)** - a pure, deterministic function (no AI,
   no network) reads the stored evidence and testimony and computes a 0-100
   risk score by adding and subtracting fixed weights, then maps the score to
   a verdict. See [`references/scoring-spec.md`](references/scoring-spec.md)
   for the exact rule book.

If the evidence cannot be read reliably, the contract records **UNRESOLVED**
instead of guessing (fail-closed).

## Design principles

- **Code decides, AI observes.** The model never sees the scoring weights and
  never outputs a score. It only answers fixed, closed questions.
- **Independent re-verification.** Validators do not trust a leader's fetched
  data; each one re-fetches the same public sources and the network only
  agrees when the results actually match.
- **Fail-closed.** Missing or unreadable data produces `UNRESOLVED`, never a
  guessed score.
- **Read-only.** RugRadar only reads Robinhood Chain data. It never places a
  trade and never gates a token's ability to trade.

## Project layout

```
contracts/rugradar.py        the Intelligent Contract (GenLayer, Python)
tests/integration/           tests run against real GenLayer networks
frontend/                    the web UI (Vite + React + genlayer-js)
references/                  scoring rules, data source contracts, error log
```

## Running the contract locally

```bash
pip install -r requirements.txt
gltest tests/integration/test_cp4_scenarios.py -v -s
```

`gltest.config.yaml` defaults to **studionet** (GenLayer's hosted Studio
network) so no local node or Docker is required. See
[`references/genlayer-contract-api.md`](references/genlayer-contract-api.md)
for the verified API details and
[`references/error-log.md`](references/error-log.md) for every real issue hit
while building this (and how it was fixed) - useful if you hit the same wall.

## Running the frontend

```bash
cd frontend
npm install
echo "VITE_DEPLOYER_PRIVATE_KEY=0x..." > .env  # a dedicated demo wallet, see frontend/README.md
npm run dev
```

Open `http://localhost:5173`, or jump straight to an already-scanned token,
for example:

```
http://localhost:5173/?token=0x1c85e5fb478e91d8b769a509278f10e5e432754a
```

No wallet needed to view a case. Opening a new case signs its transactions
with a dedicated demo wallet the app carries for this purpose - see
[`frontend/README.md`](frontend/README.md) for why, and for the tradeoffs of
that choice before reusing this pattern anywhere real funds are involved.

## Data sources

- [Blockscout](https://robinhoodchain.blockscout.com) (Robinhood Chain
  explorer) - holders, verification status, source code.
- [GeckoTerminal](https://www.geckoterminal.com/robinhood) (network
  `robinhood`) - liquidity, volume, buy/sell counts, pool age.

Both are public, unauthenticated, read-only APIs. Full endpoint reference in
[`references/data-sources.md`](references/data-sources.md).

The web UI additionally shows a **market context** panel fed by
[GMGN's OpenAPI](https://docs.gmgn.ai) (chain `robinhood`). Nothing in that
panel is evidence in the case: it never reaches the contract, never touches the
risk score, and the case file renders normally when it is absent. It exists so a
reader can compare the court's on-chain record against the market numbers they
are used to seeing elsewhere. It needs `VITE_GMGN_API_KEY` in `frontend/.env`;
without one the panel simply does not render.

## Known limitations

- The web UI runs on GenLayer Studionet. During the build window both public
  testnets stalled on transaction processing: Asimov's consensus activity fell
  from ~1,300 events per 900 blocks to under 10, and on Bradbury a deploy was
  accepted but follow-up writes sat unprocessed or were rejected at submission.
  The same contract runs the full scan -> testimony -> verdict pipeline on
  Studionet in about two minutes. Measurements are in `references/error-log.md`.
- Blockscout sits behind a bot challenge that intermittently serves an HTML
  page instead of JSON. When a validator gets that page, the scan fails closed
  and the token is ruled `UNRESOLVED` rather than scored on partial evidence.
  Re-opening the case later usually succeeds.
- Market cap comes from GeckoTerminal's `fdv_usd`, which is price times total
  supply. For the tokens seen so far circulating supply equals total supply, so
  the two coincide, but the UI labels it honestly rather than claiming a
  circulating-supply market cap.
- Scoring weights in `scoring-spec.md` are a starting point tuned against a
  handful of real tokens, not a formally calibrated model.
