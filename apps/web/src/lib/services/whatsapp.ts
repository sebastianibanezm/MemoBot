/**
 * Shared WhatsApp Cloud API utilities.
 * Sends messages via the WhatsApp Business API.
 */

const GRAPH_API = "https://graph.facebook.com/v21.0";

/**
 * Send a plain text WhatsApp message to a phone number.
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
 * Send a WhatsApp verification code message for account linking.
 */
export async function sendWhatsAppVerificationCode(
  phoneNumber: string,
  code: string
): Promise<void> {
  const message =
    `*MemoBot Account Verification*\n\n` +
    `Your verification code is: *${code}*\n\n` +
    `Reply to this message with:\nLINK ${code}\n\n` +
    `This code expires in 10 minutes.`;

  await sendWhatsAppMessage(phoneNumber, message);
}
