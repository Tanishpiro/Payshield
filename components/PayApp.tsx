"use client";

import { useCallback, useEffect, useState } from "react";
import { Logo, LevelPill, Gauge, TrustBar } from "./ui";
import { LEVEL_META, type RiskLevel } from "@/lib/risk";
import QrScanner from "./QrScanner";
import { parsePaymentQr, parseVoicePayment, resolveReceiver, upiPaymentUri } from "@/lib/payment-intent";
import { listenForPayment, openUpi, verifyOwner } from "@/lib/native";
import { App } from "@capacitor/app";

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const STEPS = ["Resolving receiver", "Account age & KYC", "Transaction velocity", "Fraud complaint history", "Device & network links", "Scoring"];

type Step = "scan" | "amount" | "analysing" | "result" | "authenticating" | "paid";

export default function PayApp({ handles, analyse: analyseFn }: {
  handles: { handle: string; name: string }[];
  /** Android build passes an on-device analyser; the web build uses the /api/risk route. */
  analyse?: (handle: string, amount: number, inputMode?: "manual" | "qr" | "voice") => Promise<any>;
}) {
  const [step, setStep] = useState<Step>("scan");
  const [handle, setHandle] = useState("");
  const [amount, setAmount] = useState("");
  const [res, setRes] = useState<any>(null);
  const [scanner, setScanner] = useState(false);
  const [bank, setBank] = useState("");
  const [voicePayment, setVoicePayment] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const [error, setError] = useState("");
  const [inputMode, setInputMode] = useState<"manual" | "qr" | "voice">("manual");

  const acceptVoiceIntent = useCallback((transcript: string) => {
    const intent = parseVoicePayment(transcript);
    if (!intent) throw new Error('Say: “Send 2,000 rupees from HDFC Bank to Suresh.”');
    setHandle(resolveReceiver(intent.receiver, handles));
    setAmount(String(intent.amount));
    setBank(intent.bank);
    setVoiceText(intent.transcript);
    setVoicePayment(true);
    setInputMode("voice");
    setStep("amount");
  }, [handles]);

  useEffect(() => {
    const acceptUrl = (value: string) => {
      const q = new URL(value).searchParams;
      const amountParam = q.get("amount"), receiver = q.get("receiver"), bankParam = q.get("bank");
      if (!amountParam || !receiver || !bankParam) return;
      try { acceptVoiceIntent(`send ${amountParam} rupees from ${bankParam} to ${receiver}`); }
      catch (e) { setError(e instanceof Error ? e.message : "Invalid Assistant payment request."); }
    };
    acceptUrl(window.location.href);
    App.getLaunchUrl().then((launch) => launch?.url && acceptUrl(launch.url)).catch(() => {});
    const listener = App.addListener("appUrlOpen", ({ url }) => acceptUrl(url));
    return () => { listener.then((handle) => handle.remove()); };
  }, [acceptVoiceIntent]);

  async function analyse() {
    const value = Number(amount);
    if (!handle.trim() || !Number.isFinite(value) || value <= 0 || value > 200000) {
      setError("Enter an amount between ₹1 and ₹2,00,000.");
      return;
    }
    setError("");
    setStep("analysing");
    const t0 = Date.now();
    const r = analyseFn
      ? await analyseFn(handle, Number(amount), inputMode).catch(() => null)
      : await fetch("/api/risk", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ handle, amount: Number(amount), sender: "mobile@payshield", inputMode }),
        }).then((x) => x.json()).catch(() => null);
    setTimeout(() => {
      if (!r?.assessment) {
        setError(r?.error || "PayShield could not complete the check. Please try again.");
        setStep("amount");
        return;
      }
      setRes(r); setStep("result");
    }, Math.max(0, 1600 - (Date.now() - t0)));
  }

  function reset() { setStep("scan"); setHandle(""); setAmount(""); setRes(null); setBank(""); setVoicePayment(false); setVoiceText(""); setError(""); setInputMode("manual"); }

  async function captureVoice() {
    setError("");
    try {
      const transcript = await listenForPayment();
      acceptVoiceIntent(transcript);
    } catch (e) { setError(e instanceof Error ? e.message : "Voice recognition failed."); }
  }

  const acceptQr = useCallback((raw: string) => {
    const qr = parsePaymentQr(raw);
    setScanner(false);
    if (!qr) return setError("That is not a supported UPI payment QR code.");
    setHandle(qr.handle);
    if (qr.amount) setAmount(String(qr.amount));
    setVoicePayment(false);
    setInputMode("qr");
    setStep(qr.amount ? "amount" : "amount");
  }, []);

  async function authorizePayment() {
    if (!a || a.action === "block") return;
    setError("");
    const needsOwnerCheck = true;
    if (needsOwnerCheck) {
      setStep("authenticating");
      try {
        const ok = await verifyOwner(`Confirm ${inr(Number(amount))} to ${res.receiver.display_name}`);
        if (!ok) throw new Error("Identity verification was not completed.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Identity verification failed.");
        setStep("result");
        return;
      }
    }
    try {
      if (!a.synthetic) await openUpi(upiPaymentUri(res.receiver.handle, res.receiver.display_name, Number(amount)), a.score);
      setStep("paid");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No compatible UPI app is available.");
      setStep("result");
    }
  }

  const a = res?.assessment;
  const meta = a ? LEVEL_META[a.level as RiskLevel] : null;

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))]">
      {scanner && <QrScanner onScan={acceptQr} onClose={() => setScanner(false)} />}
      <div className="flex items-center gap-2.5">
        <Logo size={26} />
        <div className="text-[15px] font-semibold">PayShield</div>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-500">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> AI police on
        </span>
      </div>

      {step === "scan" && (
        <div className="pop mt-6 flex-1">
          <button onClick={() => setScanner(true)} className="relative mx-auto grid h-56 w-56 place-content-center overflow-hidden rounded-3xl border border-sky-500/25 bg-sky-500/5 transition hover:border-cyan-300/60" aria-label="Open camera to scan QR code">
            <div className="scanline absolute inset-x-6 top-0 h-10 bg-gradient-to-b from-sky-400/35 to-transparent" />
            <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="1.4" aria-hidden>
              <path d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3z" />
              <path d="M15 15h2v2h-2zM19 15h2v2h-2zM15 19h2v2h-2zM19 19h2v2h-2z" />
            </svg>
            <span className="absolute bottom-4 inset-x-0 text-[11px] font-medium text-cyan-300">TAP TO OPEN CAMERA</span>
          </button>
          <p className="mt-4 text-center text-sm text-slate-400">Scan a QR code, or enter the receiver&apos;s UPI ID</p>

          <input value={handle} onChange={(e) => { setHandle(e.target.value); setInputMode("manual"); setVoicePayment(false); }} placeholder="UPI ID or payment number"
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

          <div className="mt-3 grid grid-cols-2 gap-2">
            {[{ name: "Suresh", number: "9876543210" }, { name: "Anita", number: "9812345678" }].map((contact) => (
              <button key={contact.number} onClick={() => { setHandle(contact.number); setInputMode("manual"); setVoicePayment(false); }} className="rounded-xl border border-emerald-500/20 bg-emerald-500/[.04] px-3 py-2 text-left">
                <span className="block text-xs text-slate-200">{contact.name}</span><span className="mono text-[10px] text-emerald-400">10/100 demo number</span>
              </button>
            ))}
          </div>

          <button onClick={captureVoice} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-400/[.06] py-3 text-sm font-medium text-cyan-200">
            <span className="text-lg">◉</span> Speak a payment
          </button>
          <p className="mt-2 text-center text-[10px] leading-relaxed text-slate-600">Voice captures your instruction. Android biometrics verify it is really you before payment.</p>
          {error && <p className="mt-3 rounded-xl border border-rose-500/25 bg-rose-500/[.06] p-3 text-xs text-rose-300">{error}</p>}

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
            {bank && <div className="mt-2 text-xs text-cyan-300">Funding account requested: {bank}</div>}
          </div>
          {voiceText && <div className="mt-3 rounded-xl border border-cyan-500/20 bg-cyan-500/[.04] p-3 text-xs text-slate-400">“{voiceText}”</div>}
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
          {error && <p className="mt-3 rounded-xl border border-rose-500/25 bg-rose-500/[.06] p-3 text-xs text-rose-300">{error}</p>}
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

      {step === "authenticating" && (
        <div className="mt-6 flex flex-1 flex-col items-center justify-center text-center">
          <div className="grid h-24 w-24 place-content-center rounded-[2rem] border border-cyan-400/40 bg-cyan-400/[.08] text-4xl">◎</div>
          <h2 className="mt-5 text-lg font-semibold">Verify it’s you</h2>
          <p className="mt-2 max-w-xs text-sm text-slate-400">Use a strong fingerprint or face check. Your biometric data never leaves Android.</p>
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
            {a.synthetic && <div className="mt-3 rounded-full border border-cyan-400/25 bg-cyan-400/[.06] px-3 py-1 text-[10px] uppercase tracking-wider text-cyan-300">Synthetic prototype score · no real funds</div>}
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
            {voicePayment && <div className="mt-2 text-[11px] text-cyan-300">Voice request · owner verification required</div>}
          </div>
          {error && <p className="mt-3 rounded-xl border border-rose-500/25 bg-rose-500/[.06] p-3 text-xs text-rose-300">{error}</p>}

          {a.action === "block" ? (
            <>
              <button disabled className="mt-4 w-full rounded-2xl bg-slate-800 py-3.5 text-sm font-semibold text-slate-500">Payment blocked</button>
              <button onClick={reset} className="mt-2 w-full rounded-2xl border border-[#1c2740] py-3 text-sm text-slate-300">Cancel payment</button>
            </>
          ) : (
            <>
              <button onClick={authorizePayment}
                className={`mt-4 w-full rounded-2xl py-3.5 text-sm font-semibold text-white ${a.action === "allow" ? "bg-gradient-to-r from-emerald-500 to-teal-500" : "bg-gradient-to-r from-amber-500 to-orange-500"}`}>
                {voicePayment ? "Voice accepted · verify face/fingerprint" : "Verify face/fingerprint and continue"}
              </button>
              <button onClick={reset} className="mt-2 w-full rounded-2xl border border-[#1c2740] py-3 text-sm text-slate-300">Cancel</button>
            </>
          )}
        </div>
      )}

      {step === "paid" && (
        <div className="pop mt-6 flex flex-1 flex-col items-center justify-center text-center">
          <div className="grid h-20 w-20 place-content-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-3xl text-emerald-300">✓</div>
          <h2 className="mt-4 text-lg font-semibold">Payment securely handed off</h2>
          <div className="mono mt-1 text-sm text-slate-400">{inr(Number(amount))} → {handle}</div>
          <p className="mt-2 text-xs text-slate-500">{a?.synthetic ? "Prototype completed. No UPI app was opened and no real funds moved." : "Complete the payment in your UPI app. Your UPI provider—not PayShield—selects and authorizes the linked bank account. The PayShield risk assessment is on record."}</p>
          <button onClick={reset} className="mt-6 w-full rounded-2xl border border-[#1c2740] py-3 text-sm text-slate-300">New payment</button>
        </div>
      )}
    </div>
  );
}
