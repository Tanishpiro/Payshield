"use client";

import { useMemo, useState } from "react";
import { LV, lv } from "./dash-ui";

type Node = { id: string; handle: string; name: string; score: number; level: string; signals: number };
type Edge = { from: string; to: string; type: string; strength: number; detail: string };

export default function FraudGraph({
  nodes, edges, height = 400, onSelect,
}: { nodes: Node[]; edges: Edge[]; height?: number; onSelect?: (handle: string) => void }) {
  const [focus, setFocus] = useState<string | null>(null);
  const W = 760, H = 420;

  const { pos, clustered } = useMemo(() => {
    const connected = new Set<string>();
    edges.forEach((e) => { connected.add(e.from); connected.add(e.to); });
    const inner = nodes.filter((n) => connected.has(n.id));
    const outer = nodes.filter((n) => !connected.has(n.id));
    const m = new Map<string, { x: number; y: number }>();
    inner.forEach((n, i) => {
      const a = (i / Math.max(1, inner.length)) * Math.PI * 2 - Math.PI / 2;
      m.set(n.id, { x: W / 2 + Math.cos(a) * 112, y: H / 2 + Math.sin(a) * 92 });
    });
    outer.forEach((n, i) => {
      const a = (i / Math.max(1, outer.length)) * Math.PI * 2 + 0.42;
      m.set(n.id, { x: W / 2 + Math.cos(a) * 300, y: H / 2 + Math.sin(a) * 170 });
    });
    return { pos: m, clustered: connected };
  }, [nodes, edges]);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const near = focus
    ? new Set(edges.filter((e) => e.from === focus || e.to === focus).flatMap((e) => [e.from, e.to]).concat(focus))
    : null;
  const focusNode = focus ? byId.get(focus) : null;
  const focusEdges = focus ? edges.filter((e) => e.from === focus || e.to === focus) : [];

  return (
    <div>
      <div className="card-flat relative overflow-hidden" style={{ background: "var(--surface)" }}>
        {/* graph paper backdrop */}
        <div className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, #f0f0ea 1px, transparent 1px), linear-gradient(to bottom, #f0f0ea 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }} />
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height }} role="img"
          aria-label="Fraud network graph of connected receiver accounts"
          onMouseLeave={() => setFocus(null)}>
          {/* cluster halo */}
          <ellipse cx={W / 2} cy={H / 2} rx={176} ry={150} fill="var(--crit)" fillOpacity=".035"
            stroke="var(--crit)" strokeOpacity=".16" strokeDasharray="4 5" />
          <text x={W / 2} y={H / 2 - 158} textAnchor="middle" fontSize="10.5" fontWeight="600"
            letterSpacing=".08em" fill="var(--crit-ink)">SUSPECTED CLUSTER</text>

          {edges.map((e, i) => {
            const a = pos.get(e.from), b = pos.get(e.to);
            if (!a || !b) return null;
            const on = !focus || e.from === focus || e.to === focus;
            const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
            const cxp = mx + (my - H / 2) * 0.12, cyp = my + (mx - W / 2) * 0.12;
            return (
              <g key={i} opacity={on ? 1 : 0.12} style={{ transition: "opacity .2s" }}>
                <path d={`M${a.x},${a.y} Q${cxp},${cyp} ${b.x},${b.y}`} fill="none"
                  stroke="var(--crit)" strokeOpacity={0.2 + e.strength * 0.45}
                  strokeWidth={1 + e.strength * 2.4}
                  strokeDasharray={e.type === "common_senders" ? "5 4" : undefined} />
                {focus && on && (
                  <text x={cxp} y={cyp - 6} textAnchor="middle" fontSize="9.5" fill="var(--ink-3)" className="mono">
                    {e.type.replace(/_/g, " ")}
                  </text>
                )}
              </g>
            );
          })}

          {nodes.map((n) => {
            const p = pos.get(n.id);
            if (!p) return null;
            const m = LV[lv(n.level)];
            const dim = near && !near.has(n.id);
            const r = 11 + n.signals * 2.1;
            return (
              <g key={n.id} transform={`translate(${p.x},${p.y})`} opacity={dim ? 0.24 : 1}
                style={{ cursor: "pointer", transition: "opacity .2s" }}
                tabIndex={0} role="button" aria-label={`${n.handle}, score ${n.score}, ${m.label}`}
                onMouseEnter={() => setFocus(n.id)}
                onFocus={() => setFocus(n.id)}
                onClick={() => onSelect?.(n.handle)}
                onKeyDown={(ev) => { if (ev.key === "Enter") onSelect?.(n.handle); }}>
                {focus === n.id && <circle r={r + 7} fill="none" stroke={m.mark} strokeOpacity=".3" strokeWidth="1" />}
                <circle r={r} fill="#fff" stroke={m.mark} strokeWidth="1.8" />
                <circle r={r - 4.5} fill={m.mark} fillOpacity=".16" />
                <text y="3.5" textAnchor="middle" fontSize="10.5" fontWeight="600" fill={m.ink} className="mono">{n.score}</text>
                <text y={-r - 8} textAnchor="middle" fontSize="10.5" fill="var(--ink-2)" className="mono">{n.handle.split("@")[0]}</text>
              </g>
            );
          })}
        </svg>

        <div className="pointer-events-none absolute bottom-2.5 right-3 flex flex-wrap gap-3 rounded-lg border border-[var(--line)] bg-white/90 px-2.5 py-1.5 backdrop-blur">
          {(["low", "medium", "high", "critical"] as const).map((k) => (
            <span key={k} className="flex items-center gap-1.5 text-[10.5px] font-medium text-[var(--ink-2)]">
              <span className="h-2 w-2 rounded-full" style={{ background: LV[k].mark }} />{LV[k].short}
            </span>
          ))}
        </div>
      </div>

      <p className="mt-2.5 min-h-[34px] text-[12.5px] leading-relaxed text-[var(--ink-2)]">
        {focusNode ? (
          <>
            <span className="font-semibold text-[var(--ink)]">{focusNode.name}</span>{" "}
            <span className="mono text-[var(--ink-3)]">{focusNode.handle}</span> —{" "}
            {focusEdges.length
              ? <>{focusEdges.length} link{focusEdges.length > 1 ? "s" : ""}: {focusEdges.map((e) => e.type.replace(/_/g, " ")).join(", ")}. Click to run a live check.</>
              : <>no links to other flagged receivers. Click to run a live check.</>}
          </>
        ) : (
          <>Hover or tab to a node to trace its links. Ring size grows with the number of fraud signals; {clustered.size} of {nodes.length} accounts sit inside the cluster.</>
        )}
      </p>
    </div>
  );
}
