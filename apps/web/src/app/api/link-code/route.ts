import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { generateLinkCode } from "@/lib/services/account-linking";
import { sendWhatsAppVerificationCode } from "@/lib/services/whatsapp";
import { withRateLimit } from "@/lib/api-utils";

const PLATFORMS = ["whatsapp", "telegram"] as const;

/**
 * POST /api/link-code
 * Body: { platform: "whatsapp" | "telegram", phoneNumber?: string }
 * For WhatsApp: phoneNumber is required. Generates code and sends it via WhatsApp.
 * For Telegram: generates code for manual entry.
 * Returns: { code: string } (6-digit code, valid 10 min)
 * Requires Clerk auth.
 */
async function handlePost(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { platform?: string; phoneNumber?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const platform = body.platform;
  if (
    typeof platform !== "string" ||
    !PLATFORMS.includes(platform as "whatsapp" | "telegram")
  ) {
    return NextResponse.json(
      { error: "Missing or invalid platform (expected whatsapp or telegram)" },
      { status: 400 }
    );
  }

  // For WhatsApp, require a phone number
  if (platform === "whatsapp") {
    const phoneNumber = body.phoneNumber?.trim();
    if (!phoneNumber) {
      return NextResponse.json(
        { error: "Phone number is required for WhatsApp" },
        { status: 400 }
      );
    }

    // Basic phone number validation: digits only (after stripping non-digits), at least 7 digits
    const digits = phoneNumber.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) {
      return NextResponse.json(
        { error: "Please enter a valid phone number with country code (e.g. +1234567890)" },
        { status: 400 }
      );
    }

    try {
      const code = await generateLinkCode(userId, "whatsapp");
      // Send verification code via WhatsApp template message
      await sendWhatsAppVerificationCode(digits, code);
      return NextResponse.json({ code, sent: true });
    } catch (e) {
      console.error("[link-code] WhatsApp generate/send failed:", e);
      const errMsg = e instanceof Error ? e.message : "Unknown error";

      let userError = "Failed to generate link code";
      if (errMsg.includes("WHATSAPP_VERIFICATION_TEMPLATE not set")) {
        userError = "WhatsApp verification is not configured. Please contact support.";
      } else if (errMsg.includes("sendMessage failed")) {
        userError = "Failed to send WhatsApp message. Please check the phone number and try again.";
      }

      return NextResponse.json({ error: userError }, { status: 500 });
    }
  }

  // For Telegram (and future platforms), generate code only
  try {
    const code = await generateLinkCode(userId, platform as "whatsapp" | "telegram");
    return NextResponse.json({ code });
  } catch (e) {
    console.error("[link-code] generate failed:", e);
    return NextResponse.json(
      { error: "Failed to generate link code" },
      { status: 500 }
    );
  }
}

// Export with stricter rate limiting for auth-related endpoint (10 req/min)
export const POST = withRateLimit(handlePost, { type: "auth" });
