/**
 * Shared WhatsApp Cloud API utilities.
 * Sends messages via the WhatsApp Business API.
 *
 * NOTE: Sending freeform text messages to users requires an open 24-hour
 * conversation window (i.e. the user must have messaged you first).
 * For business-initiated messages (like verification codes), you MUST use
 * an approved message template.
 */

const GRAPH_API = "https://graph.facebook.com/v21.0";

/**
 * Send a plain text WhatsApp message to a phone number.
 * Only works within a 24-hour window after the user messages you.
 */
export async function sendWhatsAppMessage(
  to: string,
  text: string
): Promise<void> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token) throw new Error("WHATSAPP_ACCESS_TOKEN not set");
  if (!phoneNumberId) throw new Error("WHATSAPP_PHONE_NUMBER_ID not set");

  const url = `${GRAPH_API}/${phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to.replace(/\D/g, ""),
      type: "text",
      text: { body: text },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WhatsApp sendMessage failed: ${res.status} ${err}`);
  }
}

/**
 * Send a WhatsApp verification code via an approved message template.
 * Templates can initiate conversations without a prior 24-hour window.
 *
 * Requires WHATSAPP_VERIFICATION_TEMPLATE env var set to the template name
 * created in Meta Business Manager. The template must have:
 *   - Body with one parameter ({{1}}) for the verification code
 *   - A Quick Reply button (e.g. "Connect Account")
 *
 * When the user taps the button, the payload "LINK <code>" is sent back
 * automatically, triggering the account linking flow.
 *
 * Example template body:
 *   "Your MemoBot verification code is {{1}}. Tap the button below or
 *    reply with LINK {{1}} to connect your account. This code expires in 10 minutes."
 */
export async function sendWhatsAppVerificationCode(
  phoneNumber: string,
  code: string
): Promise<void> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const templateName = process.env.WHATSAPP_VERIFICATION_TEMPLATE;

  if (!token) throw new Error("WHATSAPP_ACCESS_TOKEN not set");
  if (!phoneNumberId) throw new Error("WHATSAPP_PHONE_NUMBER_ID not set");
  if (!templateName) throw new Error("WHATSAPP_VERIFICATION_TEMPLATE not set");

  const url = `${GRAPH_API}/${phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phoneNumber.replace(/\D/g, ""),
      type: "template",
      template: {
        name: templateName,
        language: { code: "en_US" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: code },
            ],
          },
          {
            type: "button",
            sub_type: "quick_reply",
            index: 0,
            parameters: [
              { type: "payload", payload: `LINK ${code}` },
            ],
          },
        ],
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[WhatsApp] Template message failed: ${res.status} ${err}`);
    throw new Error(`WhatsApp sendMessage failed: ${res.status} ${err}`);
  }

  console.log(`[WhatsApp] Verification template sent to ${phoneNumber.slice(-4).padStart(phoneNumber.length, '*')}`);
}
