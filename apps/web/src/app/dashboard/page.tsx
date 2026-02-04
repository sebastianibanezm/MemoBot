"use client";

import Link from "next/link";
import ChatInterface from "@/components/ChatInterface";

const dashboardCards = [
  {
    href: "/dashboard/memories",
    title: "MEMORIES",
    description: "Browse and search your stored memories",
    icon: "//MEM",
  },
  {
    href: "/dashboard/categories",
    title: "CATEGORIES",
    description: "Organize memories by classification",
    icon: "//CAT",
  },
  {
    href: "/dashboard/tags",
    title: "TAGS",
    description: "Explore the tag cloud",
    icon: "//TAG",
  },
  {
    href: "/dashboard/graph",
    title: "GRAPH",
    description: "Visualize memory relationships",
    icon: "//NET",
  },
];

export default function DashboardPage() {
  return (
    <div className="p-6 pb-20 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 
          className="text-3xl font-display tracking-widest text-[var(--foreground)] mb-2"
          style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
        >
          MEMORY VAULT
        </h1>
        <p className="text-[var(--muted)] text-sm tracking-wider">
          <span className="text-[var(--accent)]">&gt;</span> Your personal archive. Chat with MemoBot to create or recall memories.
        </p>
      </div>

      {/* Chat Interface */}
      <div className="mb-8">
        <ChatInterface />
      </div>

      {/* Dashboard Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {dashboardCards.map(({ href, title, description, icon }) => (
          <Link
            key={href}
            href={href}
            className="group card-dystopian glitch-hover p-6 block"
          >
            <div className="flex items-start justify-between mb-3">
              <span 
                className="text-2xl font-display tracking-widest text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors"
                style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
              >
                {title}
              </span>
              <span className="text-xs text-[var(--accent)] font-mono">
                {icon}
              </span>
            </div>
            <p className="text-sm text-[var(--muted)] leading-relaxed">
              {description}
            </p>
          </Link>
        ))}
      </div>

      {/* Quick Stats Section */}
      <div className="mt-8 p-4 border border-[var(--card-border)] rounded bg-[var(--background-alt)]">
        <div className="text-xs text-[var(--muted)] tracking-wider mb-2">
          <span className="text-[var(--accent)]">//</span> QUICK ACTIONS
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/settings"
            className="text-sm text-[var(--accent-dark)] hover:text-[var(--accent)] transition-colors"
          >
            Link WhatsApp/Telegram
          </Link>
          <span className="text-[var(--card-border)]">|</span>
          <Link
            href="/dashboard/memories"
            className="text-sm text-[var(--accent-dark)] hover:text-[var(--accent)] transition-colors"
          >
            Recent Memories
          </Link>
          <span className="text-[var(--card-border)]">|</span>
          <Link
            href="/dashboard/graph"
            className="text-sm text-[var(--accent-dark)] hover:text-[var(--accent)] transition-colors"
          >
            View Network
          </Link>
        </div>
      </div>
    </div>
  );
}
