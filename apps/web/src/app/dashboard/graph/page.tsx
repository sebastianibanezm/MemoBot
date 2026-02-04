"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface Node {
  id: string;
  title: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface GraphLink {
  source: string;
  target: string;
}

const WIDTH = 800;
const HEIGHT = 600;
const REPULSION = 8000;
const ATTRACTION = 0.01;
const DAMPING = 0.85;
const MAX_VEL = 8;

// Tech-noir color palette
const COLORS = {
  node: "#c4a35a",
  nodeHover: "#8b4513",
  edge: "#1a1a1a",
  edgeFaint: "rgba(26, 26, 26, 0.15)",
  text: "#1a1a1a",
  textMuted: "#6b635a",
};

export default function GraphPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [loading, setLoading] = useState(true);
  const linksRef = useRef<GraphLink[]>([]);

  useEffect(() => {
    fetch("/api/graph")
      .then((res) => (res.ok ? res.json() : { nodes: [], links: [] }))
      .then((data) => {
        const nodeList = (data.nodes ?? []).map((n: Node) => ({
          ...n,
          x: Math.random() * 400 - 200,
          y: Math.random() * 400 - 200,
          vx: 0,
          vy: 0,
        }));
        setNodes(nodeList);
        const linkList = data.links ?? [];
        setLinks(linkList);
        linksRef.current = linkList;
      })
      .catch(() => {
        setNodes([]);
        setLinks([]);
        linksRef.current = [];
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (nodes.length === 0) return;
    const interval = setInterval(() => {
      setNodes((prev) => {
        const nodeMap = new Map(prev.map((n) => [n.id, { ...n }]));
        const currentLinks = linksRef.current;
        for (let iter = 0; iter < 2; iter++) {
          prev.forEach((a, i) => {
            const na = nodeMap.get(a.id)!;
            let fx = 0;
            let fy = 0;
            prev.forEach((b, j) => {
              if (i === j) return;
              const nb = nodeMap.get(b.id)!;
              const dx = (na.x ?? 0) - (nb.x ?? 0);
              const dy = (na.y ?? 0) - (nb.y ?? 0);
              const d = Math.sqrt(dx * dx + dy * dy) || 0.1;
              const rep = REPULSION / (d * d);
              fx += (dx / d) * rep;
              fy += (dy / d) * rep;
            });
            currentLinks.forEach((l) => {
              const source = l.source as string;
              const target = l.target as string;
              if (a.id === source) {
                const nb = nodeMap.get(target);
                if (nb) {
                  fx += ((nb.x ?? 0) - (na.x ?? 0)) * ATTRACTION;
                  fy += ((nb.y ?? 0) - (na.y ?? 0)) * ATTRACTION;
                }
              } else if (a.id === target) {
                const nb = nodeMap.get(source);
                if (nb) {
                  fx += ((nb.x ?? 0) - (na.x ?? 0)) * ATTRACTION;
                  fy += ((nb.y ?? 0) - (na.y ?? 0)) * ATTRACTION;
                }
              }
            });
            const vx = ((na.vx ?? 0) + fx) * DAMPING;
            const vy = ((na.vy ?? 0) + fy) * DAMPING;
            const mag = Math.sqrt(vx * vx + vy * vy) || 1;
            na.vx = Math.max(-MAX_VEL, Math.min(MAX_VEL, (vx / mag) * Math.min(mag, MAX_VEL)));
            na.vy = Math.max(-MAX_VEL, Math.min(MAX_VEL, (vy / mag) * Math.min(mag, MAX_VEL)));
            na.x = Math.max(-WIDTH / 2 + 40, Math.min(WIDTH / 2 - 40, (na.x ?? 0) + (na.vx ?? 0)));
            na.y = Math.max(-HEIGHT / 2 + 40, Math.min(HEIGHT / 2 - 40, (na.y ?? 0) + (na.vy ?? 0)));
          });
        }
        return Array.from(nodeMap.values());
      });
    }, 32);
    return () => clearInterval(interval);
  }, [nodes.length]);

  if (loading) {
    return (
      <div className="p-6 pb-20 max-w-5xl mx-auto">
        <h1 
          className="text-3xl font-display tracking-widest text-[var(--foreground)] mb-6"
          style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
        >
          RELATIONSHIP GRAPH
        </h1>
        <div className="text-[var(--muted)] text-sm tracking-wider">
          <span className="text-[var(--accent)]">&gt;</span> MAPPING NEURAL CONNECTIONS...
        </div>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="p-6 pb-20 max-w-5xl mx-auto">
        <h1 
          className="text-3xl font-display tracking-widest text-[var(--foreground)] mb-6"
          style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
        >
          RELATIONSHIP GRAPH
        </h1>
        <div className="card-dystopian p-8 text-center">
          <p className="text-[var(--muted)] mb-2">NO NETWORK DATA</p>
          <p className="text-xs text-[var(--muted-light)]">
            Memories and their relationships will appear here once connections are detected.
          </p>
        </div>
      </div>
    );
  }

  const centerX = WIDTH / 2;
  const centerY = HEIGHT / 2;

  return (
    <div className="p-6 pb-20 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <h1 
          className="text-3xl font-display tracking-widest text-[var(--foreground)]"
          style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
        >
          RELATIONSHIP GRAPH
        </h1>
        <p className="text-xs text-[var(--muted)] tracking-wider mt-1">
          <span className="text-[var(--accent)]">//</span> {nodes.length} NODES | {links.length} CONNECTIONS
        </p>
      </div>

      {/* Graph Container */}
      <div className="card-dystopian overflow-hidden">
        <svg
          width={WIDTH}
          height={HEIGHT}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="block w-full h-auto"
          style={{ maxWidth: WIDTH }}
        >
          {/* Background */}
          <rect width={WIDTH} height={HEIGHT} fill="var(--card)" />
          
          {/* Grid pattern */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--card-border)" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width={WIDTH} height={HEIGHT} fill="url(#grid)" />

          <g transform={`translate(${centerX},${centerY})`}>
            {/* Edges */}
            {links.map((l, i) => {
              const source = nodes.find((n) => n.id === l.source);
              const target = nodes.find((n) => n.id === l.target);
              if (!source || !target) return null;
              const x1 = source.x ?? 0;
              const y1 = source.y ?? 0;
              const x2 = target.x ?? 0;
              const y2 = target.y ?? 0;
              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={COLORS.edge}
                  strokeWidth={1}
                  strokeOpacity={0.3}
                />
              );
            })}
            
            {/* Nodes */}
            {nodes.map((n) => (
              <g key={n.id} transform={`translate(${n.x ?? 0},${n.y ?? 0})`}>
                <Link href={`/dashboard/memories/${n.id}`}>
                  {/* Outer glow */}
                  <circle
                    r={20}
                    fill={COLORS.node}
                    fillOpacity={0.15}
                  />
                  {/* Core node */}
                  <circle
                    r={10}
                    fill={COLORS.node}
                    stroke={COLORS.nodeHover}
                    strokeWidth={2}
                    className="cursor-pointer hover:fill-[var(--accent-dark)] transition-colors"
                  />
                </Link>
                {/* Label */}
                <text
                  textAnchor="middle"
                  dy={26}
                  fill={COLORS.textMuted}
                  fontSize={10}
                  fontFamily="var(--font-ibm-plex-mono)"
                  className="pointer-events-none uppercase tracking-wider"
                >
                  {(n.title || "").slice(0, 10)}
                  {(n.title?.length ?? 0) > 10 ? "..." : ""}
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-6 text-xs text-[var(--muted)]">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[var(--accent)]"></div>
          <span>Memory Node</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-px bg-[var(--foreground)] opacity-30"></div>
          <span>Relationship</span>
        </div>
      </div>
    </div>
  );
}
