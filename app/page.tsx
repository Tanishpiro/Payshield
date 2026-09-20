import Dashboard from "@/components/Dashboard";
import { loadReceiverCards, buildFacts } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { cards, all } = await loadReceiverCards();
  const { byId } = buildFacts(all);

  const nodes = cards.map((c) => ({ id: c.id, handle: c.handle, name: c.name, score: c.score, level: c.level, signals: c.signals }));
  const edges = all.links.map((l: any) => ({
    from: l.from_receiver,
    to: l.to_receiver,
    type: l.link_type,
    strength: Number(l.strength),
    detail: l.detail as string,
  }));

  const recent = all.tx.slice(0, 40).map((t: any) => ({
    receiver: byId.get(t.receiver_id)?.handle ?? "unknown",
    sender: t.sender_handle,
    amount: Number(t.amount),
    at: t.created_at,
  }));

  const stats = {
    receivers: cards.length,
    flagged: cards.filter((c) => c.level === "high" || c.level === "critical").length,
    signals: all.signals.length,
    clusters: new Set(all.links.map((l: any) => l.link_type)).size,
    tx24h: all.tx.filter((t: any) => Date.now() - new Date(t.created_at).getTime() < 86400000).length,
    valueProtected: cards
      .filter((c) => c.level === "critical" || c.level === "high")
      .reduce((a, c) => a + c.tx24h * 4000, 0),
  };

  return <Dashboard cards={cards} nodes={nodes} edges={edges} recent={recent} stats={stats} />;
}
