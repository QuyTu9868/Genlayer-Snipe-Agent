import type { Facts, Observations, Verdict } from "../lib/genlayer";
import { translateFlag } from "../lib/flags";
import { VerdictBadge } from "./VerdictBadge";

function formatUsd(value: string): string {
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return num.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-border-soft py-2.5 text-sm">
      <span className="text-ink-muted">{label}</span>
      <span className="font-mono text-ink">{value}</span>
    </div>
  );
}

export function VerdictCard({
  tokenAddress,
  verdict,
  facts,
  observations,
}: {
  tokenAddress: string;
  verdict: Verdict;
  facts: Facts | null;
  observations: Observations | null;
}) {
  const flagList = verdict.flags
    .split(";")
    .map((f) => translateFlag(f.trim()))
    .filter(Boolean);

  return (
    <div className="rounded-xl border border-border-soft bg-surface p-8 sm:p-10">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border-soft pb-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-ink-muted">Case file</p>
          <p className="mt-1 break-all font-mono text-sm text-ink">{tokenAddress}</p>
        </div>
        <VerdictBadge verdict={verdict.verdict} />
      </div>

      {verdict.resolved ? (
        <>
          <div className="flex items-baseline gap-3 py-8">
            <span className="font-serif text-6xl tracking-tight text-ink">{verdict.risk_score}</span>
            <span className="text-sm text-ink-muted">/ 100 risk score</span>
          </div>

          <div>
            <p className="text-xs uppercase tracking-widest text-ink-muted">Evidence considered</p>
            <ul className="mt-3 space-y-2">
              {flagList.length > 0 ? (
                flagList.map((flag, i) => (
                  <li key={i} className="flex gap-3 text-sm text-ink">
                    <span className="text-ink-muted">-</span>
                    <span>{flag}</span>
                  </li>
                ))
              ) : (
                <li className="text-sm text-ink-muted">No evidence recorded.</li>
              )}
            </ul>
          </div>

          {facts && (
            <div className="mt-8">
              <p className="text-xs uppercase tracking-widest text-ink-muted">On-chain record</p>
              <div className="mt-3">
                <Fact label="Source verified" value={facts.is_verified ? "Yes" : "No"} />
                <Fact label="Holders" value={facts.holders_count.toLocaleString("en-US")} />
                <Fact label="Top individual holder" value={`${facts.top_holder_percent}%`} />
                <Fact label="Independent large holders" value={String(facts.whale_holder_count)} />
                <Fact
                  label="Liquidity pool"
                  value={facts.has_pool ? `$${formatUsd(facts.reserve_in_usd)}` : "None found"}
                />
                {facts.has_pool && (
                  <>
                    <Fact label="24h volume" value={`$${formatUsd(facts.volume_24h_usd)}`} />
                    <Fact label="24h buys / sells" value={`${facts.buys_24h} / ${facts.sells_24h}`} />
                    <Fact label="Pool age" value={`${facts.pool_age_hours}h`} />
                  </>
                )}
              </div>
            </div>
          )}

          {observations?.observed && (
            <div className="mt-8">
              <p className="text-xs uppercase tracking-widest text-ink-muted">Source code testimony (AI-observed)</p>
              <div className="mt-3">
                <Fact label="Owner can mint" value={observations.has_mint ? "Yes" : "No"} />
                <Fact label="Owner can pause trading" value={observations.owner_can_pause ? "Yes" : "No"} />
                <Fact label="Selling can be blocked" value={observations.sell_blocked ? "Yes" : "No"} />
                <Fact label="Unusual fees" value={observations.high_fee ? "Yes" : "No"} />
                <Fact label="Proxy contract" value={observations.is_proxy ? "Yes" : "No"} />
              </div>
            </div>
          )}

          <p className="mt-8 text-xs text-ink-muted">
            Ruled on {new Date(verdict.observed_at).toLocaleString("en-US")}
          </p>
        </>
      ) : (
        <div className="py-8">
          <p className="text-sm text-ink">
            The court could not read reliable evidence for this token from Blockscout or GeckoTerminal.
          </p>
          <p className="mt-2 text-sm text-ink-muted">
            No score is issued when the record is incomplete, rather than guessing.
          </p>
        </div>
      )}
    </div>
  );
}
