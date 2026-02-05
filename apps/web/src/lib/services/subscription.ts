import Stripe from "stripe";
import { stripe, getTierFromPriceId } from "../stripe";
import { createServerSupabase } from "../supabase/server";

export type SubscriptionStatus = "active" | "past_due" | "canceled" | "trialing" | "inactive";
export type SubscriptionTier = "free" | "pro" | "enterprise";

export interface SubscriptionInfo {
  status: SubscriptionStatus;
  tier: SubscriptionTier;
  customerId: string | null;
  subscriptionId: string | null;
  priceId: string | null;
  currentPeriodEnd: Date | null;
  isActive: boolean;
}

/**
 * Get or create a Stripe customer for a user.
 * Links the Stripe customer ID to the user in the database.
 */
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  name?: string
): Promise<string> {
  const supabase = createServerSupabase();

  // Check if user already has a Stripe customer ID
  const { data: user, error: fetchError } = await supabase
    .from("users")
    .select("stripe_customer_id, email, name")
    .eq("id", userId)
    .single();

  if (fetchError) {
    console.error("[getOrCreateStripeCustomer] Failed to fetch user:", fetchError);
    throw new Error("Failed to fetch user");
  }

  // Return existing customer ID if present
  if (user?.stripe_customer_id) {
    return user.stripe_customer_id;
  }

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email: email || user?.email,
    name: name || user?.name || undefined,
    metadata: {
      userId,
    },
  });

  // Save customer ID to database
  const { error: updateError } = await supabase
    .from("users")
    .update({ stripe_customer_id: customer.id })
    .eq("id", userId);

  if (updateError) {
    console.error("[getOrCreateStripeCustomer] Failed to save customer ID:", updateError);
    // Don't throw - customer was created in Stripe, just not saved locally
  }

  return customer.id;
}

/**
 * Sync subscription data from Stripe to the database.
 * Called by webhook handlers after subscription events.
 */
export async function syncSubscription(
  customerId: string,
  subscription: Stripe.Subscription
): Promise<void> {
  const supabase = createServerSupabase();

  // Get current period end from the subscription
  const currentPeriodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end;
  
  const updateData = {
    stripe_subscription_id: subscription.id,
    stripe_price_id: subscription.items.data[0]?.price.id || null,
    stripe_current_period_end: currentPeriodEnd 
      ? new Date(currentPeriodEnd * 1000).toISOString() 
      : null,
    stripe_status: subscription.status as SubscriptionStatus,
  };

  const { error } = await supabase
    .from("users")
    .update(updateData)
    .eq("stripe_customer_id", customerId);

  if (error) {
    console.error("[syncSubscription] Failed to sync subscription:", error);
    throw new Error("Failed to sync subscription");
  }
}

/**
 * Mark subscription as canceled in the database.
 */
export async function cancelSubscription(customerId: string): Promise<void> {
  const supabase = createServerSupabase();

  const { error } = await supabase
    .from("users")
    .update({
      stripe_status: "canceled",
      stripe_subscription_id: null,
    })
    .eq("stripe_customer_id", customerId);

  if (error) {
    console.error("[cancelSubscription] Failed to cancel subscription:", error);
    throw new Error("Failed to cancel subscription");
  }
}

/**
 * Update subscription status (e.g., to past_due on payment failure).
 */
export async function updateSubscriptionStatus(
  customerId: string,
  status: SubscriptionStatus
): Promise<void> {
  const supabase = createServerSupabase();

  const { error } = await supabase
    .from("users")
    .update({ stripe_status: status })
    .eq("stripe_customer_id", customerId);

  if (error) {
    console.error("[updateSubscriptionStatus] Failed to update status:", error);
    throw new Error("Failed to update subscription status");
  }
}

/**
 * Get subscription info for a user.
 */
export async function getSubscriptionInfo(userId: string): Promise<SubscriptionInfo> {
  const supabase = createServerSupabase();

  const { data: user, error } = await supabase
    .from("users")
    .select(
      "stripe_customer_id, stripe_subscription_id, stripe_price_id, stripe_current_period_end, stripe_status"
    )
    .eq("id", userId)
    .single();

  if (error || !user) {
    return {
      status: "inactive",
      tier: "free",
      customerId: null,
      subscriptionId: null,
      priceId: null,
      currentPeriodEnd: null,
      isActive: false,
    };
  }

  const status = (user.stripe_status as SubscriptionStatus) || "inactive";
  const tier = getTierFromPriceId(user.stripe_price_id);
  const currentPeriodEnd = user.stripe_current_period_end
    ? new Date(user.stripe_current_period_end)
    : null;

  // Check if subscription is still valid
  const isActive =
    (status === "active" || status === "trialing") &&
    currentPeriodEnd !== null &&
    currentPeriodEnd > new Date();

  return {
    status,
    tier: isActive ? tier : "free",
    customerId: user.stripe_customer_id,
    subscriptionId: user.stripe_subscription_id,
    priceId: user.stripe_price_id,
    currentPeriodEnd,
    isActive,
  };
}

/**
 * Check if user has an active subscription.
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const info = await getSubscriptionInfo(userId);
  return info.isActive;
}

/**
 * Get the subscription tier for a user.
 */
export async function getSubscriptionTier(userId: string): Promise<SubscriptionTier> {
  const info = await getSubscriptionInfo(userId);
  return info.tier;
}

/**
 * Link a Stripe customer to a user by userId (from checkout session metadata).
 */
export async function linkStripeCustomer(
  userId: string,
  customerId: string
): Promise<void> {
  const supabase = createServerSupabase();

  const { error } = await supabase
    .from("users")
    .update({ stripe_customer_id: customerId })
    .eq("id", userId);

  if (error) {
    console.error("[linkStripeCustomer] Failed to link customer:", error);
    throw new Error("Failed to link Stripe customer");
  }
}

/**
 * Get user ID from Stripe customer ID.
 */
export async function getUserIdFromCustomer(customerId: string): Promise<string | null> {
  const supabase = createServerSupabase();

  const { data: user, error } = await supabase
    .from("users")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (error || !user) {
    return null;
  }

  return user.id;
}
