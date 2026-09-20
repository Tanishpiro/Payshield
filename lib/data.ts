import { createClient } from "@supabase/supabase-js";
import type { ReceiverFacts } from "./risk";
import { assess, trustScore, accountAgeDays } from "./risk";

// Falls back to the demo project so the app runs with no .env.local file.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mrkehxmoqpxaycrtcxwq.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_-nCTKkr92fhk2tSg7YhDGw_OZpQ28hM";

export const sb = () => createClient(url, key, { auth: { persistSession: false } });

type Row = Record<string, any>;

export async function loadAll() {
  const db = sb();
  const [receivers, devices, rdev, signals, links, tx] = await Promise.all([
    db.from("ps_receivers").select("*"),
    db.from("ps_devices").select("*"),
    db.from("ps_receiver_devices").select("*"),
    db.from("ps_fraud_signals").select("*"),
    db.from("ps_receiver_links").select("*"),
    db.from("ps_transactions").select("receiver_id,sender_handle,amount,created_at").order("created_at", { ascending: false }).limit(4000),
  ]);
  return {
    receivers: (receivers.data ?? []) as Row[],
    devices: (devices.data ?? []) as Row[],
    rdev: (rdev.data ?? []) as Row[],
    signals: (signals.data ?? []) as Row[],
    links: (links.data ?? []) as Row[],
    tx: (tx.data ?? []) as Row[],
  };
}

const DAY = 86400000;

export function buildFacts(all: Awaited<ReturnType<typeof loadAll>>) {
  const byId = new Map<string, Row>(all.receivers.map((r) => [r.id, r]));
  const deviceById = new Map<string, Row>(all.devices.map((d) => [d.id, d]));
  const devShare = new Map<string, number>();
  for (const l of all.rdev) devShare.set(l.device_id, (devShare.get(l.device_id) ?? 0) + 1);

  // a receiver is "flagged" if it carries any fraud signal
  const flagged = new Set(all.signals.map((s) => s.receiver_id));

  const facts = new Map<string, ReceiverFacts>();
  for (const r of all.receivers) {
    const mine = all.tx.filter((t) => t.receiver_id === r.id);
    const now = Date.now();
    const in24 = mine.filter((t) => now - new Date(t.created_at).getTime() < DAY);
    const in7 = mine.filter((t) => now - new Date(t.created_at).getTime() < 7 * DAY);
    const days = new Set(mine.map((t) => String(t.created_at).slice(0, 10)));
    const myDevices = all.rdev
      .filter((d) => d.receiver_id === r.id)
      .map((d) => deviceById.get(d.device_id))
      .filter(Boolean)
      .map((d: any) => ({
        fingerprint: d.fingerprint,
        is_emulator: d.is_emulator,
        is_vpn: d.is_vpn,
        ip_country: d.ip_country,
        sharedWith: devShare.get(d.id) ?? 1,
      }));
    const myLinks = all.links
      .filter((l) => l.from_receiver === r.id || l.to_receiver === r.id)
      .map((l) => {
        const otherId = l.from_receiver === r.id ? l.to_receiver : l.from_receiver;
        const other = byId.get(otherId);
        return { handle: other?.handle ?? "unknown", link_type: l.link_type, strength: Number(l.strength), flagged: flagged.has(otherId) };
      });

    facts.set(r.id, {
      handle: r.handle,
      display_name: r.display_name,
      category: r.category,
      city: r.city,
      bank_name: r.bank_name,
      account_created_at: r.account_created_at,
      kyc_status: r.kyc_status,
      avg_ticket: Number(r.avg_ticket ?? 0),
      totalTx: mine.length,
      tx24h: in24.length,
      tx7d: in7.length,
      uniqueSenders24h: new Set(in24.map((t) => t.sender_handle)).size,
      distinctDays: days.size,
      signals: all.signals.filter((s) => s.receiver_id === r.id).map((s) => ({ signal_type: s.signal_type, severity: s.severity, confirmed: s.confirmed, detail: s.detail, reported_at: s.reported_at })),
      devices: myDevices as any,
      links: myLinks,
    });
  }
  return { facts, byId };
}

export type ReceiverCard = {
  id: string;
  handle: string;
  name: string;
  city: string | null;
  category: string | null;
  kyc: string;
  ageDays: number;
  score: number;
  level: string;
  action: string;
  trust: number;
  tx24h: number;
  totalTx: number;
  signals: number;
  links: number;
  topReasons: { label: string; detail: string }[];
};

export async function loadReceiverCards() {
  const all = await loadAll();
  const { facts } = buildFacts(all);
  const cards: ReceiverCard[] = [];
  for (const [id, f] of facts) {
    const a = assess(f, Math.max(500, Math.round(f.avg_ticket || 500)));
    cards.push({
      id,
      handle: f.handle,
      name: f.display_name,
      city: f.city,
      category: f.category,
      kyc: f.kyc_status,
      ageDays: accountAgeDays(f.account_created_at),
      score: a.score,
      level: a.level,
      action: a.action,
      trust: trustScore(f),
      tx24h: f.tx24h,
      totalTx: f.totalTx,
      signals: f.signals.length,
      links: f.links.length,
      topReasons: a.reasons.slice(0, 3).map((r) => ({ label: r.label, detail: r.detail })),
    });
  }
  cards.sort((a, b) => b.score - a.score);
  return { cards, all };
}
