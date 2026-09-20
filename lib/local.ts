// Standalone risk analysis used by the Android build: talks to Supabase directly
// and runs the same risk engine on-device, so the app works without the web server.

import { createClient } from "@supabase/supabase-js";
import { applyPrototypeProfile, assess, type ReceiverFacts } from "./risk";

const SUPABASE_URL = "https://mrkehxmoqpxaycrtcxwq.supabase.co";
const SUPABASE_KEY = "sb_publishable_-nCTKkr92fhk2tSg7YhDGw_OZpQ28hM";

const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
const DAY = 86400000;

export async function listReceivers() {
  const { data } = await db.from("ps_receivers").select("handle,display_name").order("display_name");
  return (data ?? []).map((r: any) => ({ handle: r.handle, name: r.display_name }));
}

export async function analyseLocal(handle: string, amount: number, inputMode?: "manual" | "qr" | "voice") {
  const h = handle.trim().toLowerCase();
  const isNumber = /^\+?\d{10,15}$/.test(h);
  const { data: rs } = await db.from("ps_receivers").select("*").ilike("handle", h).limit(1);
  const r = rs?.[0];

  if (!r) {
    if (inputMode === "qr") {
      const assessment = applyPrototypeProfile({
        score: 78, level: "high", action: "verify", trustScore: 10, amount,
        headline: "Unknown receiver", reasons: [], positives: [], confidence: 100,
        policyVersion: "AI-POLICE-2.0", scoreBasis: "risk-engine",
      }, "qr");
      return { found: true, receiver: { handle: h, display_name: "Scanned demo receiver", kyc_status: "unverified", links: [] }, assessment };
    }
    if (isNumber) {
      const assessment = applyPrototypeProfile({
        score: 78, level: "high", action: "verify", trustScore: 10, amount,
        headline: "Unknown receiver", reasons: [], positives: [], confidence: 100,
        policyVersion: "AI-POLICE-2.0", scoreBasis: "risk-engine",
      }, "number");
      return { found: true, receiver: { handle: h, display_name: `Demo receiver ${h.slice(-4)}`, kyc_status: "verified", links: [] }, assessment };
    }
    return {
      found: false,
      receiver: { handle, display_name: "Unknown receiver", kyc_status: "unverified", links: [] },
      assessment: {
        score: 78, level: "high", action: "verify", trustScore: 10, amount,
        headline: "Verify before paying — receiver is not recognised by any PayShield partner.",
        reasons: [
          { code: "UNKNOWN", label: "Receiver not found in PayShield intelligence", detail: "No identity, history or reputation available for this payment identifier", weight: 40, category: "identity", direction: "risk" },
          { code: "NO_HISTORY", label: "No transaction history available", detail: "Nothing to establish legitimate behaviour", weight: 20, category: "behaviour", direction: "risk" },
        ],
        positives: [],
      },
    };
  }

  const [tx, sig, rdev, links, allSig, allRdev, allRec, devices] = await Promise.all([
    db.from("ps_transactions").select("sender_handle,created_at").eq("receiver_id", r.id).limit(2000),
    db.from("ps_fraud_signals").select("*").eq("receiver_id", r.id),
    db.from("ps_receiver_devices").select("device_id").eq("receiver_id", r.id),
    db.from("ps_receiver_links").select("*").or(`from_receiver.eq.${r.id},to_receiver.eq.${r.id}`),
    db.from("ps_fraud_signals").select("receiver_id"),
    db.from("ps_receiver_devices").select("receiver_id,device_id"),
    db.from("ps_receivers").select("id,handle"),
    db.from("ps_devices").select("*"),
  ]);

  const now = Date.now();
  const txs = tx.data ?? [];
  const in24 = txs.filter((t: any) => now - new Date(t.created_at).getTime() < DAY);
  const flagged = new Set((allSig.data ?? []).map((s: any) => s.receiver_id));
  const handleById = new Map((allRec.data ?? []).map((x: any) => [x.id, x.handle]));
  const share = new Map<string, number>();
  for (const d of allRdev.data ?? []) share.set(d.device_id, (share.get(d.device_id) ?? 0) + 1);
  const devById = new Map((devices.data ?? []).map((d: any) => [d.id, d]));

  const facts: ReceiverFacts = {
    handle: r.handle, display_name: r.display_name, category: r.category, city: r.city,
    bank_name: r.bank_name, account_created_at: r.account_created_at, kyc_status: r.kyc_status,
    avg_ticket: Number(r.avg_ticket ?? 0),
    totalTx: txs.length,
    tx24h: in24.length,
    tx7d: txs.filter((t: any) => now - new Date(t.created_at).getTime() < 7 * DAY).length,
    uniqueSenders24h: new Set(in24.map((t: any) => t.sender_handle)).size,
    distinctDays: new Set(txs.map((t: any) => String(t.created_at).slice(0, 10))).size,
    signals: (sig.data ?? []) as any,
    devices: (rdev.data ?? []).map((x: any) => {
      const d: any = devById.get(x.device_id) ?? {};
      return { fingerprint: d.fingerprint ?? "unknown", is_emulator: !!d.is_emulator, is_vpn: !!d.is_vpn, ip_country: d.ip_country ?? "IN", sharedWith: share.get(x.device_id) ?? 1 };
    }),
    links: (links.data ?? []).map((l: any) => {
      const other = l.from_receiver === r.id ? l.to_receiver : l.from_receiver;
      return { handle: handleById.get(other) ?? "unknown", link_type: l.link_type, strength: Number(l.strength), flagged: flagged.has(other) };
    }),
  };

  const a = applyPrototypeProfile(assess(facts, amount), inputMode === "qr" ? "qr" : undefined);
  db.from("ps_assessments").insert({
    receiver_id: r.id, receiver_handle: r.handle, sender_handle: "android@payshield", amount,
    score: a.score, level: a.level, action: a.action, trust_score: a.trustScore,
    reasons: a.reasons.map((x) => ({ code: x.code, label: x.label, detail: x.detail, weight: x.weight })),
  }).then(() => {}, () => {});

  return {
    found: true,
    receiver: {
      handle: r.handle, display_name: r.display_name, city: r.city, category: r.category,
      bank_name: r.bank_name, kyc_status: r.kyc_status, account_created_at: r.account_created_at,
      totalTx: facts.totalTx, tx24h: facts.tx24h, signals: facts.signals.length,
      links: facts.links.map((l) => ({ handle: l.handle, link_type: l.link_type, flagged: l.flagged })),
    },
    assessment: a,
  };
}
