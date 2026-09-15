import { useEffect, useState } from "react";
import { getMarketData, isGmgnConfigured, type MarketData } from "../lib/gmgn";

// age: doi unix giay thanh chuoi ngan (12m / 6h / 3d)
function age(createdAt: number): string {
  if (!createdAt) return "-";
  const mins = Math.floor((Date.now() / 1000 - createdAt) / 60);
  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;
  if (mins < 60 * 48) return `${Math.floor(mins / 60)}h`;
  return `${Math.floor(mins / 1440)}d`;
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
          {/* gmgn.ai gan Cross-Origin-Resource-Policy: same-origin nen tai thang bi
              chan (loi NotSameOrigin). images.weserv.nl la proxy anh cong khai, tai ho
              o phia server roi tra lai voi CORP: cross-origin - da kiem tra song. */}
          {data.logo && (
            <img
              src={`https://images.weserv.nl/?url=${encodeURIComponent(data.logo)}`}
              alt=""
              className="h-9 w-9 rounded-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}
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

      {/* CHI hien nhung gi GMGN co ma on-chain record o tren KHONG co (dung 2 nguon
          khac nhau moi thu). MC/Liq/Price/Holders/volume/buys-sells/Top10 da co roi,
          khong lap lai - xem error-log.md muc 26. */}
      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-sm">
        <span className="text-ink-muted">
          Trading opened <span className="font-mono text-ink">{age(data.createdAt)} ago</span>
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

      <p className="mt-5 text-xs text-ink-muted">
        Market context only, from GMGN, shown where it adds to the on-chain record above rather
        than repeating it. It is not evidence in the case and does not affect the risk score.
      </p>
    </div>
  );
}
