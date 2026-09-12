# RugRadar

A decentralized court for tokens, built on GenLayer.

Give it a token address on Robinhood Chain. A network of AI validators reads the
on-chain evidence (holders, liquidity, trading, source code) against a public
rulebook, and code alone renders the verdict: **SAFE**, **SUSPICIOUS**, or
**SCAM**, with reasons, recorded on-chain for anyone to verify.

Built for the GenLayer Agent Tank Hackathon, Onchain Justice theme.

**Live contract (GenLayer Asimov Testnet):**
[`0x8835d2E5a58AD6A73501CA18860Ab89cC3c85308`](https://explorer-asimov.genlayer.com/address/0x8835d2E5a58AD6A73501CA18860Ab89cC3c85308)

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

## Known limitations

- GenLayer's public testnet (Asimov) occasionally rejects a write with a
  generic RPC-level revert or `LEADER_TIMEOUT` under load; retrying succeeds
  in every case observed. This is a testnet infrastructure characteristic,
  not a contract bug - see `references/error-log.md`.
- Scoring weights in `scoring-spec.md` are a starting point tuned against a
  handful of real tokens, not a formally calibrated model.
