"use client";

import { useState } from "react";
import { Logo, LevelPill, Gauge, TrustBar } from "./ui";
import { LEVEL_META, type RiskLevel } from "@/lib/risk";

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const STEPS = ["Resolving receiver", "Account age & KYC", "Transaction velocity", "Fraud complaint history", "Device & network links", "Scoring"];

type Step = "scan" | "amount" | "analysing" | "result" | "paid";

export default function PayApp({ handles, analyse: analyseFn }: {
  handles: { handle: string; name: string }[];
  /** Android build passes an on-device analyser; the web build uses the /api/risk route. */
  analyse?: (handle: string, amount: number) => Promise<any>;
}) {
  const [step, setStep] = useState<Step>("scan");
  const [handle, setHandle] = useState("");
  const [amount, setAmount] = useState("");
  const [res, setRes] = useState<any>(null);

  async function analyse() {
    setStep("analysing");
    const t0 = Date.now();
    const r = analyseFn
      ? await analyseFn(handle, Number(amount)).catch(() => null)
      : await fetch("/api/risk", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ handle, amount: Number(amount), sender: "mobile@payshield" }),
        }).then((x) => x.json()).catch(() => null);
    setTimeout(() => { setRes(r); setStep("result"); }, Math.max(0, 1600 - (Date.now() - t0)));
  }

  function reset() { setStep("scan"); setHandle(""); setAmount(""); setRes(null); }

  const a = res?.assessment;
  const meta = a ? LEVEL_META[a.level as RiskLevel] : null;

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <div className="flex items-center gap-2.5">
        <Logo size={26} />
        <div className="text-[15px] font-semibold">PayShield</div>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-500">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> AI police on
        </span>
      </div>

      {step === "scan" && (
        <div className="pop mt-6 flex-1">
          <div className="relative mx-auto grid h-56 w-56 place-content-center overflow-hidden rounded-3xl border border-sky-500/25 bg-sky-500/5">
            <div className="scanline absolute inset-x-6 top-0 h-10 bg-gradient-to-b from-sky-400/35 to-transparent" />
            <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="1.4" aria-hidden>
              <path d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3z" />
              <path d="M15 15h2v2h-2zM19 15h2v2h-2zM15 19h2v2h-2zM19 19h2v2h-2z" />
            </svg>
          </div>
          <p className="mt-4 text-center text-sm text-slate-400">Scan a QR code, or enter the receiver&apos;s UPI ID</p>

          <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="name@bank"
            className="mono mt-5 w-full rounded-2xl border border-[#1c2740] bg-[#0b1220] px-4 py-3.5 text-sm outline-none focus:border-sky-500/50" />

          <div className="mt-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-500">Demo QR codes</div>
            <div className="mt-2 grid gap-1.5">
              {handles.map((h) => (
                <button key={h.handle} onClick={() => setHandle(h.handle)}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left ${handle === h.handle ? "border-sky-500/50 bg-sky-500/10" : "border-[#1c2740]"}`}>
                  <span className="grid h-8 w-8 shrink-0 place-content-center rounded-lg bg-slate-800 text-[10px] text-slate-400">QR</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-slate-200">{h.name}</span>
                    <span className="mono block truncate text-[11px] text-slate-500">{h.handle}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <button disabled={!handle.trim()} onClick={() => setStep("amount")}
            className="mt-5 w-full rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-500 py-3.5 text-sm font-semibold text-white disabled:opacity-40">
            Continue
          </button>
        </div>
      )}

      {step === "amount" && (
        <div className="pop mt-6 flex-1">
          <button onClick={() => setStep("scan")} className="text-xs text-slate-500">← Change receiver</button>
          <div className="mt-4 rounded-2xl border border-[#1c2740] bg-[#0b1220]/60 p-4">
            <div className="text-[11px] uppercase tracking-wider text-slate-500">Paying</div>
            <div className="mono mt-1 text-sm text-slate-200">{handle}</div>
          </div>
          <label className="mt-6 block text-[11px] uppercase tracking-wider text-slate-500">Amount</label>
          <div className="mt-2 flex items-baseline gap-2 border-b border-[#1c2740] pb-3">
            <span className="text-3xl text-slate-500">₹</span>
            <input autoFocus inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} placeholder="0"
              className="mono w-full bg-transparent text-4xl font-semibold outline-none placeholder:text-slate-700" />
          </div>
          <div className="mt-3 flex gap-2">
            {[500, 2500, 10000, 45000].map((v) => (
              <button key={v} onClick={() => setAmount(String(v))} className="mono flex-1 rounded-lg border border-[#1c2740] py-1.5 text-[11px] text-slate-400">{inr(v)}</button>
            ))}
          </div>
          <button disabled={!Number(amount)} onClick={analyse}
            className="mt-8 w-full rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-500 py-3.5 text-sm font-semibold text-white disabled:opacity-40">
            Check with PayShield
          </button>
          <p className="mt-3 text-center text-[11px] text-slate-600">PayShield checks the receiver before the money moves.</p>
        </div>
      )}

      {step === "analysing" && (
        <div className="mt-6 flex flex-1 flex-col items-center justify-center">
          <div className="relative h-28 w-28 overflow-hidden rounded-3xl border border-sky-500/30 bg-sky-500/5">
            <div className="scanline absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-sky-400/40 to-transparent" />
          </div>
          <p className="mono mt-5 text-sm text-sky-300">AI police analysing…</p>
          <ul className="mt-4 space-y-1.5">
            {STEPS.map((s, i) => (
              <li key={s} className="pop text-xs text-slate-400" style={{ animationDelay: `${i * 200}ms` }}>✓ {s}</li>
            ))}
          </ul>
        </div>
      )}

      {step === "result" && a && (
        <div className="pop mt-5 flex-1">
          <div className="flex flex-col items-center">
            <Gauge score={a.score} level={a.level} size={188} />
            <div className="mt-3"><LevelPill level={a.level} /></div>
            <h2 className="mt-3 text-center text-lg font-semibold">{res.receiver.display_name}</h2>
            <div className="mono text-xs text-slate-500">{res.receiver.handle}</div>
            <p className="mt-3 text-center text-sm text-slate-300">{a.headline}</p>
          </div>

          <div className="mt-4"><TrustBar value={a.trustScore} /></div>

          <div className="mt-4 space-y-2">
            {a.reasons.slice(0, 5).map((r: any) => (
              <div key={r.code} className="rounded-xl border border-rose-500/20 bg-rose-500/[.05] p-3">
                <div className="text-sm text-slate-100">{r.label}</div>
                <div className="mt-0.5 text-xs text-slate-400">{r.detail}</div>
              </div>
            ))}
            {a.positives.slice(0, 3).map((r: any) => (
              <div key={r.code} className="rounded-xl border border-emerald-500/20 bg-emerald-500/[.05] p-3">
                <div className="text-sm text-slate-100">{r.label}</div>
                <div className="mt-0.5 text-xs text-slate-400">{r.detail}</div>
              </div>
            ))}
          </div>

          <div className={`mt-5 rounded-2xl border p-4 ${meta!.border} ${meta!.bg}`}>
            <div className="text-[11px] uppercase tracking-wider text-slate-400">PayShield decision</div>
            <div className={`mt-0.5 text-base font-semibold ${meta!.text}`}>{meta!.action}</div>
            <div className="mono mt-1 text-sm text-slate-300">{inr(a.amount)} → {res.receiver.handle}</div>
          </div>

          {a.action === "block" ? (
            <>
              <button disabled className="mt-4 w-full rounded-2xl bg-slate-800 py-3.5 text-sm font-semibold text-slate-500">Payment blocked</button>
              <button onClick={reset} className="mt-2 w-full rounded-2xl border border-[#1c2740] py-3 text-sm text-slate-300">Cancel payment</button>
            </>
          ) : (
            <>
              <button onClick={() => setStep("paid")}
                className={`mt-4 w-full rounded-2xl py-3.5 text-sm font-semibold text-white ${a.action === "allow" ? "bg-gradient-to-r from-emerald-500 to-teal-500" : "bg-gradient-to-r from-amber-500 to-orange-500"}`}>
                {a.action === "allow" ? "Pay now" : a.action === "warn" ? "I understand the risk — pay anyway" : "Verify and pay anyway"}
              </button>
              <button onClick={reset} className="mt-2 w-full rounded-2xl border border-[#1c2740] py-3 text-sm text-slate-300">Cancel</button>
            </>
          )}
        </div>
      )}

      {step === "paid" && (
        <div className="pop mt-6 flex flex-1 flex-col items-center justify-center text-center">
          <div className="grid h-20 w-20 place-content-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-3xl text-emerald-300">✓</div>
          <h2 className="mt-4 text-lg font-semibold">Payment sent</h2>
          <div className="mono mt-1 text-sm text-slate-400">{inr(Number(amount))} → {handle}</div>
          <p className="mt-2 text-xs text-slate-500">This payment and its risk assessment are on record. If it turns out to be fraud, the receiver&apos;s trust score drops for everyone.</p>
          <button onClick={reset} className="mt-6 w-full rounded-2xl border border-[#1c2740] py-3 text-sm text-slate-300">New payment</button>
        </div>
      )}
    </div>
  );
}
