"use client";

import { useMemo, useState } from "react";

type Node = { id: string; handle: string; name: string; score: number; level: string; signals: number };
type Edge = { from: string; to: string; type: string; strength: number; detail: string };

const COLOR: Record<string, string> = { low: "#34d399", medium: "#fbbf24", high: "#fb923c", critical: "#f43f5e" };

export default function FraudGraph({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const W = 720, H = 420;

  const pos = useMemo(() => {
    // connected (suspect network) nodes in the middle ring, clean nodes on the outside
    const connected = new Set<string>();
    edges.forEach((e) => { connected.add(e.from); connected.add(e.to); });
    const inner = nodes.filter((n) => connected.has(n.id));
    const outer = nodes.filter((n) => !connected.has(n.id));
    const m = new Map<string, { x: number; y: number }>();
    inner.forEach((n, i) => {
      const a = (i / inner.length) * Math.PI * 2 - Math.PI / 2;
      m.set(n.id, { x: W / 2 + Math.cos(a) * 118, y: H / 2 + Math.sin(a) * 96 });
    });
    outer.forEach((n, i) => {
      const a = (i / Math.max(1, outer.length)) * Math.PI * 2 + 0.4;
      m.set(n.id, { x: W / 2 + Math.cos(a) * 288, y: H / 2 + Math.sin(a) * 172 });
    });
    return m;
  }, [nodes, edges]);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const active = hover ? new Set(edges.filter((e) => e.from === hover || e.to === hover).flatMap((e) => [e.from, e.to])) : null;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Fraud network graph of connected receiver accounts">
        {edges.map((e, i) => {
          const a = pos.get(e.from), b = pos.get(e.to);
          if (!a || !b) return null;
          const on = !hover || e.from === hover || e.to === hover;
          return (
            <g key={i} opacity={on ? 1 : 0.15}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#f43f5e" strokeOpacity={0.25 + e.strength * 0.45} strokeWidth={1 + e.strength * 2.5} strokeDasharray={e.type === "common_senders" ? "5 4" : undefined} />
              {hover && on && (
                <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 5} textAnchor="middle" className="mono" fontSize="9" fill="#94a3b8">
                  {e.type.replace(/_/g, " ")}
                </text>
              )}
            </g>
          );
        })}
        {nodes.map((n) => {
          const p = pos.get(n.id)!;
          const c = COLOR[n.level] ?? "#38bdf8";
          const dim = active && !active.has(n.id);
          return (
            <g key={n.id} transform={`translate(${p.x},${p.y})`} opacity={dim ? 0.25 : 1}
               onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)} style={{ cursor: "pointer" }}>
              <circle r={12 + n.signals * 2.2} fill={c} fillOpacity={0.14} stroke={c} strokeWidth="1.8" />
              <circle r={4} fill={c} />
              <text y={-20 - n.signals * 2} textAnchor="middle" fontSize="10" fill="#cbd5e1" className="mono">{n.handle.split("@")[0]}</text>
              <text y={26 + n.signals * 2} textAnchor="middle" fontSize="10" fill={c} className="mono">{n.score}</text>
            </g>
          );
        })}
      </svg>
      <p className="mt-2 text-xs text-slate-500">
        {hover
          ? `${byId.get(hover)?.name} — ${edges.filter((e) => e.from === hover || e.to === hover).length} connection(s) to other receiver accounts.`
          : "Hover a node to trace its connections. Ring size grows with the number of fraud signals on the account."}
      </p>
    </div>
  );
}
