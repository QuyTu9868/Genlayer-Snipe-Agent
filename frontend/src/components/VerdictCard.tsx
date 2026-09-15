import { useEffect, useState } from "react";
import type { Facts, Observations, Verdict } from "../lib/genlayer";
import { getMarketData, isGmgnConfigured, type MarketData } from "../lib/gmgn";
import { VerdictBadge } from "./VerdictBadge";

function formatUsd(value: string): string {
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return num.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

// formatCompactUsd: rut gon kieu 52.04K / 1.2M cho dong tom tat tren dau the
function formatCompactUsd(value: string): string {
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return num.toFixed(0);
}

// formatAge: doi so gio thanh chuoi ngan (45m / 6h / 3d)
function formatAge(hours: number): string {
  if (hours < 1) return "<1h";
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

// formatPrice: gia token thuong rat nho, can nhieu chu so co nghia
function formatPrice(value: string): string {
  const num = Number(value);
  if (Number.isNaN(num) || num === 0) return "-";
  if (num >= 1) return `$${num.toFixed(4)}`;
  return `$${num.toPrecision(4)}`;
}

// formatSince: doi unix giay thanh chuoi ngan, dung cho moc thoi gian rieng cua GMGN
function formatSince(unixSeconds: number): string {
  if (!unixSeconds) return "-";
  const mins = Math.floor((Date.now() / 1000 - unixSeconds) / 60);
  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;
  if (mins < 60 * 48) return `${Math.floor(mins / 60)}h`;
  return `${Math.floor(mins / 1440)}d`;
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
  const [market, setMarket] = useState<MarketData | null>(null);

  // Boi canh thi truong tu GMGN, gop CHUNG 1 the voi ban an thay vi tach rieng,
  // nhung van la 1 nguon khac, KHONG anh huong risk_score. Hong thi lang le
  // khong hien, khong lam hong phan ban an chinh.
  useEffect(() => {
    if (!isGmgnConfigured()) return;
    let cancelled = false;
    setMarket(null);
    getMarketData(tokenAddress).then(
      (d) => !cancelled && setMarket(d),
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [tokenAddress]);

  const flagList = verdict.flags
    .split(";")
    .map((f) => f.trim())
    .filter(Boolean);

  const tokenLabel = facts?.token_name
    ? `${facts.token_name}${facts.token_symbol ? ` (${facts.token_symbol})` : ""}`
    : market?.name
      ? `${market.name}${market.symbol ? ` (${market.symbol})` : ""}`
      : "";

  const sec = market?.security;

  return (
    <div className="rounded-xl border border-border-soft bg-surface p-8 sm:p-10">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border-soft pb-6">
        <div className="flex items-start gap-4">
          {/* Logo hinh vuong, bo tron nhe, chu khong tron het. gmgn.ai gan
              Cross-Origin-Resource-Policy: same-origin nen phai tai qua proxy anh
              cong khai images.weserv.nl (da kiem tra song truoc khi dung). */}
          {market?.logo && (
            <img
              src={`https://images.weserv.nl/?url=${encodeURIComponent(market.logo)}`}
              alt=""
              className="h-16 w-16 shrink-0 rounded-xl object-cover sm:h-20 sm:w-20"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}
          <div>
            <p className="text-xs uppercase tracking-widest text-ink-muted">Case file</p>
            {tokenLabel && <p className="mt-1 font-serif text-xl text-ink">{tokenLabel}</p>}
            <p className="mt-1 break-all font-mono text-sm text-ink-muted">{tokenAddress}</p>
          </div>
        </div>
        <VerdictBadge verdict={verdict.verdict} />
      </div>

      {verdict.resolved ? (
        <>
          <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3 py-8">
            <div className="flex items-baseline gap-3">
              <span className="font-serif text-6xl tracking-tight text-ink">{verdict.risk_score}</span>
              <span className="text-sm text-ink-muted">/ 100 risk score</span>
            </div>
            {facts && facts.has_pool && (
              <div className="flex gap-6 text-sm">
                <span className="text-ink-muted">
                  MC <span className="font-mono text-ink">${formatCompactUsd(facts.market_cap_usd)}</span>
                </span>
                <span className="text-ink-muted">
                  Liq <span className="font-mono text-ink">${formatCompactUsd(facts.reserve_in_usd)}</span>
                </span>
                <span className="text-ink-muted">
                  Pool <span className="font-mono text-ink">{formatAge(facts.pool_age_hours)}</span>
                </span>
              </div>
            )}
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
              <div className="mt-3 sm:grid sm:grid-cols-2 sm:gap-x-8">
                {/* Blockscout khong doc duoc luc scan: hien "Unavailable" thay vi so 0 gay hieu nham */}
                <Fact label="Source verified" value={facts.holder_evidence ? (facts.is_verified ? "Yes" : "No") : "Unavailable"} />
                <Fact label="Holders" value={facts.holder_evidence ? facts.holders_count.toLocaleString("en-US") : "Unavailable"} />
                <Fact label="Top individual holder" value={facts.holder_evidence ? `${facts.top_holder_percent}%` : "Unavailable"} />
                <Fact label="Top 10 individual holders" value={facts.holder_evidence ? `${facts.top10_percent}%` : "Unavailable"} />
                <Fact label="Independent large holders" value={facts.holder_evidence ? String(facts.whale_holder_count) : "Unavailable"} />
                <Fact
                  label="Liquidity pool"
                  value={facts.has_pool ? `$${formatUsd(facts.reserve_in_usd)}` : "None found"}
                />
                {facts.has_pool && (
                  <>
                    <Fact label="Price" value={formatPrice(facts.price_usd)} />
                    <Fact label="Market cap" value={`$${formatUsd(facts.market_cap_usd)}`} />
                    <Fact label="24h volume" value={`$${formatUsd(facts.volume_24h_usd)}`} />
                    <Fact label="24h buys / sells" value={`${facts.buys_24h} / ${facts.sells_24h}`} />
                    <Fact label="Pool created" value={`${formatAge(facts.pool_age_hours)} ago`} />
                  </>
                )}
              </div>
            </div>
          )}

          {observations?.observed && (
            <div className="mt-8">
              <p className="text-xs uppercase tracking-widest text-ink-muted">Source code testimony (AI-observed)</p>
              <div className="mt-3 sm:grid sm:grid-cols-2 sm:gap-x-8">
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

      {/* Boi canh thi truong tu GMGN, GOP CHUNG 1 the voi ban an. Chi hien nhung gi
          GMGN co ma on-chain khong co (xem error-log.md muc 26): thoi diem mo giao
          dich, thue mua/ban, honeypot, open source, blacklist, renounced. */}
      {market && (
        <div className="mt-8 border-t border-border-soft pt-6">
          <p className="text-xs uppercase tracking-widest text-ink-muted">Market context (GMGN)</p>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3 text-sm">
            <span className="text-ink-muted">
              Trading opened <span className="font-mono text-ink">{formatSince(market.createdAt)} ago</span>
            </span>
            {sec && (
              <>
                <span className="text-ink-muted">
                  Buy / sell tax{" "}
                  <span className="font-mono text-ink">
                    {sec.buyTaxPercent.toFixed(0)}% / {sec.sellTaxPercent.toFixed(0)}%
                  </span>
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
              </>
            )}
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            Not evidence in the case. It does not affect the risk score, which is ruled on-chain
            from the record above.
          </p>
        </div>
      )}
    </div>
  );
}
