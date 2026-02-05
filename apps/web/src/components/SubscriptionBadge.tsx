"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface SubscriptionInfo {
  status: string;
  tier: string;
  isActive: boolean;
  currentPeriodEnd: string | null;
}

export function SubscriptionBadge() {
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/subscription")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setSubscription(data))
      .catch(() => setSubscription(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <span className="px-2 py-1 text-[10px] tracking-wider bg-[var(--card)] border border-[var(--card-border)] rounded animate-pulse">
        ...
      </span>
    );
  }

  if (!subscription) {
    return null;
  }

  const tier = subscription.tier || "free";
  const isActive = subscription.isActive;
  const isPastDue = subscription.status === "past_due";

  // Badge styling based on tier
  const badgeClasses: Record<string, string> = {
    free: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    pro: "bg-[var(--accent)]/20 text-[var(--accent)] border-[var(--accent)]/30",
    enterprise: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  };

  const tierLabels: Record<string, string> = {
    free: "FREE",
    pro: "PRO",
    enterprise: "ENTERPRISE",
  };

  // If past due, show warning style
  if (isPastDue) {
    return (
      <Link
        href="/dashboard/settings"
        className="px-2 py-1 text-[10px] tracking-wider bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded hover:bg-yellow-500/30 transition-colors"
        title="Payment failed - click to update"
      >
        PAST DUE
      </Link>
    );
  }

  // Free tier - show upgrade link
  if (tier === "free") {
    return (
      <Link
        href="/pricing"
        className="px-2 py-1 text-[10px] tracking-wider bg-gray-500/20 text-gray-400 border border-gray-500/30 rounded hover:bg-[var(--accent)]/20 hover:text-[var(--accent)] hover:border-[var(--accent)]/30 transition-colors"
        title="Upgrade to Pro"
      >
        FREE
      </Link>
    );
  }

  // Paid tier - show badge
  return (
    <span 
      className={`px-2 py-1 text-[10px] tracking-wider border rounded ${badgeClasses[tier]}`}
      title={isActive ? "Active subscription" : "Subscription inactive"}
    >
      {tierLabels[tier]}
    </span>
  );
}
