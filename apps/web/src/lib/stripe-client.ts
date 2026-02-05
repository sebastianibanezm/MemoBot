import { loadStripe, Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null> | null = null;

/**
 * Client-side Stripe.js loader.
 * Use this for Stripe Elements or redirecting to Checkout.
 */
export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!key) {
      console.error("Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
      return Promise.resolve(null);
    }
    stripePromise = loadStripe(key);
  }
  return stripePromise;
}

/**
 * Redirect to Stripe Checkout.
 * Call this after getting a checkout URL from /api/checkout.
 * Note: In newer Stripe.js versions, use the URL returned by the API directly.
 */
export async function redirectToCheckout(checkoutUrl: string): Promise<void> {
  window.location.href = checkoutUrl;
}
