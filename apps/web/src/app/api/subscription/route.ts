import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSubscriptionInfo } from "@/lib/services/subscription";

/**
 * GET /api/subscription
 * Returns the current user's subscription status.
 */
export async function GET(_request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const subscriptionInfo = await getSubscriptionInfo(userId);

    return NextResponse.json({
      status: subscriptionInfo.status,
      tier: subscriptionInfo.tier,
      isActive: subscriptionInfo.isActive,
      currentPeriodEnd: subscriptionInfo.currentPeriodEnd?.toISOString() || null,
      priceId: subscriptionInfo.priceId,
    });
  } catch (error) {
    console.error("[/api/subscription] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to get subscription";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
