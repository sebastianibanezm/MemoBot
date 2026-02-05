import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { stripe, STRIPE_PRICES } from "@/lib/stripe";
import { getOrCreateStripeCustomer } from "@/lib/services/subscription";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { priceId, billingInterval = "monthly" } = body;

    // Validate price ID
    let selectedPriceId = priceId;
    if (!selectedPriceId) {
      // Default to pro monthly if no price specified
      selectedPriceId = billingInterval === "yearly" 
        ? STRIPE_PRICES.pro.yearly 
        : STRIPE_PRICES.pro.monthly;
    }
    
    console.log("[Checkout] billingInterval:", billingInterval);
    console.log("[Checkout] selectedPriceId:", selectedPriceId);
    console.log("[Checkout] STRIPE_PRICES:", JSON.stringify(STRIPE_PRICES));

    // Get or create Stripe customer
    const email = user.emailAddresses[0]?.emailAddress || "";
    const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined;
    const customerId = await getOrCreateStripeCustomer(userId, email, name);

    // Determine URLs
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const successUrl = `${appUrl}/dashboard/settings?session_id={CHECKOUT_SESSION_ID}&success=true`;
    const cancelUrl = `${appUrl}/pricing?canceled=true`;

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: selectedPriceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId,
      },
      subscription_data: {
        metadata: {
          userId,
        },
      },
      allow_promotion_codes: true,
      billing_address_collection: "auto",
    });

    return NextResponse.json({ 
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error("[/api/checkout] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to create checkout session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
