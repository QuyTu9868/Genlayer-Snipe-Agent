import { useEffect, useState } from "react";
import { getMarketData, isGmgnConfigured, type MarketData } from "../lib/gmgn";

function compactUsd(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "-";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

function price(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "-";
  if (value >= 1) return `$${value.toFixed(4)}`;
  return `$${value.toPrecision(4)}`;
}

// age: doi unix giay thanh chuoi ngan (12m / 6h / 3d)
function age(createdAt: number): string {
  if (!createdAt) return "-";
  const mins = Math.floor((Date.now() / 1000 - createdAt) / 60);
  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;
  if (mins < 60 * 48) return `${Math.floor(mins / 60)}h`;
  return `${Math.floor(mins / 1440)}d`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-ink-muted">{label}</p>
      <p className="mt-1 font-mono text-sm text-ink">{value}</p>
    </div>
  );
}

export function MarketPanel({ tokenAddress }: { tokenAddress: string }) {
  const [data, setData] = useState<MarketData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isGmgnConfigured()) return;
    let cancelled = false;
    setData(null);
    setFailed(false);
    getMarketData(tokenAddress).then(
      (d) => !cancelled && setData(d),
      () => !cancelled && setFailed(true),
    );
    return () => {
      cancelled = true;
    };
  }, [tokenAddress]);

  // Khoi nay la boi canh, khong phai ban an: hong thi bien mat lang le,
  // khong duoc lam hong phan verdict doc tu chain.
  if (!isGmgnConfigured() || failed) return null;

  if (!data) {
    return (
      <div className="rounded-xl border border-border-soft bg-surface p-6">
        <p className="text-xs uppercase tracking-widest text-ink-muted">Market context</p>
        <p className="mt-3 text-sm text-ink-muted">Loading market data...</p>
      </div>
    );
  }

  const sec = data.security;

  return (
    <div className="rounded-xl border border-border-soft bg-surface p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4 border-b border-border-soft pb-4">
        <div className="flex items-center gap-3">
          {/* Khong hien logo: gmgn.ai chan nhung anh tu trang khac (CORP NotSameOrigin) */}
          <div>
            <p className="text-xs uppercase tracking-widest text-ink-muted">Market context</p>
            <p className="font-serif text-lg text-ink">
              {data.name}
              {data.symbol ? ` (${data.symbol})` : ""}
            </p>
          </div>
        </div>
        <p className="text-xs text-ink-muted">Source: GMGN</p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <Stat label="Market cap" value={compactUsd(data.marketCapUsd)} />
        <Stat label="Liquidity" value={compactUsd(data.liquidityUsd) + (data.quoteSymbol ? ` (${data.quoteSymbol})` : "")} />
        <Stat label="24h volume" value={compactUsd(data.volume24hUsd)} />
        <Stat label="Age" value={age(data.createdAt)} />
        <Stat label="Price" value={price(data.priceUsd)} />
        <Stat label="Holders" value={data.holderCount.toLocaleString("en-US")} />
        <Stat label="24h buys / sells" value={`${data.buys24h} / ${data.sells24h}`} />
        {sec && (
          <Stat
            label="Buy / sell tax"
            value={`${sec.buyTaxPercent.toFixed(0)}% / ${sec.sellTaxPercent.toFixed(0)}%`}
          />
        )}
      </div>

      {sec && (
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-border-soft pt-4 text-sm">
          <span className="text-ink-muted">
            Top 10 <span className="font-mono text-ink">{sec.top10Percent.toFixed(2)}%</span>
          </span>
          <span className="text-ink-muted">
            Honeypot <span className="font-mono text-ink">{sec.isHoneypot ? "Yes" : "No"}</span>
          </span>
          <span className="text-ink-muted">
            Open source <span className="font-mono text-ink">{sec.isOpenSource ? "Yes" : "No"}</span>
          </span>
          <span className="text-ink-muted">
            Blacklist <span className="font-mono text-ink">{sec.isBlacklist ? "Yes" : "No"}</span>
          </span>
          <span className="text-ink-muted">
            Renounced <span className="font-mono text-ink">{sec.isRenounced ? "Yes" : "No"}</span>
          </span>
        </div>
      )}

      <p className="mt-5 text-xs text-ink-muted">
        Market context only. It is not evidence in the case and does not affect the risk score,
        which is ruled on-chain from the record above.
      </p>
    </div>
  );
}
