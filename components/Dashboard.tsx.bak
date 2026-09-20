"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Logo, LevelPill, Gauge, TrustBar, ReasonRow, Stat } from "./ui";
import FraudGraph from "./FraudGraph";
import { LEVEL_META, type RiskLevel } from "@/lib/risk";

type Card = {
  id: string; handle: string; name: string; city: string | null; category: string | null; kyc: string;
  ageDays: number; score: number; level: string; action: string; trust: number; tx24h: number;
  totalTx: number; signals: number; links: number; topReasons: { label: string; detail: string }[];
};

const TABS = ["Overview", "Live Check", "Receivers", "Fraud Network", "Transactions"] as const;
type Tab = (typeof TABS)[number];

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export default function Dashboard({ cards, nodes, edges, recent, stats }: {
  cards: Card[];
  nodes: any[]; edges: any[];
  recent: { receiver: string; sender: string; amount: number; at: string }[];
  stats: { receivers: number; flagged: number; signals: number; clusters: number; tx24h: number; valueProtected: number };
}) {
  const [tab, setTab] = useState<Tab>("Overview");

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-[#1c2740] bg-[#070b14]/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-6 py-3">
          <Logo />
          <div>
            <div className="text-[15px] font-semibold leading-none">PayShield</div>
            <div className="mt-1 text-[11px] text-slate-500">AI Police for Digital Payments · Pre-payment risk layer</div>
          </div>
          <nav className="ml-6 flex flex-wrap gap-1">
            {TABS.map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${tab === t ? "bg-sky-500/15 text-sky-300" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"}`}>
                {t}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <a href="/pay" className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-300 hover:bg-sky-500/20">Open pay app ↗</a>
            <span className="hidden items-center gap-2 text-xs text-slate-500 lg:flex">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Risk engine live
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-6">
        {tab === "Overview" && <Overview cards={cards} stats={stats} nodes={nodes} edges={edges} onOpen={() => setTab("Live Check")} />}
        {tab === "Live Check" && <LiveCheck cards={cards} />}
        {tab === "Receivers" && <Receivers cards={cards} />}
        {tab === "Fraud Network" && (
          <section className="panel p-6">
            <h2 className="text-lg font-semibold">Fraud network analysis</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">
              Fraudsters rarely work through one account. PayShield represents receivers, devices and money movement as a graph, so a
              single confirmed complaint raises the risk on every account it touches.
            </p>
            <div className="mt-4"><FraudGraph nodes={nodes} edges={edges} /></div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {edges.map((e: any, i: number) => (
                <div key={i} className="rounded-xl border border-[#1c2740] bg-[#0b1220]/60 p-3">
                  <div className="mono text-[11px] text-rose-300">{e.type.replace(/_/g, " ")}</div>
                  <div className="mt-1 text-xs text-slate-400">{e.detail}</div>
                </div>
              ))}
            </div>
          </section>
        )}
        {tab === "Transactions" && <Transactions recent={recent} />}
      </main>

      <footer className="mx-auto max-w-[1400px] px-6 pb-10 pt-2 text-xs text-slate-600">
        Prototype running on synthetic fintech data. In production, partner banks and wallets supply signals over secure APIs and
        PayShield returns risk score, level, reasons and a recommended action — without exposing customer data.
      </footer>
    </div>
  );
}

function Overview({ cards, stats, nodes, edges, onOpen }: any) {
  const critical = cards.filter((c: Card) => c.level === "critical" || c.level === "high");
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Stat label="Receivers monitored" value={stats.receivers} />
        <Stat label="High / critical risk" value={stats.flagged} tone="danger" sub="would be blocked or held" />
        <Stat label="Fraud signals" value={stats.signals} sub="complaints + engine detections" />
        <Stat label="Payments seen · 24h" value={stats.tx24h.toLocaleString("en-IN")} />
        <Stat label="Network link types" value={stats.clusters} />
        <Stat label="Exposure stopped · 24h" value={inr(stats.valueProtected)} tone="ok" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <section className="panel p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Accounts the AI police is holding</h2>
            <button onClick={onOpen} className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs text-sky-300 hover:bg-sky-500/20">Run a live check →</button>
          </div>
          <div className="mt-4 space-y-3">
            {critical.map((c: Card) => (
              <div key={c.id} className="rounded-xl border border-[#1c2740] bg-[#0b1220]/60 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="mono text-sm text-slate-200">{c.handle}</span>
                  <LevelPill level={c.level as RiskLevel} small />
                  <span className="mono ml-auto text-lg font-semibold text-rose-300">{c.score}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>{c.ageDays}d old</span><span>KYC {c.kyc}</span>
                  <span>{c.tx24h} txn/24h</span><span>{c.signals} signals</span><span>{c.links} network links</span>
                </div>
                <ul className="mt-2 space-y-1">
                  {c.topReasons.map((r, i) => (
                    <li key={i} className="text-xs text-slate-400">• <span className="text-slate-300">{r.label}</span> — {r.detail}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="panel p-6">
          <h2 className="text-lg font-semibold">Fraud network</h2>
          <p className="mt-1 text-sm text-slate-400">Shared devices and onward transfers link these accounts into one cluster.</p>
          <div className="mt-2"><FraudGraph nodes={nodes} edges={edges} /></div>
        </section>
      </div>
    </div>
  );
}

const DEMO_AMOUNTS = [500, 2500, 10000, 45000];

function LiveCheck({ cards }: { cards: Card[] }) {
  const [handle, setHandle] = useState(cards.find((c) => c.level === "critical")?.handle ?? cards[0]?.handle ?? "");
  const [amount, setAmount] = useState(10000);
  const [stage, setStage] = useState<"idle" | "scanning" | "done">("idle");
  const [res, setRes] = useState<any>(null);
  const [, start] = useTransition();
  const router = useRouter();

  async function run(simulateKyc?: string) {
    setStage("scanning"); setRes(null);
    const t0 = Date.now();
    const r = await fetch("/api/risk", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ handle, amount, sender: "demo@payshield", simulateKyc }) })
      .then(async (x) => ({ ok: x.ok, body: await x.json() }))
      .catch(() => ({ ok: false, body: { error: "Risk service is unavailable" } }));
    const wait = Math.max(0, 1100 - (Date.now() - t0));
    setTimeout(() => { setRes(r.ok ? r.body : { error: r.body.error }); setStage("done"); }, wait);
  }

  async function setKyc(kyc: string) {
    await run(kyc);
    start(() => router.refresh());
  }

  const a = res?.assessment;
  const meta = a ? LEVEL_META[a.level as RiskLevel] : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
      <section className="panel h-fit p-6">
        <h2 className="text-lg font-semibold">AI police check</h2>
        <p className="mt-1 text-sm text-slate-400">Scan QR or enter the receiver, set the amount, and PayShield decides before the money moves.</p>

        <label className="mt-5 block text-xs uppercase tracking-wider text-slate-500">Receiver (UPI handle)</label>
        <input value={handle} onChange={(e) => setHandle(e.target.value)}
          className="mono mt-1.5 w-full rounded-xl border border-[#1c2740] bg-[#0b1220] px-3 py-2.5 text-sm outline-none focus:border-sky-500/50" />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {cards.map((c) => (
            <button key={c.id} onClick={() => setHandle(c.handle)}
              className={`mono rounded-md border px-2 py-1 text-[10px] ${handle === c.handle ? "border-sky-500/50 bg-sky-500/10 text-sky-300" : "border-[#1c2740] text-slate-400 hover:text-slate-200"}`}>
              {c.handle.split("@")[0]}
            </button>
          ))}
        </div>

        <label className="mt-5 block text-xs uppercase tracking-wider text-slate-500">Amount</label>
        <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))}
          className="mono mt-1.5 w-full rounded-xl border border-[#1c2740] bg-[#0b1220] px-3 py-2.5 text-sm outline-none focus:border-sky-500/50" />
        <div className="mt-2 flex gap-1.5">
          {DEMO_AMOUNTS.map((v) => (
            <button key={v} onClick={() => setAmount(v)} className="mono rounded-md border border-[#1c2740] px-2 py-1 text-[10px] text-slate-400 hover:text-slate-200">{inr(v)}</button>
          ))}
        </div>

        <button onClick={() => run()} disabled={stage === "scanning" || !handle || amount <= 0 || amount > 200000}
          className="mt-5 w-full rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 py-3 text-sm font-semibold text-white disabled:opacity-60">
          {stage === "scanning" ? "Analysing…" : "Analyse this payment"}
        </button>

        <div className="mt-6 rounded-xl border border-[#1c2740] bg-[#0b1220]/60 p-4">
          <div className="text-xs uppercase tracking-wider text-slate-500">Dynamic trust demo</div>
          <p className="mt-1 text-xs text-slate-400">A receiver is never permanently a "scammer". Change their verification state and re-run — the score moves live.</p>
          <div className="mt-3 flex gap-2">
            {["unverified", "partial", "verified"].map((k) => (
              <button key={k} onClick={() => setKyc(k)} className="flex-1 rounded-lg border border-[#1c2740] px-2 py-1.5 text-[11px] capitalize text-slate-300 hover:border-sky-500/40 hover:text-sky-300">{k}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="panel min-h-[520px] p-6">
        {stage === "idle" && <Empty />}
        {stage === "scanning" && <Scanning handle={handle} />}
        {stage === "done" && a && (
          <div className="pop">
            <div className="flex flex-wrap items-start gap-6">
              <Gauge score={a.score} level={a.level} />
              <div className="min-w-[260px] flex-1">
                <LevelPill level={a.level} />
                <h3 className="mt-3 text-xl font-semibold">{res.receiver.display_name}</h3>
                <div className="mono mt-0.5 text-sm text-slate-400">{res.receiver.handle}</div>
                <p className="mt-3 text-sm text-slate-300">{a.headline}</p>
                <div className={`mt-4 rounded-xl border p-3 ${meta!.border} ${meta!.bg}`}>
                  <div className="text-[11px] uppercase tracking-wider text-slate-400">Recommended action</div>
                  <div className={`mt-0.5 text-sm font-semibold ${meta!.text}`}>{meta!.action} · {inr(a.amount)}</div>
                </div>
                <div className="mt-4"><TrustBar value={a.trustScore} /></div>
              </div>
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              <div>
                <h4 className="text-sm font-semibold text-slate-200">Why this was flagged</h4>
                <ul className="mt-2 space-y-2">
                  {a.reasons.length ? a.reasons.map((r: any) => <ReasonRow key={r.code} r={r} />) : <li className="text-sm text-slate-500">No risk signals detected.</li>}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-200">Trust signals in the receiver&apos;s favour</h4>
                <ul className="mt-2 space-y-2">
                  {a.positives.length ? a.positives.map((r: any) => <ReasonRow key={r.code} r={r} trust />) : <li className="text-sm text-slate-500">No trust signals yet.</li>}
                </ul>
                {res.receiver.links?.length > 0 && (
                  <div className="mt-4 rounded-xl border border-rose-500/25 bg-rose-500/5 p-3">
                    <div className="text-xs font-semibold text-rose-300">Fraud graph</div>
                    <div className="mono mt-1 space-y-0.5 text-[11px] text-slate-400">
                      {res.receiver.links.map((l: any, i: number) => (
                        <div key={i}>{res.receiver.handle.split("@")[0]} → <span className="text-slate-500">{l.link_type.replace(/_/g, " ")}</span> → {l.handle.split("@")[0]} {l.flagged && <span className="text-rose-400">⚑</span>}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {stage === "done" && !a && <div className="grid min-h-[420px] place-content-center text-center"><div className="text-sm text-rose-300">{res?.error || "Unable to analyse this payment."}</div><button onClick={() => setStage("idle")} className="mt-4 text-xs text-sky-300">Try again</button></div>}
      </section>
    </div>
  );
}

function Empty() {
  return (
    <div className="grid h-full place-content-center text-center text-slate-500">
      <Logo size={48} />
      <p className="mt-4 text-sm">Pick a receiver and an amount, then run the check.</p>
      <p className="mt-1 text-xs">PayShield evaluates identity, age, velocity, behaviour, reputation, device and network signals.</p>
    </div>
  );
}

const STEPS = ["Resolving receiver identity", "Reading account age & KYC state", "Scanning transaction velocity", "Checking fraud complaint history", "Tracing device & network links", "Scoring and explaining"];

function Scanning({ handle }: { handle: string }) {
  return (
    <div className="grid h-full place-content-center">
      <div className="relative mx-auto h-24 w-24 overflow-hidden rounded-2xl border border-sky-500/30 bg-sky-500/5">
        <div className="scanline absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-sky-400/40 to-transparent" />
      </div>
      <p className="mono mt-5 text-center text-sm text-sky-300">Analysing {handle}</p>
      <ul className="mt-4 space-y-1.5">
        {STEPS.map((s, i) => (
          <li key={s} className="pop text-xs text-slate-400" style={{ animationDelay: `${i * 140}ms` }}>✓ {s}</li>
        ))}
      </ul>
    </div>
  );
}

function Receivers({ cards }: { cards: Card[] }) {
  const [q, setQ] = useState("");
  const list = cards.filter((c) => (c.handle + c.name).toLowerCase().includes(q.toLowerCase()));
  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center gap-3 border-b border-[#1c2740] p-4">
        <h2 className="text-lg font-semibold">Receiver intelligence</h2>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search receivers…"
          className="ml-auto w-64 rounded-lg border border-[#1c2740] bg-[#0b1220] px-3 py-1.5 text-sm outline-none focus:border-sky-500/50" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wider text-slate-500">
            <tr className="border-b border-[#1c2740]">
              {["Receiver", "KYC", "Age", "24h txn", "Signals", "Trust", "Risk", "Decision"].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="border-b border-[#131c30] hover:bg-white/[.02]">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-100">{c.name}</div>
                  <div className="mono text-xs text-slate-500">{c.handle}</div>
                </td>
                <td className="px-4 py-3 capitalize text-slate-300">{c.kyc}</td>
                <td className="mono px-4 py-3 text-slate-400">{c.ageDays < 400 ? `${c.ageDays}d` : `${Math.round(c.ageDays / 365)}y`}</td>
                <td className="mono px-4 py-3 text-slate-400">{c.tx24h}</td>
                <td className="mono px-4 py-3">{c.signals ? <span className="text-rose-300">{c.signals}</span> : <span className="text-slate-600">0</span>}</td>
                <td className="px-4 py-3 w-36"><div className="h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full" style={{ width: `${c.trust}%`, background: c.trust >= 70 ? "#34d399" : c.trust >= 40 ? "#fbbf24" : "#fb923c" }} /></div><div className="mono mt-1 text-[10px] text-slate-500">{c.trust}/100</div></td>
                <td className="mono px-4 py-3 text-base font-semibold" style={{ color: { low: "#34d399", medium: "#fbbf24", high: "#fb923c", critical: "#f43f5e" }[c.level] }}>{c.score}</td>
                <td className="px-4 py-3"><LevelPill level={c.level as RiskLevel} small /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Transactions({ recent }: { recent: { receiver: string; sender: string; amount: number; at: string }[] }) {
  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-[#1c2740] p-4"><h2 className="text-lg font-semibold">Live payment feed</h2></div>
      <div className="max-h-[70vh] overflow-y-auto">
        {recent.map((t, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-[#131c30] px-4 py-2.5 text-sm">
            <span className="mono w-40 shrink-0 text-slate-500">{new Date(t.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
            <span className="mono text-slate-400">{t.sender}</span>
            <span className="text-slate-600">→</span>
            <span className="mono text-slate-200">{t.receiver}</span>
            <span className="mono ml-auto text-slate-300">{inr(t.amount)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
