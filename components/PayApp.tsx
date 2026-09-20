"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Logo } from "./ui";
import "./payment.css";
import "./payment-actions.css";
import { LEVEL_META, type RiskLevel } from "@/lib/risk";
import QrScanner from "./QrScanner";
import { parsePaymentQr, parseVoicePayment, resolveReceiver, upiPaymentUri } from "@/lib/payment-intent";
import { listenForPayment, verifyOwner, cancelListening, stopNativeAudio, isNativeAndroid } from "@/lib/native";
import { App } from "@capacitor/app";
import VoiceGuide from "./VoiceGuide";
import ScamReport from "./ScamReport";

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
  const [listening, setListening] = useState(false);
  const [inputMode, setInputMode] = useState<"manual" | "qr" | "voice">("manual");
  const session = useRef(0);
  const authorizing = useRef(false);
  const [sessionId,setSessionId] = useState(0);
  const [android,setAndroid] = useState(false);
  useEffect(() => { setAndroid(isNativeAndroid()); }, []);
  useEffect(() => { if (voicePayment) window.scrollTo({ top: 0, behavior: 'instant' }); }, [voicePayment]);

  const acceptVoiceIntent = useCallback((transcript: string) => {
    const intent = parseVoicePayment(transcript);
    if (!intent) throw new Error('Say: “Send 2,000 rupees from HDFC Bank to Suresh.”');
    const resolvedHandle = resolveReceiver(intent.receiver, handles);
    session.current++; setSessionId(session.current);
    setHandle(resolvedHandle);
    setAmount(String(intent.amount));
    setBank(intent.bank);
    setVoiceText(intent.transcript);
    setVoicePayment(true);
    setInputMode("voice");
    void analyseValues(resolvedHandle, intent.amount, "voice");
  }, [handles, analyseFn]);

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

  async function analyseValues(nextHandle: string, value: number, mode: "manual" | "qr" | "voice") {
    const id = session.current;
    if (!nextHandle.trim() || !Number.isFinite(value) || value <= 0 || value > 200000) {
      setError("Enter an amount between ₹1 and ₹2,00,000.");
      return;
    }
    setError("");
    setStep("analysing");
    const t0 = Date.now();
    const r = analyseFn
      ? await analyseFn(nextHandle, value, mode).catch(() => null)
      : await fetch("/api/risk", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ handle: nextHandle, amount: value, sender: "mobile@payshield", inputMode: mode }),
        }).then((x) => x.json()).catch(() => null);
    setTimeout(() => {
      if (id !== session.current) return;
      if (!r?.assessment) {
        setError(r?.error || "PayShield could not complete the check. Please try again.");
        setStep("amount");
        return;
      }
      setRes({...r, assessment: {...r.assessment, synthetic: true}}); setStep("result");
    }, mode === "voice" ? 0 : Math.max(0, 1600 - (Date.now() - t0)));
  }

  async function analyse() { await analyseValues(handle, Number(amount), inputMode); }

  function reset() { session.current++; void cancelListening(); void stopNativeAudio(); setListening(false); setStep("scan"); setHandle(""); setAmount(""); setRes(null); setBank(""); setVoicePayment(false); setVoiceText(""); setError(""); setInputMode("manual"); }

  async function captureVoice() {
    if (listening) return;
    if (!sessionStorage.getItem('ps-voice-code')) { setError('Open Voice settings and enter your access code to enable spoken payment approval.'); return; }
    const id = ++session.current;
    setVoicePayment(true);setRes(null);setStep('scan');
    setListening(true);
    setError("");
    try {
      const transcript = await listenForPayment();
      if (id !== session.current) return;
      acceptVoiceIntent(transcript);
    } catch (e) { if(id===session.current)setError(e instanceof Error ? e.message : "Voice recognition failed."); }
    finally { setListening(false); }
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
    if (!a || a.action === "block" || a.score > 90 || authorizing.current) return;
    authorizing.current = true;
    const id = session.current;
    setError("");
    const needsOwnerCheck = true;
    if (needsOwnerCheck) {
      setStep("authenticating");
      try {
        const ok = await verifyOwner(`Confirm ${inr(Number(amount))} to ${res.receiver.display_name}`);
        if (!ok) throw new Error("Identity verification was not completed.");
        if (id !== session.current) { authorizing.current = false; return; }
      } catch (e) {
        if (id !== session.current) { authorizing.current = false; return; }
        setError(e instanceof Error ? e.message : "Identity verification failed.");
        setStep("result");
        authorizing.current = false;
        return;
      }
    }
    try {
      // This build is a payment simulator. No UPI handoff or real transfer is attempted.
      setStep("paid");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No compatible UPI app is available.");
      setStep("result");
    }
    authorizing.current = false;
  }

  async function captureVoiceApproval() {
    if (listening || step !== "result" || !voicePayment || !a) return;
    setListening(true);
    setError("");
    const id = session.current;
    try {
      const answer = (await listenForPayment()).trim().toLowerCase();
      if (id !== session.current) return;
      if (/\b(cancel|stop|no|not|don't|reject)\b/.test(answer)) reset();
      else if (/^(approve|approved|yes|confirm|continue|proceed|yes approve|i approve)[.!?]*$/.test(answer)) await authorizePayment();
      else setError('Please say “approve” to open fingerprint verification, or “cancel”.');
    } catch (e) { if(id===session.current)setError(e instanceof Error ? e.message : "Voice approval was not recognised."); }
    finally { setListening(false); }
  }

  const a = res?.assessment;
  const meta = a ? LEVEL_META[a.level as RiskLevel] : null;

  const pick = (value: string) => { setHandle(value); setInputMode("manual"); setVoicePayment(false); setBank(""); setVoiceText(""); setError(""); setStep("amount"); };
  const name = handles.find(h => h.handle === handle)?.name ?? (handle === "9876543210" ? "Suresh" : handle === "9812345678" ? "Anita" : handle);
  return <div className="ps-pay">
    {scanner && <QrScanner onScan={acceptQr} onClose={() => setScanner(false)} />}
    <header className="ps-header"><div className="ps-brand"><Logo size={32}/><div><strong>PayShield</strong><small>Every payment. Protected.</small></div></div><span className="ps-tag">PROTOTYPE</span></header>
    <main className="ps-content">
    {voicePayment && <section className="ps-card ps-conversation" aria-live="polite"><Icon kind="mic"/><h1>{listening?'Listening…':step==='analysing'?'Checking your payment…':step==='paid'?'Demo successful':step==='authenticating'?'Confirm your fingerprint':'Voice payment'}</h1><p>{voiceText || 'Say: Send 2000 rupees from HDFC to Suresh.'}</p>{a&&<p>{inr(a.amount)} · Risk {a.score}/100 · {a.score>90?'Payment blocked':'No real funds move'}</p>}{step==='result'&&a?.score<=90&&<button className="ps-secondary" disabled={listening} onClick={captureVoiceApproval}>Say approve or cancel</button>}<button className="ps-secondary" onClick={reset}>{step==='paid'?'Back to payments':'Cancel voice payment'}</button></section>}
    <div className="ps-payment-panels" hidden={voicePayment}>
    {step === "scan" && <>
      <section className="ps-hero"><span className="ps-eyebrow">PAY WITH PEACE OF MIND</span><h1>Your money.<br/>An extra layer of care.</h1><p>AI Police checks the receiver before you pay.</p><span className="ps-protection">● Protection is on</span><div className="ps-hero-symbol"><Icon kind="shield"/></div></section>
      <section className="ps-card"><div className="ps-title"><h2>Transfer money</h2><span>Simple & secure</span></div>
        <div className="ps-actions">
          {[["qr","Scan & pay"],["phone","To a number"],["bank","To a UPI ID"],["mic","Voice pay"]].map(([kind,label]) => <button key={kind} onClick={() => kind === "qr" ? setScanner(true) : kind === "mic" ? captureVoice() : document.getElementById("ps-receiver")?.focus()}><span><Icon kind={kind}/></span><strong>{label}</strong></button>)}
        </div>
        <label className="ps-label" htmlFor="ps-receiver">Mobile number or UPI ID</label>
        <div className="ps-search"><Icon kind="search"/><input id="ps-receiver" value={handle} onChange={e => {setHandle(e.target.value);setInputMode("manual");setVoicePayment(false);}} placeholder="Enter number or name@bank"/><button aria-label="Continue" disabled={!handle.trim()} onClick={() => setStep("amount")}><Icon kind="arrow"/></button></div>
      </section>
      <section className="ps-card"><div className="ps-title"><h2>Pay people</h2><span>Demo contacts</span></div><div className="ps-contacts">
        {[["Suresh","9876543210"],["Anita","9812345678"]].map(([n,num],i) => <button key={num} onClick={() => pick(num)}><span className={"ps-avatar tone-"+i}>{n[0]}</span><strong>{n}</strong><small>10/100 risk</small></button>)}
        <button onClick={() => document.getElementById("ps-receiver")?.focus()}><span className="ps-avatar tone-2"><Icon kind="plus"/></span><strong>New payment</strong><small>Number / UPI</small></button>
      </div></section>
      <button className="ps-voice" onClick={captureVoice}><span className="ps-voice-icon"><Icon kind="mic"/></span><span><strong>Just say it. We’ll check it.</strong><small>Voice + face or fingerprint</small></span><Icon kind="arrow"/></button>
      <section className="ps-card"><div className="ps-title"><h2>Try a receiver</h2><span>AI Police demo</span></div><div className="ps-receivers">{handles.map((h,i) => <button key={h.handle} onClick={() => pick(h.handle)}><span className={"ps-avatar tone-"+i%3}>{h.name[0]}</span><span><strong>{h.name}</strong><small>{h.handle}</small></span><Icon kind="arrow"/></button>)}</div>{!handles.length && <p className="ps-muted">Enter a number above to try a payment.</p>}</section>
      <p className="ps-note">Number demos: 10/100 · QR demos: 80/100<br/>Synthetic payments don’t move real money.</p>
    </>}
    {step === "amount" && <>
      <button className="ps-back" onClick={() => setStep("scan")}>← Back to payments</button>
      <section className="ps-card ps-amount"><span className="ps-avatar tone-0">{name?.[0]?.toUpperCase() || "P"}</span><h1>Paying {name}</h1><p className="ps-handle">{handle}</p>{bank && <span className="ps-tag">Requested bank: {bank}</span>}
      <label htmlFor="ps-amount" className="ps-label">Enter amount</label><div className="ps-amount-input"><span>₹</span><input id="ps-amount" autoFocus inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g,""))} placeholder="0"/></div>
      <div className="ps-chips">{[500,2000,5000,10000].map(v => <button key={v} onClick={() => setAmount(String(v))}>{inr(v)}</button>)}</div>{voiceText && <p className="ps-note">“{voiceText}”</p>}</section>
      <div className="ps-assurance"><Icon kind="shield"/><span><strong>Checked before you pay</strong><small>Receiver risk, identity and fraud signals</small></span></div>
      <button className="ps-primary" disabled={!Number(amount)} onClick={analyse}>Check payment <Icon kind="arrow"/></button>
    </>}
    {step === "analysing" && <section className="ps-card ps-status" aria-live="polite"><div className="ps-checking"><Icon kind="shield"/></div><span className="ps-eyebrow">AI POLICE</span><h1>Checking your payment</h1><p>Taking a closer look at the receiver.</p><ul className="ps-check-list">{STEPS.map(s => <li key={s}><span/>{s}</li>)}</ul></section>}
    {step === "authenticating" && <section className="ps-card ps-status"><div className="ps-checking"><Icon kind="shield"/></div><h1>One last check.<br/>Is it you?</h1><p>Confirm with your strong face or fingerprint authentication to continue.</p><span className="ps-tag">Biometrics stay on your device</span></section>}
    {step === "result" && a && <>
      <button className="ps-back" onClick={() => setStep("amount")}>← Payment details</button>
      <section className={"ps-card ps-result risk-"+a.level}><span className="ps-eyebrow">YOUR PAYMENT CHECK</span><div className="ps-score" style={{"--score":a.score+"%"} as React.CSSProperties}><div><strong>{a.score}<small>/100</small></strong><span>Risk score</span></div></div><span className="ps-risk-label">{meta!.label}</span><h1>{res.receiver.display_name}</h1><p className="ps-handle">{res.receiver.handle}</p><p>{a.headline}</p>{a.synthetic && <span className="ps-tag">Demo score · No real funds</span>}</section>
      <section className="ps-card"><div className="ps-title"><h2>Payment summary</h2><strong>{inr(a.amount)}</strong></div><div className="ps-assurance"><Icon kind="shield"/><strong>{meta!.action}</strong></div>{voicePayment && <p className="ps-muted">Voice request · face or fingerprint required</p>}</section>
      <section className="ps-card"><div className="ps-title"><h2>Behind the score</h2><span>AI Police</span></div>{[...a.reasons.slice(0,5),...a.positives.slice(0,3)].map((r:any) => <div className="ps-reason" key={r.code}><Icon kind="shield"/><div><strong>{r.label}</strong><p>{r.detail}</p></div></div>)}</section>
      <section className="ps-payment-actions" aria-label="Payment actions">
        {a.action === 'block' || a.score > 90 ? <button className="ps-primary" disabled>Payment blocked <Icon kind="shield"/></button>
          : android ? <button className="ps-primary" onClick={authorizePayment}>Verify face / fingerprint <Icon kind="shield"/></button>
          : <><div className="ps-browser-verification"><Icon kind="shield"/><div><strong>Continue securely on Android</strong><p>You can check risk and create reports here. Face or fingerprint verification is available in the PayShield Android app.</p></div></div><a className="ps-primary" href="https://payshield-ai-police.netlify.app/PayShield-latest.apk">Download Android app <Icon kind="arrow"/></a></>}
        <button className="ps-secondary" onClick={reset}>Cancel payment</button>
      </section>
    </>}
    {step === "paid" && <section className="ps-card ps-status"><div className="ps-success">✓</div><h1>{a?.synthetic ? "Demo complete" : "Ready in your UPI app"}</h1><strong className="ps-paid-amount">{inr(Number(amount))}</strong><p className="ps-handle">{handle}</p><p>{a?.synthetic ? "Your prototype payment is complete. No real money was transferred." : "Finish authorizing the payment in your UPI app. Your bank will confirm its status."}</p><button className="ps-primary" onClick={reset}>Back to payments</button></section>}
    </div>
    {error && <p className="ps-error" role="alert">{error}</p>}
    <VoiceGuide stage={step} conversation={voicePayment} sessionId={sessionId} suspended={scanner || listening} amount={a?.amount ?? Number(amount)}
      receiver={res?.receiver?.display_name ?? name} score={a?.score}
      synthetic={Boolean(a?.synthetic)} reasonCodes={(a?.reasons ?? []).map((r: { code: string }) => r.code)}
      requestApproval={voicePayment && step === "result" && a?.action !== "block" && a?.score <= 90}
      onNarrationEnded={captureVoiceApproval} />
    {a && (step === 'result' || step === 'paid') && <ScamReport key={sessionId+'-'+handle+'-'+amount} assessment={a} mode={inputMode} />}
    <footer className="ps-footer"><Logo size={18}/> Protected by PayShield</footer>
    </main>
    {step === "scan" && !voicePayment && <div className="ps-dock"><button onClick={() => setScanner(true)}><Icon kind="qr"/> Scan any UPI QR</button></div>}
  </div>;
}

function Icon({kind}:{kind:string}) {
  const paths:Record<string,React.ReactNode> = {
    shield:<><path d="m12 3 8 3v6c0 5-5 8-8 9-3-1-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/></>,
    qr:<><path d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h2v2h-2zM20 15v6h-5v-2"/></>,
    phone:<><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 5h4M11 19h2"/></>,
    bank:<><path d="m3 8 9-5 9 5M3 9h18M5 10v8M10 10v8M14 10v8M19 10v8M3 21h18"/></>,
    mic:<><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></>,
    search:<><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></>,
    arrow:<path d="M5 12h14m-5-5 5 5-5 5"/>,plus:<path d="M12 5v14M5 12h14"/>
  };
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>;
}
