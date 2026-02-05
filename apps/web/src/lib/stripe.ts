import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error(
    "Missing STRIPE_SECRET_KEY. Add it to apps/web/.env.local"
  );
}

/**
 * Server-side Stripe client.
 * Use this for all Stripe API calls from API routes.
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-01-28.clover",
  typescript: true,
});

/**
 * Price IDs for subscription plans.
 * Replace these with your actual Stripe Price IDs from the dashboard.
 */
export const STRIPE_PRICES = {
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || "price_pro_monthly",
    yearly: process.env.STRIPE_PRICE_PRO_YEARLY || "price_pro_yearly",
  },
  enterprise: {
    monthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY || "price_enterprise_monthly",
    yearly: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY || "price_enterprise_yearly",
  },
} as const;

/**
 * Map price IDs to tier names for feature gating.
 */
export function getTierFromPriceId(priceId: string | null): "free" | "pro" | "enterprise" {
  if (!priceId) return "free";
  
  const proPrices = [STRIPE_PRICES.pro.monthly, STRIPE_PRICES.pro.yearly];
  const enterprisePrices = [STRIPE_PRICES.enterprise.monthly, STRIPE_PRICES.enterprise.yearly];
  
  if (enterprisePrices.includes(priceId)) return "enterprise";
  if (proPrices.includes(priceId)) return "pro";
  
  return "free";
}
