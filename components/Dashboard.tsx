"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import FraudGraph from "./FraudGraph";
import {
  Brand, Card, Badge, ScoreDial, TrustMeter, RiskBar, Triage, Stat, Reason, Kbd, Pulse, Empty,
  LV, lv, inr, compactInr, useKey, isTyping, type Level,
} from "./dash-ui";

type RCard = {
  id: string; handle: string; name: string; city: string | null; category: string | null; kyc: string;
  ageDays: number; score: number; level: string; action: string; trust: number; tx24h: number;
  totalTx: number; signals: number; links: number; topReasons: { label: string; detail: string }[];
};

type Tx = { receiver: string; sender: string; amount: number; at: string };

const TABS = [
  { id: "overview", label: "Overview", hint: "Triage the whole book" },
  { id: "check", label: "Live check", hint: "Score a payment now" },
  { id: "receivers", label: "Receivers", hint: "Account intelligence" },
  { id: "network", label: "Fraud network", hint: "Linked accounts graph" },
  { id: "feed", label: "Payment feed", hint: "Everything flowing through" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const ICON: Record<TabId, React.ReactNode> = {
  overview: <path d="M3 10.5 10 4l7 6.5V16a1 1 0 0 1-1 1h-3.5v-4h-5v4H4a1 1 0 0 1-1-1v-5.5Z" />,
  check: <path d="M10 2.5 16.5 5v5c0 4-2.7 7-6.5 8.2C6.2 17 3.5 14 3.5 10V5L10 2.5Zm-2.6 7.7 2 2 3.8-4.2" />,
  receivers: <path d="M3.5 5.5h13M3.5 10h13M3.5 14.5h13" />,
  network: <path d="M10 3.5v4m0 5v4M6.5 10h-3m13 0h-3M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />,
  feed: <path d="M3 6h9m-9 4h14M3 14h6m8-8-3 3 3 3" />,
};

/* ============================================================ */

export default function Dashboard({
  cards, nodes, edges, recent, stats,
}: {
  cards: RCard[];
  nodes: any[]; edges: any[];
  recent: Tx[];
  stats: { receivers: number; flagged: number; signals: number; clusters: number; tx24h: number; valueProtected: number };
}) {
  const [tab, setTab] = useState<TabId>("overview");
  const [handle, setHandle] = useState(
    cards.find((c) => c.level === "critical")?.handle ?? cards[0]?.handle ?? ""
  );
  const [filter, setFilter] = useState<Level | null>(null);
  const [palette, setPalette] = useState(false);

  const openCheck = (h?: string) => { if (h) setHandle(h); setTab("check"); };

  useKey((e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((v) => !v); return; }
    if (isTyping(e)) return;
    if (e.key === "/") { e.preventDefault(); setPalette(true); return; }
    const n = Number(e.key);
    if (n >= 1 && n <= TABS.length) setTab(TABS[n - 1].id);
  });

  const meta = TABS.find((t) => t.id === tab)!;

  return (
    <div className="ps-light min-h-screen">
      {/* ---------------- sidebar ---------------- */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[228px] flex-col border-r border-[var(--line)] bg-[var(--surface)] lg:flex">
        <div className="px-5 py-4"><Brand /></div>
        <nav className="mt-1 flex-1 px-3" aria-label="Sections">
          {TABS.map((t, i) => {
            const on = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} aria-current={on ? "page" : undefined}
                className={`group relative mb-0.5 flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13.5px] font-medium transition ${
                  on ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]" : "text-[var(--ink-2)] hover:bg-[var(--sunk)] hover:text-[var(--ink)]"
                }`}>
                {on && <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--accent)]" />}
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"
                  strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-80">{ICON[t.id]}</svg>
                <span className="flex-1">{t.label}</span>
                <Kbd>{i + 1}</Kbd>
              </button>
            );
          })}
        </nav>
        <div className="border-t border-[var(--line)] p-3">
          <a href="/pay" className="btn w-full justify-center">Open pay app ↗</a>
          <button onClick={() => setPalette(true)} className="btn btn-quiet mt-1.5 w-full justify-between">
            <span>Quick jump</span><Kbd>⌘K</Kbd>
          </button>
          <p className="mt-3 px-1 text-[10.5px] leading-relaxed text-[var(--ink-3)]">
            Synthetic fintech data · prototype. Scores are computed live by the on-device risk engine.
          </p>
        </div>
      </aside>

      {/* ---------------- main ---------------- */}
      <div className="lg:pl-[228px]">
        <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[rgba(242,242,239,.82)] backdrop-blur-xl">
          <div className="flex items-center gap-3 px-4 py-3 lg:px-7">
            <div className="lg:hidden"><Brand /></div>
            <div className="hidden min-w-0 lg:block">
              <h1 className="h1">{meta.label}</h1>
              <p className="mt-0.5 text-[12px] text-[var(--ink-3)]">{meta.hint}</p>
            </div>
            <div className="ml-auto flex items-center gap-2.5">
              <span className="hidden lg:block"><Pulse label="Risk engine live" /></span>
              <button onClick={() => setPalette(true)} className="btn hidden sm:inline-flex">
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="9" cy="9" r="5.5" /><path d="m13.5 13.5 3 3" />
                </svg>
                Search<Kbd>⌘K</Kbd>
              </button>
              <button onClick={() => openCheck()} className="btn btn-primary">Run a check</button>
            </div>
          </div>
          {/* mobile tab rail */}
          <div className="flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-medium ${
                  tab === t.id ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]" : "text-[var(--ink-2)]"
                }`}>{t.label}</button>
            ))}
          </div>
        </header>

        <main key={tab} className="rise mx-auto max-w-[1360px] px-4 py-5 lg:px-7 lg:py-6">
          {tab === "overview" && (
            <Overview cards={cards} stats={stats} nodes={nodes} edges={edges} recent={recent}
              filter={filter} setFilter={setFilter} onCheck={openCheck} onAll={() => setTab("receivers")} />
          )}
          {tab === "check" && <LiveCheck cards={cards} handle={handle} setHandle={setHandle} />}
          {tab === "receivers" && <Receivers cards={cards} filter={filter} setFilter={setFilter} onCheck={openCheck} />}
          {tab === "network" && <Network nodes={nodes} edges={edges} onCheck={openCheck} />}
          {tab === "feed" && <Feed recent={recent} />}
        </main>

        <footer className="mx-auto max-w-[1360px] px-4 pb-10 text-[11.5px] leading-relaxed text-[var(--ink-3)] lg:px-7">
          Prototype on synthetic fintech data. In production, partner banks and wallets supply signals over secure APIs and PayShield
          returns score, level, reasons and a recommended action — without exposing customer data. A score of 91–100 is always blocked.
        </footer>
      </div>

      {palette && <Palette cards={cards} onClose={() => setPalette(false)} onTab={setTab} onCheck={openCheck} />}
    </div>
  );
}

/* ============================================================
   Overview
   ============================================================ */

function Overview({ cards, stats, nodes, edges, recent, filter, setFilter, onCheck, onAll }: any) {
  const counts = useMemo(() => {
    const c: Record<Level, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    cards.forEach((x: RCard) => { c[lv(x.level)]++; });
    return c;
  }, [cards]);

  const queue = useMemo(
    () => cards.filter((c: RCard) => (filter ? lv(c.level) === filter : c.level === "critical" || c.level === "high")),
    [cards, filter]
  );

  const hours = useMemo(() => {
    const b = new Array(12).fill(0);
    const now = Date.now();
    recent.forEach((t: Tx) => {
      const h = Math.floor((now - new Date(t.at).getTime()) / 7200000);
      if (h >= 0 && h < 12) b[11 - h]++;
    });
    return b;
  }, [recent]);

  const worst = cards[0] as RCard | undefined;

  return (
    <div className="space-y-5">
      {/* triage band */}
      <div className="card grid gap-6 p-5 lg:grid-cols-[1.35fr_1px_1fr]">
        <div className="min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h2 className="h2">Risk triage · {cards.length} receivers</h2>
              <p className="mt-1 text-[12.5px] text-[var(--ink-2)]">
                Click a band to filter the hold queue{filter ? " · filter active" : ""}.
              </p>
            </div>
            {filter && <button onClick={() => setFilter(null)} className="btn btn-quiet">Clear</button>}
          </div>
          <div className="mt-4"><Triage counts={counts} active={filter} onPick={setFilter} /></div>
        </div>
        <div className="hidden bg-[var(--line)] lg:block" />
        <div className="flex min-w-0 flex-col justify-between gap-4">
          <div>
            <div className="lbl">Highest-risk account right now</div>
            {worst ? (
              <button onClick={() => onCheck(worst.handle)} className="mt-2 flex w-full items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3 text-left transition hover:border-[var(--accent-line)]">
                <span className="mono text-[28px] font-semibold leading-none" style={{ color: LV[lv(worst.level)].ink }}>{worst.score}</span>
                <span className="min-w-0 flex-1">
                  <span className="mono block truncate text-[13px] font-semibold">{worst.handle}</span>
                  <span className="block truncate text-[11.5px] text-[var(--ink-3)]">{worst.name} · {worst.signals} signals · {worst.links} links</span>
                </span>
                <Badge level={worst.level} size="sm" />
              </button>
            ) : <p className="mt-2 text-[13px] text-[var(--ink-3)]">No receivers loaded.</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0 rounded-xl p-3" style={{ background: "var(--crit-soft)" }}>
              <div className="lbl" style={{ color: "var(--crit-ink)" }}>Would be held</div>
              <div className="mono mt-1 text-[22px] font-semibold leading-none" style={{ color: "var(--crit-ink)" }}>{stats.flagged}</div>
            </div>
            <div className="min-w-0 rounded-xl p-3" style={{ background: "var(--low-soft)" }}>
              <div className="lbl" style={{ color: "var(--low-ink)" }}>Exposure stopped</div>
              <div className="mono mt-1 text-[22px] font-semibold leading-none" style={{ color: "var(--low-ink)" }}>{compactInr(stats.valueProtected)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Payments seen · 24h" value={stats.tx24h.toLocaleString("en-IN")} bars={hours} tone="brand" hint="Last 24h in 2-hour buckets" />
        <Stat label="Fraud signals" value={stats.signals} tone="critical" hint="Complaints + engine detections" />
        <Stat label="Network link types" value={stats.clusters} hint="Shared devices, onward transfers, common senders" />
        <Stat label="Clean receivers" value={counts.low} tone="low" hint="Scored 30 or below — payment proceeds" />
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[1.15fr_1fr]">
        <Card
          title={filter ? `${LV[filter as Level].label} accounts` : "Hold queue"}
          sub={filter ? undefined : "High and critical accounts, worst first. A score of 91+ is blocked outright."}
          actions={<button onClick={onAll} className="btn btn-quiet">All receivers →</button>}
        >
          {queue.length === 0 ? (
            <Empty title="Nothing in the queue" body="No receiver currently sits in this band." />
          ) : (
            <ul className="space-y-2.5">
              {queue.map((c: RCard, i: number) => (
                <li key={c.id}>
                  <button onClick={() => onCheck(c.handle)}
                    className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3.5 text-left transition hover:border-[var(--accent-line)] hover:bg-white">
                    <div className="flex items-center gap-3">
                      <span className="mono w-5 shrink-0 text-[11px] text-[var(--ink-3)]">{String(i + 1).padStart(2, "0")}</span>
                      <span className="min-w-0 flex-1">
                        <span className="mono block truncate text-[13.5px] font-semibold">{c.handle}</span>
                        <span className="block truncate text-[11.5px] text-[var(--ink-3)]">{c.name}{c.city ? ` · ${c.city}` : ""}</span>
                      </span>
                      <Badge level={c.level} size="sm" />
                      <span className="mono w-9 shrink-0 text-right text-[19px] font-semibold" style={{ color: LV[lv(c.level)].ink }}>{c.score}</span>
                    </div>
                    <div className="mt-2.5"><RiskBar score={c.score} level={c.level} height={5} /></div>
                    <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-[var(--ink-3)]">
                      <span>{c.ageDays < 400 ? `${c.ageDays}d old` : `${Math.round(c.ageDays / 365)}y old`}</span>
                      <span className="capitalize">KYC {c.kyc}</span>
                      <span>{c.tx24h} txn/24h</span>
                      <span>{c.signals} signals</span>
                      <span>{c.links} links</span>
                    </div>
                    <ul className="mt-2 space-y-1">
                      {c.topReasons.map((r, k) => (
                        <li key={k} className="flex gap-2 text-[12px] leading-relaxed text-[var(--ink-2)]">
                          <span className="mt-[6px] h-[4px] w-[4px] shrink-0 rounded-full" style={{ background: LV[lv(c.level)].mark }} />
                          <span><span className="font-medium text-[var(--ink)]">{r.label}</span> — {r.detail}</span>
                        </li>
                      ))}
                    </ul>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Fraud network" sub="Fraudsters rarely work through one account. One confirmed complaint raises risk on every account it touches.">
          <FraudGraph nodes={nodes} edges={edges} height={330} onSelect={onCheck} />
        </Card>
      </div>
    </div>
  );
}

/* ============================================================
   Live check
   ============================================================ */

const AMOUNTS = [500, 2500, 10000, 45000];
const STEPS = [
  "Resolving receiver identity",
  "Reading account age & KYC state",
  "Scanning transaction velocity",
  "Checking fraud complaint history",
  "Tracing device & network links",
  "Scoring and explaining",
];

function LiveCheck({ cards, handle, setHandle }: { cards: RCard[]; handle: string; setHandle: (h: string) => void }) {
  const [amount, setAmount] = useState(10000);
  const [stage, setStage] = useState<"idle" | "scanning" | "done">("idle");
  const [res, setRes] = useState<any>(null);
  const [, start] = useTransition();
  const router = useRouter();
  const tooBig = amount > 200000;

  async function run(simulateKyc?: string) {
    setStage("scanning"); setRes(null);
    const t0 = Date.now();
    const r = await fetch("/api/risk", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ handle, amount, sender: "demo@payshield", simulateKyc }),
    })
      .then(async (x) => ({ ok: x.ok, body: await x.json() }))
      .catch(() => ({ ok: false, body: { error: "Risk service is unavailable" } }));
    const wait = Math.max(0, 1150 - (Date.now() - t0));
    setTimeout(() => { setRes(r.ok ? r.body : { error: r.body.error }); setStage("done"); }, wait);
  }

  async function setKyc(kyc: string) { await run(kyc); start(() => router.refresh()); }

  const a = res?.assessment;
  const m = a ? LV[lv(a.level)] : null;
  const blocked = a && a.score >= 91;

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[372px_1fr]">
      <div className="space-y-4 xl:sticky xl:top-[86px] xl:self-start">
        <Card title="Check a payment" sub="Enter the receiver and amount. PayShield decides before the money moves.">
          <label className="lbl mt-1 block" htmlFor="rcv">Receiver UPI handle</label>
          <input id="rcv" value={handle} onChange={(e) => setHandle(e.target.value)}
            className="field mono mt-1.5" placeholder="name@bank"
            onKeyDown={(e) => { if (e.key === "Enter" && handle && !tooBig) run(); }} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {cards.map((c) => {
              const on = handle === c.handle;
              const mm = LV[lv(c.level)];
              return (
                <button key={c.id} onClick={() => setHandle(c.handle)}
                  className="mono flex items-center gap-1.5 rounded-md border px-1.5 py-1 text-[10.5px] font-medium transition"
                  style={{
                    borderColor: on ? "var(--accent-line)" : "var(--line)",
                    background: on ? "var(--accent-soft)" : "var(--surface)",
                    color: on ? "var(--accent-ink)" : "var(--ink-2)",
                  }}>
                  <span className="h-[5px] w-[5px] rounded-full" style={{ background: mm.mark }} />
                  {c.handle.split("@")[0]}
                </button>
              );
            })}
          </div>

          <label className="lbl mt-5 block" htmlFor="amt">Amount</label>
          <input id="amt" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))}
            className="field mono mt-1.5" />
          <div className="mt-2 flex gap-1.5">
            {AMOUNTS.map((v) => (
              <button key={v} onClick={() => setAmount(v)}
                className={`mono flex-1 rounded-md border px-2 py-1 text-[10.5px] font-medium transition ${
                  amount === v ? "border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent-ink)]" : "border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--sunk)]"
                }`}>{inr(v)}</button>
            ))}
          </div>
          {tooBig && <p className="mt-2 text-[12px] font-medium" style={{ color: "var(--crit-ink)" }}>Demo cap is ₹2,00,000 per payment.</p>}

          <button onClick={() => run()} disabled={stage === "scanning" || !handle || amount <= 0 || tooBig}
            className="btn btn-primary mt-4 w-full justify-center py-2.5">
            {stage === "scanning" ? "Analysing…" : "Analyse this payment"}
          </button>
          <p className="mt-2 text-center text-[11px] text-[var(--ink-3)]">Press <Kbd>Enter</Kbd> in the handle field to re-run</p>
        </Card>

        <Card title="Dynamic trust demo" sub="A receiver is never permanently a scammer. Change verification state and the score moves live.">
          <div className="flex gap-2">
            {["unverified", "partial", "verified"].map((k) => (
              <button key={k} onClick={() => setKyc(k)} disabled={stage === "scanning"}
                className="btn flex-1 justify-center capitalize">{k}</button>
            ))}
          </div>
          <p className="mt-2.5 text-[11px] leading-relaxed text-[var(--ink-3)]">
            Non-persistent simulation — the shared KYC database is not modified.
          </p>
        </Card>
      </div>

      <div className="card min-h-[560px] p-5">
        {stage === "idle" && (
          <Empty title="Ready when you are"
            body="Pick a receiver and amount, then run the check. PayShield weighs identity, account age, velocity, behaviour, reputation, device and network signals." />
        )}
        {stage === "scanning" && <Scanning handle={handle} />}
        {stage === "done" && a && m && (
          <div className="fade">
            <div className="flex flex-wrap items-start gap-7">
              <ScoreDial score={a.score} level={a.level} />
              <div className="min-w-[260px] flex-1">
                <Badge level={a.level} />
                <h3 className="mt-3 text-[22px] font-bold tracking-[-.02em]">{res.receiver.display_name}</h3>
                <div className="mono mt-0.5 text-[13px] text-[var(--ink-3)]">{res.receiver.handle}</div>
                <p className="mt-3 max-w-xl text-[13.5px] leading-relaxed text-[var(--ink-2)]">{a.headline}</p>

                <div className="mt-4 rounded-xl p-3.5" style={{ background: m.soft, boxShadow: `inset 0 0 0 1px ${m.mark}33` }}>
                  <div className="lbl" style={{ color: m.ink }}>Recommended action</div>
                  <div className="mt-1 text-[14.5px] font-semibold" style={{ color: m.ink }}>{m.action}</div>
                  <div className="mono mt-0.5 text-[12.5px]" style={{ color: m.ink, opacity: .85 }}>{inr(a.amount)} to {res.receiver.handle}</div>
                  {blocked && (
                    <div className="mt-2.5 flex items-start gap-2 border-t pt-2.5 text-[12px] font-medium" style={{ borderColor: `${m.mark}33`, color: m.ink }}>
                      <span>⛔</span><span>Hard rule: 91–100 is always blocked. Both the web UI and the Android bridge enforce this.</span>
                    </div>
                  )}
                </div>
                <div className="mt-4"><TrustMeter value={a.trustScore} /></div>
              </div>
            </div>

            <div className="mt-7 grid gap-5 lg:grid-cols-2">
              <div>
                <h4 className="lbl">Why this was flagged</h4>
                <ul className="mt-2.5 space-y-2">
                  {a.reasons.length
                    ? a.reasons.map((r: any) => <Reason key={r.code} r={r} />)
                    : <li className="card-flat p-3 text-[13px] text-[var(--ink-3)]">No risk signals detected.</li>}
                </ul>
              </div>
              <div>
                <h4 className="lbl">Trust signals in the receiver&apos;s favour</h4>
                <ul className="mt-2.5 space-y-2">
                  {a.positives.length
                    ? a.positives.map((r: any) => <Reason key={r.code} r={r} trust />)
                    : <li className="card-flat p-3 text-[13px] text-[var(--ink-3)]">No trust signals yet.</li>}
                </ul>
                {res.receiver.links?.length > 0 && (
                  <div className="mt-3 rounded-xl p-3" style={{ background: "var(--crit-soft)", boxShadow: "inset 0 0 0 1px var(--crit-line, rgba(229,52,90,.2))" }}>
                    <div className="lbl" style={{ color: "var(--crit-ink)" }}>Fraud graph links</div>
                    <div className="mono mt-1.5 space-y-1 text-[11.5px] text-[var(--ink-2)]">
                      {res.receiver.links.map((l: any, i: number) => (
                        <div key={i}>
                          {res.receiver.handle.split("@")[0]} <span className="text-[var(--ink-3)]">→ {l.link_type.replace(/_/g, " ")} →</span> {l.handle.split("@")[0]}
                          {l.flagged && <span style={{ color: "var(--crit-ink)" }}> ⚑ flagged</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {stage === "done" && !a && (
          <div className="grid min-h-[460px] place-content-center text-center">
            <p className="text-[13.5px] font-medium" style={{ color: "var(--crit-ink)" }}>{res?.error || "Unable to analyse this payment."}</p>
            <button onClick={() => setStage("idle")} className="btn mx-auto mt-4">Try again</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Scanning({ handle }: { handle: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(STEPS.length, s + 1)), 170);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="grid min-h-[480px] place-content-center">
      <div className="mx-auto h-1 w-56 overflow-hidden rounded-full bg-[var(--sunk)]">
        <div className="sweep h-full w-1/3 rounded-full" style={{ background: "var(--accent)" }} />
      </div>
      <p className="mono mt-5 text-center text-[13px] font-medium" style={{ color: "var(--accent-ink)" }}>Analysing {handle}</p>
      <ul className="mx-auto mt-5 space-y-2">
        {STEPS.map((s, i) => {
          const done = i < step;
          return (
            <li key={s} className="flex items-center gap-2.5 text-[12.5px]"
              style={{ color: done ? "var(--ink-2)" : "var(--ink-3)", opacity: i <= step ? 1 : .45, transition: "opacity .3s, color .3s" }}>
              <span className="grid h-4 w-4 place-content-center rounded-full text-[9px] text-white"
                style={{ background: done ? "var(--low)" : "#dcdcd4", transition: "background .3s" }}>✓</span>
              {s}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ============================================================
   Receivers
   ============================================================ */

type SortKey = "handle" | "kyc" | "ageDays" | "tx24h" | "signals" | "trust" | "score";

function Receivers({ cards, filter, setFilter, onCheck }: {
  cards: RCard[]; filter: Level | null; setFilter: (l: Level | null) => void; onCheck: (h: string) => void;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("score");
  const [dir, setDir] = useState<1 | -1>(-1);
  const search = useRef<HTMLInputElement>(null);

  useKey((e) => { if (!isTyping(e) && e.key === "f") { e.preventDefault(); search.current?.focus(); } });

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = cards.filter(
      (c) => (!filter || lv(c.level) === filter) &&
        (!needle || (c.handle + c.name + (c.city ?? "") + (c.category ?? "")).toLowerCase().includes(needle))
    );
    return out.sort((a, b) => {
      const x = a[sort] as any, y = b[sort] as any;
      return (typeof x === "number" ? x - y : String(x).localeCompare(String(y))) * dir;
    });
  }, [cards, q, filter, sort, dir]);

  const th = (key: SortKey, label: string, right?: boolean) => (
    <th key={key} className={right ? "text-right" : ""}>
      <button onClick={() => { setSort(key); setDir(sort === key ? (dir === 1 ? -1 : 1) : -1); }}
        className={`inline-flex items-center gap-1 ${right ? "flex-row-reverse" : ""} ${sort === key ? "text-[var(--ink)]" : ""}`}>
        {label}
        <span className="text-[9px]" style={{ opacity: sort === key ? 1 : .25 }}>{sort === key && dir === 1 ? "▲" : "▼"}</span>
      </button>
    </th>
  );

  return (
    <Card pad={false}
      title="Receiver intelligence"
      sub="Every monitored receiver with its live score. Click a row to run a full check."
      actions={
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {(["low", "medium", "high", "critical"] as Level[]).map((k) => (
              <button key={k} onClick={() => setFilter(filter === k ? null : k)} aria-pressed={filter === k}
                className="rounded-md px-2 py-1 text-[11px] font-semibold transition"
                style={{
                  background: filter === k ? LV[k].soft : "var(--surface-2)",
                  color: filter === k ? LV[k].ink : "var(--ink-3)",
                  boxShadow: `inset 0 0 0 1px ${filter === k ? LV[k].mark + "40" : "var(--line)"}`,
                }}>{LV[k].short}</button>
            ))}
          </div>
          <input ref={search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search receivers… (f)"
            className="field w-56 py-1.5 text-[13px]" />
        </div>
      }>
      <div className="max-h-[70vh] overflow-auto border-t border-[var(--line)]">
        <table className="grid-table">
          <thead>
            <tr>
              {th("handle", "Receiver")}
              {th("kyc", "KYC")}
              {th("ageDays", "Age")}
              {th("tx24h", "24h txn", true)}
              {th("signals", "Signals", true)}
              <th>Trust</th>
              {th("score", "Risk", true)}
              <th>Decision</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const m = LV[lv(c.level)];
              return (
                <tr key={c.id} onClick={() => onCheck(c.handle)} tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter") onCheck(c.handle); }}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <span className="h-6 w-[3px] shrink-0 rounded-full" style={{ background: m.mark }} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{c.name}</span>
                        <span className="mono block truncate text-[11.5px] text-[var(--ink-3)]">{c.handle}{c.city ? ` · ${c.city}` : ""}</span>
                      </span>
                    </div>
                  </td>
                  <td className="capitalize text-[var(--ink-2)]">{c.kyc}</td>
                  <td className="mono text-[var(--ink-2)]">{c.ageDays < 400 ? `${c.ageDays}d` : `${Math.round(c.ageDays / 365)}y`}</td>
                  <td className="mono text-right text-[var(--ink-2)]">{c.tx24h}</td>
                  <td className="mono text-right">
                    {c.signals
                      ? <span className="font-semibold" style={{ color: "var(--crit-ink)" }}>{c.signals}</span>
                      : <span className="text-[var(--ink-3)]">—</span>}
                  </td>
                  <td className="w-[124px]">
                    <div className="h-1.5 overflow-hidden rounded-full bg-[#ecece5]">
                      <div className="h-full rounded-full" style={{
                        width: `${c.trust}%`,
                        background: c.trust >= 70 ? "var(--low)" : c.trust >= 40 ? "var(--med)" : "var(--high)",
                      }} />
                    </div>
                    <div className="mono mt-1 text-[10.5px] text-[var(--ink-3)]">{c.trust}/100</div>
                  </td>
                  <td className="mono text-right text-[17px] font-semibold" style={{ color: m.ink }}>{c.score}</td>
                  <td><Badge level={c.level} size="sm" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <Empty title="No receivers match" body="Clear the search or the risk-band filter." />}
      </div>
    </Card>
  );
}

/* ============================================================
   Network
   ============================================================ */

function Network({ nodes, edges, onCheck }: { nodes: any[]; edges: any[]; onCheck: (h: string) => void }) {
  const types = useMemo(() => {
    const m = new Map<string, number>();
    edges.forEach((e: any) => m.set(e.type, (m.get(e.type) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [edges]);

  return (
    <div className="space-y-5">
      <Card title="Fraud network analysis"
        sub="Receivers, devices and money movement as one graph. A single confirmed complaint raises the risk on every account it touches.">
        <div className="mb-4 flex flex-wrap gap-2">
          {types.map(([t, n]) => (
            <span key={t} className="tag capitalize">{t.replace(/_/g, " ")} · {n}</span>
          ))}
        </div>
        <FraudGraph nodes={nodes} edges={edges} height={440} onSelect={onCheck} />
      </Card>

      <Card title="Detected links" sub={`${edges.length} relationships feeding the graph weight.`}>
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {edges.map((e: any, i: number) => (
            <div key={i} className="card-flat p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11.5px] font-semibold capitalize" style={{ color: "var(--crit-ink)" }}>{e.type.replace(/_/g, " ")}</span>
                <span className="mono text-[10.5px] text-[var(--ink-3)]">w {e.strength.toFixed(2)}</span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#ecece5]">
                <div className="h-full rounded-full" style={{ width: `${Math.round(e.strength * 100)}%`, background: "var(--crit)" }} />
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-[var(--ink-2)]">{e.detail}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ============================================================
   Feed
   ============================================================ */

function Feed({ recent }: { recent: Tx[] }) {
  const [q, setQ] = useState("");
  const [minAmt, setMinAmt] = useState(0);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return recent.filter((t) => t.amount >= minAmt && (!needle || (t.sender + t.receiver).toLowerCase().includes(needle)));
  }, [recent, q, minAmt]);

  const groups = useMemo(() => {
    const m = new Map<string, Tx[]>();
    rows.forEach((t) => {
      const k = new Date(t.at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
      (m.get(k) ?? m.set(k, []).get(k)!).push(t);
    });
    return [...m.entries()];
  }, [rows]);

  const total = rows.reduce((a, t) => a + t.amount, 0);
  const biggest = Math.max(1, ...rows.map((t) => t.amount));

  return (
    <Card pad={false}
      title="Payment feed"
      sub={`${rows.length} payments · ${inr(total)} total value`}
      actions={
        <div className="flex items-center gap-2">
          {[0, 5000, 25000].map((v) => (
            <button key={v} onClick={() => setMinAmt(v)}
              className={`whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                minAmt === v ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]" : "text-[var(--ink-3)] hover:bg-[var(--sunk)]"
              }`}>{v === 0 ? "All" : `≥ ${compactInr(v)}`}</button>
          ))}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search handles…"
            className="field w-52 py-1.5 text-[13px]" />
        </div>
      }>
      <div className="max-h-[70vh] overflow-auto border-t border-[var(--line)]">
        {groups.length === 0 && <Empty title="No payments match" body="Loosen the amount filter or clear the search." />}
        {groups.map(([day, list]) => (
          <div key={day}>
            <div className="sticky top-0 z-[1] flex items-center gap-3 border-b border-[var(--line)] bg-[var(--surface-2)] px-4 py-1.5">
              <span className="lbl">{day}</span>
              <span className="mono text-[11px] text-[var(--ink-3)]">{list.length} payments · {inr(list.reduce((a, t) => a + t.amount, 0))}</span>
            </div>
            {list.map((t, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-[var(--line-soft)] px-4 py-2 text-[13px] hover:bg-[#fafaf7]">
                <span className="mono w-14 shrink-0 text-[11.5px] text-[var(--ink-3)]">
                  {new Date(t.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="mono w-40 shrink-0 truncate text-[var(--ink-2)]">{t.sender}</span>
                <svg width="14" height="8" viewBox="0 0 14 8" fill="none" className="shrink-0 text-[var(--ink-3)]">
                  <path d="M0 4h12m-3.5-3L12 4 8.5 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                <span className="mono w-44 shrink-0 truncate font-medium">{t.receiver}</span>
                <span className="hidden h-1.5 flex-1 overflow-hidden rounded-full bg-[#f0f0ea] sm:block">
                  <span className="block h-full rounded-full" style={{ width: `${(t.amount / biggest) * 100}%`, background: "var(--accent)", opacity: .45 }} />
                </span>
                <span className="mono ml-auto shrink-0 text-right font-semibold">{inr(t.amount)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ============================================================
   Command palette
   ============================================================ */

function Palette({ cards, onClose, onTab, onCheck }: {
  cards: RCard[]; onClose: () => void; onTab: (t: TabId) => void; onCheck: (h: string) => void;
}) {
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const tabs = TABS.filter((t) => !needle || t.label.toLowerCase().includes(needle))
      .map((t) => ({ kind: "tab" as const, id: t.id, label: t.label, sub: t.hint }));
    const recv = cards
      .filter((c) => !needle || (c.handle + c.name).toLowerCase().includes(needle))
      .slice(0, 8)
      .map((c) => ({ kind: "receiver" as const, id: c.handle, label: c.handle, sub: `${c.name} · score ${c.score}`, level: c.level }));
    return [...tabs, ...recv];
  }, [q, cards]);

  useEffect(() => { setI(0); }, [q]);

  const pick = (n: number) => {
    const it = items[n];
    if (!it) return;
    if (it.kind === "tab") onTab(it.id as TabId); else onCheck(it.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-[rgba(21,23,28,.32)] px-4 pt-[12vh] backdrop-blur-sm"
      onClick={onClose} role="dialog" aria-modal="true" aria-label="Quick jump">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--line)] bg-white"
        style={{ boxShadow: "var(--shadow-lg)" }}>
        <div className="flex items-center gap-2.5 border-b border-[var(--line)] px-4 py-3">
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="var(--ink-3)" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="9" cy="9" r="5.5" /><path d="m13.5 13.5 3 3" />
          </svg>
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Jump to a section or receiver…"
            className="flex-1 bg-transparent text-[14px] outline-none focus-visible:outline-none placeholder:text-[var(--ink-3)]"
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") { e.preventDefault(); setI((v) => Math.min(items.length - 1, v + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setI((v) => Math.max(0, v - 1)); }
              if (e.key === "Enter") { e.preventDefault(); pick(i); }
            }} />
          <Kbd>esc</Kbd>
        </div>
        <ul className="max-h-[52vh] overflow-y-auto p-1.5">
          {items.map((it, n) => (
            <li key={it.kind + it.id}>
              <button onMouseEnter={() => setI(n)} onClick={() => pick(n)}
                className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left ${n === i ? "bg-[var(--accent-soft)]" : ""}`}>
                {it.kind === "receiver"
                  ? <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: LV[lv((it as any).level)].mark }} />
                  : <span className="h-2 w-2 shrink-0 rounded-[3px] bg-[var(--accent)]" />}
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[13.5px] font-medium ${it.kind === "receiver" ? "mono" : ""}`}>{it.label}</span>
                  <span className="block truncate text-[11.5px] text-[var(--ink-3)]">{it.sub}</span>
                </span>
                <span className="shrink-0 text-[10.5px] uppercase tracking-wider text-[var(--ink-3)]">{it.kind}</span>
              </button>
            </li>
          ))}
          {items.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-[var(--ink-3)]">Nothing matches.</li>}
        </ul>
        <div className="flex items-center gap-3 border-t border-[var(--line)] bg-[var(--surface-2)] px-4 py-2 text-[11px] text-[var(--ink-3)]">
          <span><Kbd>↑</Kbd> <Kbd>↓</Kbd> navigate</span><span><Kbd>↵</Kbd> open</span><span className="ml-auto"><Kbd>1</Kbd>–<Kbd>5</Kbd> switch sections</span>
        </div>
      </div>
    </div>
  );
}
