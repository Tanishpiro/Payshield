"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

/* ============================================================
   Light-theme primitives for the PC dashboard.
   (components/ui.tsx stays dark and is used by the mobile pay flow.)
   ============================================================ */

export type Level = "low" | "medium" | "high" | "critical";

export const LV: Record<Level, { label: string; short: string; mark: string; ink: string; soft: string; action: string }> = {
  low:      { label: "Low risk",      short: "Low",      mark: "var(--low)",  ink: "var(--low-ink)",  soft: "var(--low-soft)",  action: "Payment can proceed" },
  medium:   { label: "Medium risk",   short: "Medium",   mark: "var(--med)",  ink: "var(--med-ink)",  soft: "var(--med-soft)",  action: "Confirm before paying" },
  high:     { label: "High risk",     short: "High",     mark: "var(--high)", ink: "var(--high-ink)", soft: "var(--high-soft)", action: "Additional verification required" },
  critical: { label: "Critical risk", short: "Critical", mark: "var(--crit)", ink: "var(--crit-ink)", soft: "var(--crit-soft)", action: "Payment blocked for review" },
};

export const lv = (l: string): Level => (l in LV ? (l as Level) : "low");
export const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
export const compactInr = (n: number) =>
  n >= 1e7 ? `₹${(n / 1e7).toFixed(1)}Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(1)}L` : n >= 1e3 ? `₹${(n / 1e3).toFixed(0)}K` : inr(n);
const zone = (v: number): Level => (v <= 30 ? "low" : v <= 60 ? "medium" : v <= 85 ? "high" : "critical");

/* ---------------- brand ---------------- */

export function Mark({ size = 26 }: { size?: number }) {
  const gid = "psl" + useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7c5cff" />
          <stop offset="1" stopColor="#4a2ee0" />
        </linearGradient>
      </defs>
      <path d="M16 2.6 27 6.6v9.1c0 7-4.6 12.2-11 14.3-6.4-2.1-11-7.3-11-14.3V6.6L16 2.6Z" fill={`url(#${gid})`} />
      <path d="M16 5.1 24.6 8.2v7.5c0 5.6-3.5 9.8-8.6 11.6-5.1-1.8-8.6-6-8.6-11.6V8.2L16 5.1Z" fill="#fff" fillOpacity=".16" />
      <path d="M11.2 16.3l3.5 3.4 6.4-7" fill="none" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <Mark size={28} />
      <div className="leading-none">
        <div className="text-[15px] font-bold tracking-[-.02em]">PayShield</div>
        <div className="mt-[3px] text-[10.5px] font-medium uppercase tracking-[.11em] text-[var(--ink-3)]">AI Police</div>
      </div>
    </div>
  );
}

/* ---------------- shells ---------------- */

