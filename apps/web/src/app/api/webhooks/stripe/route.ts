import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import {
  syncSubscription,
  cancelSubscription,
  updateSubscriptionStatus,
  linkStripeCustomer,
} from "@/lib/services/subscription";

/**
 * Stripe webhook handler.
 * Processes subscription lifecycle events from Stripe.
 * 
 * Required webhook events to configure in Stripe Dashboard:
 * - checkout.session.completed
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.payment_failed
 * - invoice.payment_succeeded
 */
export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      console.error("[Stripe Webhook] Missing stripe-signature header");
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[Stripe Webhook] Missing STRIPE_WEBHOOK_SECRET");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[Stripe Webhook] Signature verification failed:", message);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // Process the event
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutComplete(session);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(invoice);
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Stripe Webhook] Error:", error);
    // Return 200 to prevent Stripe from retrying
    // Log the error for investigation
    return NextResponse.json({ received: true, error: "Handler error" });
  }
}

/**
 * Handle checkout.session.completed event.
 * Links Stripe customer to user and syncs subscription.
 */
async function handleCheckoutComplete(session: Stripe.Checkout.Session): Promise<void> {
  console.log("[Stripe Webhook] Checkout completed:", session.id);

  const userId = session.metadata?.userId;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!userId || !customerId) {
    console.error("[Stripe Webhook] Missing userId or customerId in checkout session");
    return;
  }

  // Link customer to user if not already linked
  try {
    await linkStripeCustomer(userId, customerId);
  } catch (error) {
    console.error("[Stripe Webhook] Failed to link customer:", error);
  }

  // Fetch and sync the subscription
  if (subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await syncSubscription(customerId, subscription);
    } catch (error) {
      console.error("[Stripe Webhook] Failed to sync subscription:", error);
    }
  }
}

/**
 * Handle customer.subscription.created/updated events.
 * Syncs subscription data to the database.
 */
async function handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
  console.log("[Stripe Webhook] Subscription updated:", subscription.id, subscription.status);

  const customerId = subscription.customer as string;
  
  try {
    await syncSubscription(customerId, subscription);
  } catch (error) {
    console.error("[Stripe Webhook] Failed to sync subscription update:", error);
  }
}

/**
 * Handle customer.subscription.deleted event.
 * Marks subscription as canceled in the database.
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  console.log("[Stripe Webhook] Subscription deleted:", subscription.id);

  const customerId = subscription.customer as string;
  
  try {
    await cancelSubscription(customerId);
  } catch (error) {
    console.error("[Stripe Webhook] Failed to cancel subscription:", error);
  }
}

/**
 * Handle invoice.payment_failed event.
 * Updates subscription status to past_due.
 */
async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  console.log("[Stripe Webhook] Payment failed for invoice:", invoice.id);

  const customerId = invoice.customer as string;
  
  try {
    await updateSubscriptionStatus(customerId, "past_due");
  } catch (error) {
    console.error("[Stripe Webhook] Failed to update status on payment failure:", error);
  }
}

/**
 * Handle invoice.payment_succeeded event.
 * Updates subscription status to active.
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  console.log("[Stripe Webhook] Payment succeeded for invoice:", invoice.id);

  const customerId = invoice.customer as string;
  // subscription can be string ID or object in newer API versions
  const subscriptionData = (invoice as unknown as { subscription?: string | { id: string } }).subscription;
  const subscriptionId = typeof subscriptionData === 'string' 
    ? subscriptionData 
    : subscriptionData?.id;
  
  // Fetch fresh subscription data and sync
  if (subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await syncSubscription(customerId, subscription);
    } catch (error) {
      console.error("[Stripe Webhook] Failed to sync on payment success:", error);
    }
  }
}
