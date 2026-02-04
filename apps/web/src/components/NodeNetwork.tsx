"use client";

import { useEffect, useRef, useCallback } from "react";

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  pulsePhase: number;
}

const NODE_COUNT = 70;
const CONNECTION_DISTANCE = 150;
const NODE_SPEED = 0.3;
const PULSE_SPEED = 0.02;

// Tech-noir color palette
const COLORS = {
  node: "#c4a35a",
  nodeGlow: "rgba(196, 163, 90, 0.3)",
  connection: "#8b4513",
};

export function NodeNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const animationRef = useRef<number>(0);
  const dimensionsRef = useRef({ width: 0, height: 0 });

  // Initialize nodes
  const initNodes = useCallback((width: number, height: number) => {
    const nodes: Node[] = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * NODE_SPEED * 2,
        vy: (Math.random() - 0.5) * NODE_SPEED * 2,
        radius: 2 + Math.random() * 3,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }
    nodesRef.current = nodes;
  }, []);

  // Update node positions
  const updateNodes = useCallback((width: number, height: number) => {
    nodesRef.current.forEach((node) => {
      // Update position
      node.x += node.vx;
      node.y += node.vy;

      // Update pulse phase
      node.pulsePhase += PULSE_SPEED;

      // Bounce off edges with some padding
      const padding = 20;
      if (node.x < padding || node.x > width - padding) {
        node.vx *= -1;
        node.x = Math.max(padding, Math.min(width - padding, node.x));
      }
      if (node.y < padding || node.y > height - padding) {
        node.vy *= -1;
        node.y = Math.max(padding, Math.min(height - padding, node.y));
      }

      // Add slight random movement for organic feel
      node.vx += (Math.random() - 0.5) * 0.02;
      node.vy += (Math.random() - 0.5) * 0.02;

      // Clamp velocity
      const maxSpeed = NODE_SPEED * 2;
      node.vx = Math.max(-maxSpeed, Math.min(maxSpeed, node.vx));
      node.vy = Math.max(-maxSpeed, Math.min(maxSpeed, node.vy));
    });
  }, []);

  // Draw frame
  const draw = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Clear canvas with transparent background
    ctx.clearRect(0, 0, width, height);

    const nodes = nodesRef.current;

    // Draw connections first (behind nodes)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < CONNECTION_DISTANCE) {
          // Calculate opacity based on distance
          const opacity = 1 - distance / CONNECTION_DISTANCE;
          const pulseOffset = Math.sin((nodes[i].pulsePhase + nodes[j].pulsePhase) / 2) * 0.3 + 0.7;
          const finalOpacity = opacity * pulseOffset * 0.4;

          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.strokeStyle = `rgba(139, 69, 19, ${finalOpacity})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    // Draw nodes
    nodes.forEach((node) => {
      const pulse = Math.sin(node.pulsePhase) * 0.3 + 1;
      const glowRadius = node.radius * 3 * pulse;

      // Outer glow
      const gradient = ctx.createRadialGradient(
        node.x,
        node.y,
        0,
        node.x,
        node.y,
        glowRadius
      );
      gradient.addColorStop(0, COLORS.nodeGlow);
      gradient.addColorStop(1, "transparent");

      ctx.beginPath();
      ctx.arc(node.x, node.y, glowRadius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Core node
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius * pulse, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.node;
      ctx.fill();
    });
  }, []);

  // Animation loop
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = dimensionsRef.current;

    updateNodes(width, height);
    draw(ctx, width, height);

    animationRef.current = requestAnimationFrame(animate);
  }, [updateNodes, draw]);

  // Handle resize
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Update canvas size
    canvas.width = width;
    canvas.height = height;
    dimensionsRef.current = { width, height };

    // Reinitialize nodes if canvas size changed significantly
    if (nodesRef.current.length === 0) {
      initNodes(width, height);
    } else {
      // Adjust existing nodes to new bounds
      nodesRef.current.forEach((node) => {
        if (node.x > width) node.x = width - 20;
        if (node.y > height) node.y = height - 20;
      });
    }
  }, [initNodes]);

  useEffect(() => {
    handleResize();
    window.addEventListener("resize", handleResize);

    // Start animation
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationRef.current);
    };
  }, [handleResize, animate]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 1 }}
      aria-hidden="true"
    />
  );
}
