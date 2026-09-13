import { useEffect, useState } from "react";
import {
  CONTRACT_ADDRESS,
  getFacts,
  getObservations,
  getVerdict,
  isValidAddress,
  runFullScan,
  type Facts,
  type Observations,
  type ScanStep,
  type Verdict,
} from "./lib/genlayer";
import { VerdictCard } from "./components/VerdictCard";
import { MarketPanel } from "./components/MarketPanel";

type ViewState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "not_found"; tokenAddress: string }
  | { kind: "verdict"; tokenAddress: string; verdict: Verdict; facts: Facts | null; observations: Observations | null }
  | { kind: "scanning"; tokenAddress: string; step: ScanStep }
  | { kind: "error"; message: string };

const STEP_LABELS: Record<ScanStep, string> = {
  scan_token: "Gathering on-chain evidence (holders, liquidity, verification)",
  observe_token: "Hearing testimony from the source code (AI observation)",
  compute_verdict: "Rendering the verdict",
};

function explorerUrl(address: string): string {
  return `https://explorer-asimov.genlayer.com/address/${address}`;
}

export default function App() {
  const [input, setInput] = useState("");
  const [view, setView] = useState<ViewState>({ kind: "idle" });

  // pre-fill from a shareable case link, e.g. rugradar.app?token=0x...
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("token");
    if (fromUrl && isValidAddress(fromUrl)) {
      setInput(fromUrl);
      handleCheck(fromUrl.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCheck(tokenAddress: string) {
    setView({ kind: "checking" });
    try {
      const verdict = await getVerdict(tokenAddress);
      if (!verdict) {
        setView({ kind: "not_found", tokenAddress });
        return;
      }
      const [facts, observations] = await Promise.all([
        getFacts(tokenAddress),
        getObservations(tokenAddress),
      ]);
      setView({ kind: "verdict", tokenAddress, verdict, facts, observations });
    } catch {
      setView({ kind: "error", message: "Could not reach the RugRadar contract. Check your connection and try again." });
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!isValidAddress(trimmed)) {
      setView({ kind: "error", message: "Enter a valid token address (0x followed by 40 hex characters)." });
      return;
    }
    handleCheck(trimmed);
  }

  async function handleScan(tokenAddress: string) {
    setView({ kind: "scanning", tokenAddress, step: "scan_token" });
    try {
      const verdict = await runFullScan(tokenAddress, (step) => {
        setView({ kind: "scanning", tokenAddress, step });
      });
      const [facts, observations] = await Promise.all([
        getFacts(tokenAddress),
        getObservations(tokenAddress),
      ]);
      setView({ kind: "verdict", tokenAddress, verdict, facts, observations });
    } catch (err) {
      setView({
        kind: "error",
        message:
          err instanceof Error
            ? `Scan did not complete: ${err.message}. This is usually a busy testnet validator, not a bug - try again.`
            : "Scan did not complete. Try again.",
      });
    }
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <header className="mb-16">
          <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">RugRadar</p>
          <h1 className="mt-3 font-serif text-4xl tracking-tight text-ink sm:text-5xl">
            The public court for tokens
          </h1>
          <p className="mt-4 max-w-xl text-ink-muted">
            Submit a token from Robinhood Chain. A network of AI validators reads the on-chain
            evidence and the source code, and code alone renders the verdict.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="0x token address"
            spellCheck={false}
            className="w-full rounded-md border border-border-soft bg-surface px-4 py-3 font-mono text-sm text-ink outline-none focus:border-ink"
          />
          <button
            type="submit"
            className="shrink-0 rounded-md bg-ink px-6 py-3 text-sm font-medium text-white transition hover:bg-[#333333] active:scale-[0.98]"
          >
            Check the record
          </button>
        </form>

        <div className="mt-10">
          {view.kind === "checking" && (
            <p className="text-sm text-ink-muted">Checking the record. This can take up to 15 seconds on testnet...</p>
          )}

          {view.kind === "not_found" && (
            <div className="rounded-xl border border-border-soft bg-surface p-8">
              <p className="text-sm text-ink">No case on file yet for this token.</p>
              <p className="mt-2 text-sm text-ink-muted">
                Opening a case submits three transactions to the GenLayer Asimov Testnet
                (evidence gathering, AI testimony, verdict). No wallet needed to view a case.
              </p>
              <button
                onClick={() => handleScan(view.tokenAddress)}
                className="mt-5 rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#333333] active:scale-[0.98]"
              >
                Open a case
              </button>
            </div>
          )}

          {view.kind === "scanning" && (
            <div className="rounded-xl border border-border-soft bg-surface p-8">
              <p className="text-sm text-ink">{STEP_LABELS[view.step]}</p>
              <p className="mt-2 text-xs text-ink-muted">
                Waiting for validator consensus on the testnet. This can take a minute or two per
                step.
              </p>
              <ol className="mt-5 space-y-2">
                {(Object.keys(STEP_LABELS) as ScanStep[]).map((step) => {
                  const order: ScanStep[] = ["scan_token", "observe_token", "compute_verdict"];
                  const current = order.indexOf(view.step);
                  const thisIndex = order.indexOf(step);
                  const done = thisIndex < current;
                  const active = thisIndex === current;
                  return (
                    <li key={step} className="flex items-center gap-3 text-xs">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${done ? "bg-safe-text" : active ? "bg-ink" : "bg-border-soft"}`}
                      />
                      <span className={active ? "text-ink" : "text-ink-muted"}>{STEP_LABELS[step]}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {view.kind === "verdict" && (
            <div className="space-y-4">
              <VerdictCard
                tokenAddress={view.tokenAddress}
                verdict={view.verdict}
                facts={view.facts}
                observations={view.observations}
              />
              <MarketPanel tokenAddress={view.tokenAddress} />
              <button
                onClick={() => handleScan(view.tokenAddress)}
                className="text-xs text-ink-muted underline decoration-border-soft underline-offset-4 hover:text-ink"
              >
                Request a new hearing (re-scan with current data)
              </button>
            </div>
          )}

          {view.kind === "error" && (
            <div className="rounded-xl border border-scam-bg bg-scam-bg/40 p-6">
              <p className="text-sm text-scam-text">{view.message}</p>
            </div>
          )}
        </div>

        <footer className="mt-24 border-t border-border-soft pt-6 text-xs text-ink-muted">
          <p>
            Contract:{" "}
            <a
              href={explorerUrl(CONTRACT_ADDRESS)}
              target="_blank"
              rel="noreferrer"
              className="font-mono underline decoration-border-soft underline-offset-4 hover:text-ink"
            >
              {CONTRACT_ADDRESS}
            </a>{" "}
            on GenLayer Asimov Testnet
          </p>
          <p className="mt-1">
            Read-only for anyone. Verdicts are computed entirely in code from on-chain facts and
            AI-observed facts - the model never decides the score.
          </p>
        </footer>
      </div>
    </div>
  );
}
