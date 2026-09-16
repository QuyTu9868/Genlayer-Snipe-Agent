import { useEffect, useState } from "react";
import {
  CONTRACT_ADDRESS,
  getFacts,
  getObservations,
  getVerdict,
  isValidAddress,
  previewVerdict,
  runFullScan,
  type Facts,
  type Observations,
  type ScanStep,
  type Verdict,
} from "./lib/genlayer";
import { VerdictCard } from "./components/VerdictCard";
import { ThemeToggle } from "./components/ThemeToggle";

type ViewState =
  | { kind: "idle" }
  | { kind: "checking"; tokenAddress: string }
  | { kind: "verdict"; tokenAddress: string; verdict: Verdict; facts: Facts | null; observations: Observations | null }
  | { kind: "scanning"; tokenAddress: string; step: ScanStep; preview: Verdict | null }
  | { kind: "error"; message: string };

const STEP_LABELS: Record<ScanStep, string> = {
  scan_token: "Gathering evidence and hearing source code testimony (in parallel)",
  observe_token: "Hearing testimony from the source code (AI observation)",
  compute_verdict: "Rendering the verdict",
};

function explorerUrl(address: string): string {
  return `https://explorer-studio.genlayer.com/address/${address}`;
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
    setView({ kind: "checking", tokenAddress });
    // So tham chay NGAY, song song voi viec tra ho so. No chi doc, khong ghi chain,
    // nen neu ho so da co thi bo di cung khong ton gi. Meme coin can so trong vai giay.
    const preview = previewVerdict(tokenAddress);
    try {
      const verdict = await getVerdict(tokenAddress);
      if (!verdict) {
        // Chua co ho so: mo vu an luon, khong bat nguoi xem bam them 1 nut
        handleScan(tokenAddress, preview);
        return;
      }
      // facts o day chi la so KHOI DIEM de hien ngay lap tuc; VerdictCard tu doc lai
      // Facts song (preview_facts, khong dong thuan) va tu lam moi dinh ky ben trong.
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

  async function handleScan(tokenAddress: string, preview?: Promise<Verdict | null>) {
    setView({ kind: "scanning", tokenAddress, step: "scan_token", preview: null });
    (preview ?? previewVerdict(tokenAddress)).then((result) =>
      setView((prev) =>
        prev.kind === "scanning" && prev.tokenAddress === tokenAddress ? { ...prev, preview: result } : prev,
      ),
    );
    try {
      const verdict = await runFullScan(tokenAddress, (step) => {
        setView((prev) => ({
          kind: "scanning",
          tokenAddress,
          step,
          preview: prev.kind === "scanning" ? prev.preview : null,
        }));
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
      <ThemeToggle />
      {/* chiem ~75% chieu ngang man hinh thay vi 1 con so co dinh, vi man hinh
          nguoi dung rong hay hep khac nhau nhieu. San 20rem/tran 100rem de
          khong vo tren dien thoai lan man sieu rong. */}
      <div className="mx-auto max-w-[clamp(20rem,75vw,100rem)] px-6 py-16 sm:py-24">
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
            className="shrink-0 rounded-md bg-accent px-6 py-3 text-sm font-medium text-on-accent transition hover:opacity-90 active:scale-[0.98]"
          >
            Check the record
          </button>
        </form>

        <div className="mt-10">
          {view.kind === "checking" && (
            <p className="text-sm text-ink-muted">Checking the record...</p>
          )}

          {view.kind === "scanning" && (
            <div className="space-y-4">
              {/* Hien luon toan bo thong tin so tham (diem + Facts) ngay khi co, thay vi
                  man hinh cho trong. VerdictCard tu doc Facts song ben trong (khong can
                  truyen tu day), viet="preliminary" de danh dau chua phai ban an chinh
                  thuc - khi ban an that ve thi thay the tai cho, khong con man hinh cho. */}
              {view.preview ? (
                <VerdictCard
                  tokenAddress={view.tokenAddress}
                  verdict={view.preview}
                  facts={null}
                  observations={null}
                  preliminary
                />
              ) : (
                <p className="text-sm text-ink-muted">Reading initial evidence...</p>
              )}
              <p className="text-xs text-ink-muted">
                {STEP_LABELS[view.step]} - validators are confirming, this updates automatically
              </p>
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
            on GenLayer Studionet
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
