"use client";

import { LEVEL_META, type RiskLevel } from "@/lib/risk";

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <defs>
        <linearGradient id="psg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <path d="M16 2.5 27 6.5v9.2c0 7-4.6 12.2-11 14.3-6.4-2.1-11-7.3-11-14.3V6.5L16 2.5Z" fill="url(#psg)" opacity=".18" stroke="url(#psg)" strokeWidth="1.6" />
      <path d="M11 16.2l3.4 3.4L21.5 12" fill="none" stroke="url(#psg)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LevelPill({ level, small }: { level: RiskLevel | string; small?: boolean }) {
  const m = LEVEL_META[(level as RiskLevel)] ?? LEVEL_META.low;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border ${m.border} ${m.bg} ${m.text} ${small ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs"} font-medium`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

const RING: Record<string, string> = {
  low: "#34d399", medium: "#fbbf24", high: "#fb923c", critical: "#f43f5e",
};

export function Gauge({ score, level, size = 168, label = "Risk Score" }: { score: number; level: string; size?: number; label?: string }) {
  const r = size / 2 - 14;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const color = RING[level] ?? "#38bdf8";
  return (
    <div className="relative" style={{ width: size, height: size }} role="img" aria-label={`${label} ${score} out of 100, ${level} risk`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1c2740" strokeWidth="11" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset .9s cubic-bezier(.22,1,.36,1), stroke .4s" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <div className="mono text-4xl font-semibold" style={{ color }}>{score}</div>
        <div className="text-[11px] uppercase tracking-wider text-slate-500">{label} /100</div>
      </div>
    </div>
  );
}

export function TrustBar({ value }: { value: number }) {
  const color = value >= 70 ? "#34d399" : value >= 40 ? "#fbbf24" : "#fb923c";
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-wider text-slate-500">Receiver trust score</span>
        <span className="mono text-sm font-semibold" style={{ color }}>{value}/100</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color, transition: "width .8s cubic-bezier(.22,1,.36,1)" }} />
      </div>
    </div>
  );
}

const CAT_ICON: Record<string, string> = {
  identity: "ID", age: "AGE", velocity: "VEL", behaviour: "BEH", reputation: "REP", device: "DEV", network: "NET",
};

export function ReasonRow({ r, trust }: { r: { code: string; label: string; detail: string; weight: number; category: string }; trust?: boolean }) {
  return (
    <li className="flex gap-3 rounded-xl border border-[#1c2740] bg-[#0b1220]/60 p-3">
      <span className={`mono mt-0.5 h-fit rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${trust ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>
        {CAT_ICON[r.category] ?? "•"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-slate-100">{r.label}</div>
        <div className="mt-0.5 text-xs leading-relaxed text-slate-400">{r.detail}</div>
      </div>
      <span className={`mono h-fit text-xs ${trust ? "text-emerald-400" : "text-rose-400"}`}>{trust ? "−" : "+"}{r.weight}</span>
    </li>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: "danger" | "ok" }) {
  return (
    <div className="panel p-4">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mono mt-1.5 text-2xl font-semibold ${tone === "danger" ? "text-rose-300" : tone === "ok" ? "text-emerald-300" : "text-slate-100"}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}
