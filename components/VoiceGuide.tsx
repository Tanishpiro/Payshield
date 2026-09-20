"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CapacitorHttp } from "@capacitor/core";
import { isNativeAndroid } from "@/lib/native";
import type { NarrationRequest } from "@/lib/narration";

type Props = {
  stage: string;
  suspended: boolean;
  amount: number;
  receiver: string;
  score?: number;
  synthetic: boolean;
  reasonCodes: string[];
  requestApproval?: boolean;
  onNarrationEnded?: () => void;
};

const DEPLOYED_BACKEND = "https://payshield-ai-police.netlify.app";

export default function VoiceGuide(props: Props) {
  const [url, setUrl] = useState("");
  const [code, setCode] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const cached = useRef<{ key: string; src: string } | null>(null);
  const autoKey = useRef("");

  useEffect(() => {
    try {
      setUrl(localStorage.getItem("ps-voice-url") || (isNativeAndroid() ? DEPLOYED_BACKEND : ""));
      setCode(sessionStorage.getItem("ps-voice-code") || "");
      setEnabled(localStorage.getItem("ps-voice-enabled") === "true");
    } catch { /* Storage may be unavailable; session input still works. */ }
    setLoaded(true);
  }, []);

  const stop = useCallback(() => {
    generation.current++;
    controller.current?.abort();
    controller.current = null;
    audio.current?.pause();
    setBusy(false);
  }, []);

  const clearAudio = useCallback(() => {
    stop();
    if (cached.current) URL.revokeObjectURL(cached.current.src);
    cached.current = null;
    audio.current?.removeAttribute("src");
  }, [stop]);

  useEffect(() => () => {
    controller.current?.abort();
    audio.current?.pause();
    if (cached.current) URL.revokeObjectURL(cached.current.src);
  }, []);

  function endpoint() {
    if (!url.trim()) {
      if (isNativeAndroid()) throw new Error("Add your PayShield backend URL in Voice settings.");
      return "/api/voice";
    }
    const parsed = new URL(url.trim());
    const localBrowser = ["localhost", "127.0.0.1"].includes(parsed.hostname);
    if (parsed.protocol !== "https:" && !(localBrowser && parsed.protocol === "http:"))
      throw new Error("Use an HTTPS backend URL.");
    if (parsed.username || parsed.password || parsed.search || parsed.hash || !["", "/"].includes(parsed.pathname))
      throw new Error("Enter only the backend address, for example https://your-app.example.");
    return parsed.origin + "/api/voice";
  }

  const event = props.stage === "result" ? "result" : props.stage === "paid" ? "complete" : null;
  const request: NarrationRequest | null = event && props.score !== undefined ? {
    event, amount: props.amount, receiver: props.receiver.slice(0, 80), score: props.score,
    synthetic: props.synthetic, reasonCodes: props.reasonCodes.slice(0, 8),
    requestApproval: Boolean(props.requestApproval),
  } : null;
  const requestKey = request ? JSON.stringify(request) : "";

  async function play(body: NarrationRequest) {
    stop();
    let current = generation.current;
    const cacheKey = JSON.stringify(body) + url + code;
    setStatus("");
    try {
      if (code.trim().length < 24) throw new Error("Enter your private voice access code in Voice settings. This is not your ElevenLabs API key.");
      if (!cached.current || cached.current.key !== cacheKey) {
        clearAudio();
        const id = generation.current;
        current = id;
        const abort = new AbortController();
        controller.current = abort;
        setBusy(true);
        setStatus("Preparing ElevenLabs audio…");
        const timeout = window.setTimeout(() => abort.abort(), 25_000);
        try {
          let blob: Blob;
          if (isNativeAndroid()) {
            const response = await CapacitorHttp.request({
              method: "POST", url: endpoint(),
              headers: { "Content-Type": "application/json", Authorization: "Bearer " + code.trim() },
              data: body, responseType: "arraybuffer", connectTimeout: 10000, readTimeout: 25000,
            });
            if (response.status < 200 || response.status >= 300) throw new Error(response.data?.error || "Voice service unavailable. Check the backend and access code.");
            const bytes = Uint8Array.from(atob(response.data), c => c.charCodeAt(0));
            blob = new Blob([bytes], { type: "audio/mpeg" });
          } else {
          const response = await fetch(endpoint(), {
            method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + code.trim() },
            body: JSON.stringify(body), signal: abort.signal,
          });
          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || "Voice service is unavailable.");
          }
          blob = await response.blob();
          }
          if (id !== generation.current) return;
          cached.current = { key: cacheKey, src: URL.createObjectURL(blob) };
          audio.current!.src = cached.current.src;
        } finally { window.clearTimeout(timeout); }
        if (id !== generation.current) return;
      } else if (current !== generation.current) return;
      setBusy(false);
      if (!audio.current) return;
      audio.current.currentTime = 0;
      try {
        await audio.current.play();
        setStatus("Speaking with ElevenLabs");
      } catch {
        setStatus("Audio is ready. Tap the player’s play button to listen.");
      }
    } catch (error) {
      if (current !== generation.current) return;
      if (error instanceof DOMException && error.name === "AbortError") {
        // Navigation cancellation must not replace the status of a new request.
        if (controller.current?.signal.aborted) setStatus("Audio request stopped. Tap Listen to retry.");
      } else setStatus(error instanceof Error ? error.message : "Could not connect to the voice service.");
      setBusy(false);
    }
  }

  // Only new payment-result/completion events auto-play. Re-renders and edits don't spend credits.
  useEffect(() => {
    clearAudio();
    setStatus("");
    if (props.suspended || !loaded || !enabled || !requestKey || !code || (isNativeAndroid() && !url)) return;
    const key = requestKey + url + code;
    if (autoKey.current === key) return;
    autoKey.current = key;
    void play(JSON.parse(requestKey));
    // The serialized snapshot is the trigger; play reads that render's settings.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, props.stage, props.suspended, enabled, loaded, url, code, clearAudio]);

  const settingsVisible = props.stage === "scan";
  if (!settingsVisible && !event) return <audio ref={audio} hidden />;
  return <section className="ps-card ps-voice-guide">
    <div className="ps-title"><h2>Voice guide</h2><span>ElevenLabs</span></div>
    <label className="ps-voice-toggle"><span><strong>Read payment guidance aloud</strong><small>Risk explanations and confirmations</small></span><input type="checkbox" checked={enabled} onChange={e => {
      setEnabled(e.target.checked); autoKey.current = "";
      try { localStorage.setItem("ps-voice-enabled", String(e.target.checked)); } catch {}
    }} /></label>
    {settingsVisible && <details className="ps-voice-settings"><summary>Voice settings</summary>
      <label className="ps-label" htmlFor="ps-voice-url">PayShield backend URL</label>
      <input id="ps-voice-url" placeholder="http://localhost:3010 for USB testing" type="url" value={url} onChange={e => {
        clearAudio(); setUrl(e.target.value);
        try { localStorage.setItem("ps-voice-url", e.target.value); } catch {}
      }}/>
      <label className="ps-label" htmlFor="ps-voice-code">Private voice access code</label>
      <input id="ps-voice-code" type="password" autoComplete="off" placeholder="Backend access code, not the ElevenLabs key" value={code} onChange={e => {
        clearAudio(); setCode(e.target.value);
        try { sessionStorage.setItem("ps-voice-code", e.target.value); } catch {}
      }}/>
      <p className="ps-muted">On the web, leave the URL empty. For Android USB testing use http://localhost:3010 with port forwarding; otherwise use HTTPS. The access code is kept for this session.</p>
      <button className="ps-secondary" disabled={busy} onClick={() => void play({ event: "preview" })}>Test voice</button>
    </details>}
    {!settingsVisible && <div className="ps-voice-controls">
      <button className="ps-secondary" disabled={busy || props.suspended} onClick={() => request && void play(request)}>{busy ? "Preparing audio…" : "Listen / replay"}</button>
      <button className="ps-secondary" onClick={() => { stop(); setStatus("Playback stopped."); }}>Stop</button>
    </div>}
    <audio ref={audio} controls preload="none" aria-label="PayShield spoken guidance" onEnded={() => {
      setStatus(props.requestApproval ? "Listening for approve or cancel…" : "Finished speaking.");
      if (event === "result" && props.requestApproval) props.onNarrationEnded?.();
    }} onError={() => setStatus("Audio could not play. Try again.")}/>
    <p className="ps-muted" aria-live="polite">{status}</p>
    {settingsVisible && <p className="ps-muted">When used, the payment amount, display name and risk summary are sent to ElevenLabs for speech. Voice playback never approves a payment.</p>}
  </section>;
}
