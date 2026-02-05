"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { NEON_COLORS, type NeonColorKey } from "@/lib/constants/colors";

interface Node {
  id: string;
  title: string;
  summary?: string | null;
  createdAt?: string;
  categoryColor?: string | null;
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
const HEIGHT = 450;
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

// Helper to get node color from category
function getNodeColor(categoryColor: string | null | undefined): { fill: string; glow: string } {
  if (!categoryColor) {
    return { fill: COLORS.node, glow: "rgba(196, 163, 90, 0.3)" };
  }
  const color = NEON_COLORS[categoryColor as NeonColorKey];
  if (!color) {
    return { fill: COLORS.node, glow: "rgba(196, 163, 90, 0.3)" };
  }
  return { fill: color.hex, glow: color.glow };
}

export default function GraphPage() {
  const router = useRouter();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [cardPosition, setCardPosition] = useState<{ x: number; y: number } | null>(null);
  const linksRef = useRef<GraphLink[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    fetch("/api/graph")
      .then((res) => (res.ok ? res.json() : { nodes: [], links: [] }))
      .then((data) => {
        const nodeList = (data.nodes ?? []).map((n: Node) => ({
          ...n,
          x: Math.random() * 300 - 150,
          y: Math.random() * 200 - 100,
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

  // Update card position when selected node moves
  useEffect(() => {
    if (!selectedNode || !svgRef.current) return;
    
    const node = nodes.find((n) => n.id === selectedNode.id);
    if (node) {
      const svg = svgRef.current;
      const rect = svg.getBoundingClientRect();
      const scaleX = rect.width / WIDTH;
      const scaleY = rect.height / HEIGHT;
      const centerX = WIDTH / 2;
      const centerY = HEIGHT / 2;
      const screenX = rect.left + (centerX + (node.x ?? 0)) * scaleX;
      const screenY = rect.top + (centerY + (node.y ?? 0)) * scaleY;
      setCardPosition({ x: screenX, y: screenY });
      
      // Also update selectedNode with latest position data
      if (node.x !== selectedNode.x || node.y !== selectedNode.y) {
        setSelectedNode(node);
      }
    }
  }, [nodes, selectedNode]);

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
            na.x = Math.max(-WIDTH / 2 + 30, Math.min(WIDTH / 2 - 30, (na.x ?? 0) + (na.vx ?? 0)));
            na.y = Math.max(-HEIGHT / 2 + 30, Math.min(HEIGHT / 2 - 30, (na.y ?? 0) + (na.vy ?? 0)));
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
      <div className="card-dystopian overflow-hidden relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="block w-full h-auto"
          preserveAspectRatio="xMidYMid meet"
          onClick={() => {
            setSelectedNode(null);
            setCardPosition(null);
          }}
        >
          {/* Background */}
          <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="var(--card)" />
          
          {/* Grid pattern */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--card-border)" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="url(#grid)" />

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
              
              // Check if this edge is connected to the selected node
              const isConnectedToSelected = !selectedNode || 
                l.source === selectedNode.id || 
                l.target === selectedNode.id;
              
              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={isConnectedToSelected ? "var(--muted)" : "#444444"}
                  strokeWidth={1}
                  strokeOpacity={isConnectedToSelected ? 0.6 : 0.2}
                  strokeLinecap="round"
                />
              );
            })}
            
            {/* Nodes */}
            {(() => {
              // Calculate connected nodes when a node is selected
              const connectedNodeIds = new Set<string>();
              if (selectedNode) {
                connectedNodeIds.add(selectedNode.id);
                links.forEach((l) => {
                  if (l.source === selectedNode.id) {
                    connectedNodeIds.add(l.target);
                  } else if (l.target === selectedNode.id) {
                    connectedNodeIds.add(l.source);
                  }
                });
              }

              return nodes.map((n) => {
                const nodeColor = getNodeColor(n.categoryColor);
                const isSelected = selectedNode?.id === n.id;
                const isConnected = !selectedNode || connectedNodeIds.has(n.id);
                const isGrayed = selectedNode && !isConnected;
                
                // Use gray color for unconnected nodes
                const displayColor = isGrayed 
                  ? { fill: "#666666", glow: "rgba(102, 102, 102, 0.2)" }
                  : nodeColor;
                
                return (
                <g key={n.id} transform={`translate(${n.x ?? 0},${n.y ?? 0})`}>
                  <g
                    onClick={(e) => {
                      e.stopPropagation();
                      if (selectedNode?.id === n.id) {
                        // If clicking the same node, deselect it
                        setSelectedNode(null);
                        setCardPosition(null);
                      } else {
                        // Calculate position for the card (relative to the SVG container)
                        const svg = svgRef.current;
                        if (svg) {
                          const rect = svg.getBoundingClientRect();
                          const scaleX = rect.width / WIDTH;
                          const scaleY = rect.height / HEIGHT;
                          const screenX = rect.left + (centerX + (n.x ?? 0)) * scaleX;
                          const screenY = rect.top + (centerY + (n.y ?? 0)) * scaleY;
                          setCardPosition({ x: screenX, y: screenY });
                        }
                        setSelectedNode(n);
                      }
                    }}
                    className="cursor-pointer"
                  >
                    {/* Outer glow */}
                    <circle
                      r={isSelected ? 8 : 6}
                      fill={displayColor.fill}
                      fillOpacity={isGrayed ? 0.15 : (isSelected ? 0.4 : 0.25)}
                    />
                    {/* Core node */}
                    <circle
                      r={isSelected ? 4 : 3}
                      fill={displayColor.fill}
                      stroke={isSelected ? "#fff" : displayColor.fill}
                      strokeWidth={isSelected ? 1.5 : 1}
                      strokeOpacity={isGrayed ? 0.3 : (isSelected ? 0.9 : 0.6)}
                      className="transition-all hover:opacity-80"
                      style={{ filter: isGrayed ? "none" : `drop-shadow(0 0 ${isSelected ? 4 : 2}px ${displayColor.glow})` }}
                    />
                  </g>
                  {/* Label */}
                  <text
                    textAnchor="middle"
                    dy={14}
                    fill={isGrayed ? "#555555" : (isSelected ? displayColor.fill : COLORS.textMuted)}
                    fontSize={8}
                    fontFamily="var(--font-ibm-plex-mono)"
                    className="pointer-events-none uppercase tracking-wider"
                    style={{ fontWeight: isSelected ? 600 : 400 }}
                  >
                    {(n.title || "").slice(0, 10)}
                    {(n.title?.length ?? 0) > 10 ? "..." : ""}
                  </text>
                </g>
                );
              });
            })()}
          </g>
        </svg>

        {/* Memory Card Popup */}
        {selectedNode && cardPosition && (
          <div
            className="fixed z-50 animate-in fade-in zoom-in-95 duration-150"
            style={{
              left: cardPosition.x,
              top: cardPosition.y,
              transform: "translate(-50%, -100%) translateY(-20px)",
            }}
          >
            <div
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/dashboard/memories/${selectedNode.id}`);
              }}
              className="card-dystopian p-4 w-64 cursor-pointer hover:border-[var(--accent)] transition-all group"
            >
              {/* Arrow pointing down */}
              <div
                className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-full w-0 h-0"
                style={{
                  borderLeft: "8px solid transparent",
                  borderRight: "8px solid transparent",
                  borderTop: "8px solid var(--card-border)",
                }}
              />
              
              {/* Title */}
              <h3
                className="text-sm font-display tracking-wider text-[var(--foreground)] mb-2 group-hover:text-[var(--accent)] transition-colors line-clamp-1"
                style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
              >
                {selectedNode.title || "(UNTITLED)"}
              </h3>
              
              {/* Summary */}
              {selectedNode.summary ? (
                <p className="text-xs text-[var(--muted)] line-clamp-3 mb-3">
                  {selectedNode.summary}
                </p>
              ) : (
                <p className="text-xs text-[var(--muted-light)] italic mb-3">
                  No summary available
                </p>
              )}
              
              {/* Date */}
              <div className="flex items-center justify-between text-[10px] text-[var(--muted-light)]">
                <span className="tracking-wider">
                  {selectedNode.createdAt
                    ? new Date(selectedNode.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "Unknown date"}
                </span>
                <span className="text-[var(--accent)] group-hover:translate-x-1 transition-transform">
                  VIEW →
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-6 text-xs text-[var(--muted)]">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-0.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: NEON_COLORS["neon-cyan"].hex }}></div>
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: NEON_COLORS["neon-pink"].hex }}></div>
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: NEON_COLORS["neon-green"].hex }}></div>
          </div>
          <span>Node = Category Color</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-px bg-[var(--muted)] opacity-60 rounded-full"></div>
          <span>Linked Memory</span>
        </div>
      </div>
    </div>
  );
}
