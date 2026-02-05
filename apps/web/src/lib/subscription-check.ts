import { getSubscriptionInfo, SubscriptionTier } from "./services/subscription";

/**
 * Feature limits based on subscription tier.
 * -1 means unlimited.
 */
export interface FeatureLimits {
  memories: number;
  aiCalls: number;
  attachments: number;
  syncEnabled: boolean;
  graphEnabled: boolean;
  prioritySupport: boolean;
}

const TIER_LIMITS: Record<SubscriptionTier, FeatureLimits> = {
  free: {
    memories: 100,
    aiCalls: 50,
    attachments: 10,
    syncEnabled: false,
    graphEnabled: false,
    prioritySupport: false,
  },
  pro: {
    memories: -1, // unlimited
    aiCalls: -1,
    attachments: -1,
    syncEnabled: true,
    graphEnabled: true,
    prioritySupport: false,
  },
  enterprise: {
    memories: -1,
    aiCalls: -1,
    attachments: -1,
    syncEnabled: true,
    graphEnabled: true,
    prioritySupport: true,
  },
};

/**
 * Get feature limits for a user based on their subscription tier.
 */
export async function getFeatureLimits(userId: string): Promise<FeatureLimits> {
  const info = await getSubscriptionInfo(userId);
  return TIER_LIMITS[info.tier];
}

/**
 * Check if user has an active subscription (any paid tier).
 */
export async function requireSubscription(userId: string): Promise<boolean> {
  const info = await getSubscriptionInfo(userId);
  return info.isActive && info.tier !== "free";
}

/**
 * Check if user has a specific tier or higher.
 */
export async function requireTier(
  userId: string,
  requiredTier: SubscriptionTier
): Promise<boolean> {
  const info = await getSubscriptionInfo(userId);
  
  if (!info.isActive) return false;
  
  const tierOrder: SubscriptionTier[] = ["free", "pro", "enterprise"];
  const userTierIndex = tierOrder.indexOf(info.tier);
  const requiredTierIndex = tierOrder.indexOf(requiredTier);
  
  return userTierIndex >= requiredTierIndex;
}

/**
 * Check a specific feature limit.
 * Returns true if the user is within their limit.
 */
export async function checkFeatureLimit(
  userId: string,
  feature: keyof FeatureLimits,
  currentUsage: number
): Promise<{ allowed: boolean; limit: number; remaining: number }> {
  const limits = await getFeatureLimits(userId);
  const limit = limits[feature];
  
  // Handle boolean features
  if (typeof limit === "boolean") {
    return {
      allowed: limit,
      limit: limit ? 1 : 0,
      remaining: limit ? 1 : 0,
    };
  }
  
  // Handle unlimited (-1)
  if (limit === -1) {
    return {
      allowed: true,
      limit: -1,
      remaining: -1,
    };
  }
  
  const remaining = Math.max(0, limit - currentUsage);
  return {
    allowed: currentUsage < limit,
    limit,
    remaining,
  };
}

/**
 * Get tier display name.
 */
export function getTierDisplayName(tier: SubscriptionTier): string {
  const names: Record<SubscriptionTier, string> = {
    free: "Free",
    pro: "Pro",
    enterprise: "Enterprise",
  };
  return names[tier];
}

/**
 * Get tier badge color class.
 */
export function getTierBadgeClass(tier: SubscriptionTier): string {
  const classes: Record<SubscriptionTier, string> = {
    free: "bg-gray-500/20 text-gray-400",
    pro: "bg-[var(--accent)]/20 text-[var(--accent)]",
    enterprise: "bg-purple-500/20 text-purple-400",
  };
  return classes[tier];
}
