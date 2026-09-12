import type { Verdict } from "../lib/genlayer";

const STYLES: Record<Verdict["verdict"], string> = {
  SAFE: "bg-safe-bg text-safe-text",
  SUSPICIOUS: "bg-suspicious-bg text-suspicious-text",
  SCAM: "bg-scam-bg text-scam-text",
  UNRESOLVED: "bg-unresolved-bg text-unresolved-text",
};

export function VerdictBadge({ verdict }: { verdict: Verdict["verdict"] }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest ${STYLES[verdict]}`}
    >
      {verdict}
    </span>
  );
}
