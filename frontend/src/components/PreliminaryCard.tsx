import type { Verdict } from "../lib/genlayer";

// PreliminaryCard: ket qua SO THAM (1 node, chua dong thuan). Co tinh lam nhat va
// vien dut net hon ban an that de khong ai nham day la phan quyet chinh thuc.
export function PreliminaryCard({ preview }: { preview: Verdict }) {
  const flags = preview.flags
    .split(";")
    .map((f) => f.trim())
    .filter(Boolean);

  return (
    <div className="rounded-xl border border-dashed border-border-soft bg-surface p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs uppercase tracking-widest text-ink-muted">Preliminary hearing</p>
        <p className="text-xs text-ink-muted">One node, not yet ruled by consensus</p>
      </div>

      {preview.resolved ? (
        <>
          {/* risk_score luu tren chain: 0 = rui ro thap nhat. Hien nguoc lai
              (100 - risk_score) lam "safety score" de cao = an toan, dung truc
              giac so dong - nhieu nguoi doc nham "0" la diem xau. */}
          <p className="mt-3 flex items-baseline gap-2 text-ink-muted">
            <span className="font-serif text-4xl">{100 - preview.risk_score}</span>
            <span className="text-sm">/ 100 safety, leaning {preview.verdict}</span>
          </p>
          {flags.length > 0 && (
            <ul className="mt-3 space-y-1">
              {flags.map((flag, i) => (
                <li key={i} className="flex gap-2 text-sm text-ink-muted">
                  <span>-</span>
                  <span>{flag}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="mt-3 text-sm text-ink-muted">This node could not read the evidence yet.</p>
      )}

      <p className="mt-4 text-xs text-ink-muted">
        Source code testimony is not included at this stage. The binding verdict replaces this card
        once validators agree.
      </p>
    </div>
  );
}