export function Card({
  title, sub, actions, children, className = "", pad = true, id,
}: {
  title?: string; sub?: string; actions?: React.ReactNode; children: React.ReactNode;
  className?: string; pad?: boolean; id?: string;
}) {
  return (
    <section id={id} className={`card min-w-0 overflow-hidden ${className}`}>
      {(title || actions) && (
        <div className="flex items-start gap-3 px-5 pt-4 pb-3">
          <div className="min-w-0">
            {title && <h2 className="h2">{title}</h2>}
            {sub && <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[var(--ink-2)]">{sub}</p>}
          </div>
          {actions && <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={pad ? "px-5 pb-5" : ""}>{children}</div>
    </section>
  );
}

export function Badge({ level, size = "md" }: { level: string; size?: "sm" | "md" }) {
  const m = LV[lv(level)];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${size === "sm" ? "px-2 py-[2px] text-[11px]" : "px-2.5 py-1 text-[12px]"}`}
      style={{ background: m.soft, color: m.ink, boxShadow: `inset 0 0 0 1px ${m.mark}33` }}
    >
      <span className="h-[6px] w-[6px] rounded-full" style={{ background: m.mark }} />
      {size === "sm" ? m.short : m.label}
    </span>
  );
}

/* ---------------- score dial ---------------- */

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
};

/** Segmented arc gauge: the scale itself is colour-coded, the needle marks the score. */
export function ScoreDial({ score, level, size = 196 }: { score: number; level: string; size?: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(score); return; }
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 900);
      setShown(Math.round(score * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  const cx = size / 2, cy = size / 2;
  const R = size / 2 - 13;
  const START = -128, SWEEP = 256;
  const N = 48;
  const m = LV[lv(level)];

  const ticks = Array.from({ length: N }, (_, i) => {
    const v = ((i + 0.5) / N) * 100;
    const deg = START + (i / N) * SWEEP + SWEEP / N / 2;
    const on = shown >= v - 1;
    const zc = LV[zone(v)].mark;
    const long = i % 6 === 0;
    const a = polar(cx, cy, R, deg), b = polar(cx, cy, R - (long ? 15 : 10), deg);
    return { a, b, on, zc, long, key: i };
  });

  const mark = polar(cx, cy, R, START + (Math.min(100, Math.max(0, shown)) / 100) * SWEEP);
  const block = polar(cx, cy, R + 1, START + 0.9 * SWEEP);
  const blockIn = polar(cx, cy, R - 19, START + 0.9 * SWEEP);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img"
      aria-label={`Risk score ${score} out of 100, ${m.label}`}>
      <svg width={size} height={size}>
        {ticks.map((t) => (
          <line key={t.key} x1={t.a.x} y1={t.a.y} x2={t.b.x} y2={t.b.y}
            stroke={t.on ? t.zc : "#e6e6df"} strokeWidth={t.long ? 3 : 2} strokeLinecap="round"
            style={{ transition: "stroke .35s ease" }} />
        ))}
        {/* hard-block threshold at 90 */}
        <line x1={block.x} y1={block.y} x2={blockIn.x} y2={blockIn.y} stroke="var(--crit-ink)" strokeWidth="1.5" strokeDasharray="2 2" />
        <circle cx={mark.x} cy={mark.y} r="6.5" fill="#fff" stroke={m.mark} strokeWidth="3"
          style={{ transition: "cx .3s ease, cy .3s ease" }} />
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-content-center pt-3 text-center">
        <div className="mono text-[42px] font-semibold leading-none" style={{ color: m.ink }}>{shown}</div>
        <div className="lbl mt-1.5">Risk / 100</div>
      </div>
      <div className="absolute inset-x-0 bottom-[6px] text-center text-[10.5px] font-semibold uppercase tracking-[.09em]" style={{ color: m.ink }}>
        {m.label}
      </div>
    </div>
  );
}

/* ---------------- meters ---------------- */

export function TrustMeter({ value, label = "Receiver trust" }: { value: number; label?: string }) {
  const col = value >= 70 ? "var(--low)" : value >= 40 ? "var(--med)" : "var(--high)";
  const ink = value >= 70 ? "var(--low-ink)" : value >= 40 ? "var(--med-ink)" : "var(--high-ink)";
  const filled = Math.round((value / 100) * 12);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="lbl">{label}</span>
        <span className="mono text-[13px] font-semibold" style={{ color: ink }}>{value}<span className="text-[var(--ink-3)]">/100</span></span>
      </div>
      <div className="mt-2 flex gap-[3px]" aria-hidden>
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} className="h-[7px] flex-1 rounded-[2px]"
            style={{ background: i < filled ? col : "#e8e8e1", transition: `background .4s ${i * 30}ms` }} />
        ))}
      </div>
    </div>
  );
}

export function RiskBar({ score, level, height = 6 }: { score: number; level: string; height?: number }) {
  return (
    <div className="overflow-hidden rounded-full bg-[#ecece5]" style={{ height }}>
      <div className="h-full rounded-full"
        style={{ width: `${Math.max(3, score)}%`, background: LV[lv(level)].mark, transition: "width .7s cubic-bezier(.22,1,.36,1)" }} />
    </div>
  );
}

/** Stacked triage bar — click a segment to filter. */
export function Triage({
  counts, active, onPick,
}: { counts: Record<Level, number>; active: Level | null; onPick: (l: Level | null) => void }) {
  const order: Level[] = ["low", "medium", "high", "critical"];
  const total = order.reduce((a, k) => a + counts[k], 0) || 1;
  return (
    <div>
      <div className="flex h-3 gap-[3px] overflow-hidden rounded-full" role="group" aria-label="Risk distribution">
        {order.map((k) =>
          counts[k] ? (
            <button key={k} onClick={() => onPick(active === k ? null : k)}
              title={`${counts[k]} ${LV[k].label}`} aria-pressed={active === k}
              className="h-full rounded-full transition-[opacity,transform] hover:opacity-80"
              style={{
                width: `${(counts[k] / total) * 100}%`, background: LV[k].mark,
                opacity: active && active !== k ? 0.28 : 1,
              }} />
          ) : null
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {order.map((k) => (
          <button key={k} onClick={() => onPick(active === k ? null : k)}
            className={`flex items-center gap-2 rounded-lg px-1.5 py-1 text-left transition ${active === k ? "bg-[var(--sunk)]" : "hover:bg-[var(--sunk)]"}`}>
            <span className="h-2 w-2 rounded-full" style={{ background: LV[k].mark }} />
            <span className="mono text-[15px] font-semibold leading-none">{counts[k]}</span>
            <span className="text-[12px] font-medium text-[var(--ink-2)]">{LV[k].short}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- stats ---------------- */

export function Stat({
  label, value, hint, tone, bars,
}: { label: string; value: string | number; hint?: string; tone?: Level | "brand"; bars?: number[] }) {
  const col = tone === "brand" ? "var(--accent-ink)" : tone ? LV[tone].ink : "var(--ink)";
  return (
    <div className="card px-4 py-3.5">
      <div className="lbl">{label}</div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <span className="mono text-[26px] font-semibold leading-none" style={{ color: col }}>{value}</span>
        {bars && bars.length > 1 && <Spark values={bars} color={tone === "brand" ? "var(--accent)" : tone ? LV[tone].mark : "#b9bcc2"} />}
      </div>
      {hint && <div className="mt-1.5 text-[11.5px] leading-snug text-[var(--ink-3)]">{hint}</div>}
    </div>
  );
}

export function Spark({ values, color = "#b9bcc2", w = 58, h = 22 }: { values: number[]; color?: string; w?: number; h?: number }) {
  const max = Math.max(...values, 1);
  const n = values.length;
  return (
    <svg width={w} height={h} aria-hidden className="shrink-0">
      {values.map((v, i) => {
        const bh = Math.max(2, (v / max) * h);
        return <rect key={i} x={(i * w) / n} y={h - bh} width={Math.max(2, w / n - 2)} height={bh} rx="1.5" fill={color} opacity={0.25 + (0.75 * (i + 1)) / n} />;
      })}
    </svg>
  );
}

/* ---------------- reasons ---------------- */

const CAT: Record<string, string> = {
  identity: "Identity", age: "Account age", velocity: "Velocity", behaviour: "Behaviour",
  reputation: "Reputation", device: "Device", network: "Network",
};

export function Reason({ r, trust }: { r: { code: string; label: string; detail: string; weight: number; category: string }; trust?: boolean }) {
  const c = trust ? "var(--low)" : "var(--crit)";
  const ink = trust ? "var(--low-ink)" : "var(--crit-ink)";
  return (
    <li className="card-flat flex gap-3 p-3">
      <span className="mt-[5px] h-[6px] w-[6px] shrink-0 rounded-full" style={{ background: c }} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-[13px] font-semibold">{r.label}</span>
          <span className="tag">{CAT[r.category] ?? r.category}</span>
        </div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-2)]">{r.detail}</p>
      </div>
      <span className="mono shrink-0 text-[12px] font-semibold" style={{ color: ink }}>{trust ? "−" : "+"}{r.weight}</span>
    </li>
  );
}

/* ---------------- misc ---------------- */

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mono rounded-[5px] border border-[var(--line)] bg-[var(--surface-2)] px-1.5 py-[1px] text-[10.5px] font-medium text-[var(--ink-3)]">
      {children}
    </kbd>
  );
}

export function Pulse({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-2 text-[11.5px] font-medium text-[var(--ink-2)]">
      <span className="relative flex h-2 w-2">
        <span className="breathe absolute inset-0 rounded-full bg-[var(--low)]" />
        <span className="absolute inset-[2px] rounded-full bg-[var(--low)]" />
      </span>
      {label}
    </span>
  );
}

export function Empty({ title, body, icon }: { title: string; body?: string; icon?: React.ReactNode }) {
  return (
    <div className="grid place-content-center py-16 text-center">
      <div className="mx-auto grid h-12 w-12 place-content-center rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink-3)]">
        {icon ?? <Mark size={24} />}
      </div>
      <h3 className="mt-4 text-[14px] font-semibold">{title}</h3>
      {body && <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-[var(--ink-2)]">{body}</p>}
    </div>
  );
}

/** Tiny hook: keyboard shortcut that ignores typing contexts. */
export function useKey(handler: (e: KeyboardEvent) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const on = (e: KeyboardEvent) => ref.current(e);
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
}

export const isTyping = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
};

export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useMemoSorted<T>(rows: T[], key: keyof T | null, dir: 1 | -1) {
  return useMemo(() => {
    if (!key) return rows;
    return [...rows].sort((a, b) => {
      const x = a[key] as any, y = b[key] as any;
      if (typeof x === "number" && typeof y === "number") return (x - y) * dir;
      return String(x ?? "").localeCompare(String(y ?? "")) * dir;
    });
  }, [rows, key, dir]);
}
