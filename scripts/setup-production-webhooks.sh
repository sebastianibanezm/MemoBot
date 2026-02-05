#!/bin/bash
# ============================================================
# MemoBot Production Webhook Setup Script
# ============================================================
# Run this script after Vercel deployment is complete
# It sets up Telegram and verifies WhatsApp webhook configuration
# ============================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}MemoBot Production Webhook Setup${NC}"
echo -e "${GREEN}============================================================${NC}"

# Check for required environment variables
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
    echo -e "${RED}Error: TELEGRAM_BOT_TOKEN is not set${NC}"
    echo "Export it first: export TELEGRAM_BOT_TOKEN=your_token"
    exit 1
fi

if [ -z "$TELEGRAM_WEBHOOK_SECRET" ]; then
    echo -e "${RED}Error: TELEGRAM_WEBHOOK_SECRET is not set${NC}"
    echo "Export it first: export TELEGRAM_WEBHOOK_SECRET=your_secret"
    exit 1
fi

# Default production URL
PRODUCTION_URL="${PRODUCTION_URL:-https://www.memo-bot.com}"

echo ""
echo -e "${YELLOW}Using production URL: $PRODUCTION_URL${NC}"
echo ""

# ============================================================
# Phase 1: Verify Health Endpoint
# ============================================================
echo -e "${GREEN}[1/4] Checking health endpoint...${NC}"
HEALTH_RESPONSE=$(curl -s "$PRODUCTION_URL/api/health" || echo "FAILED")

if echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"'; then
    echo -e "${GREEN}✓ Health check passed${NC}"
    echo "  Response: $HEALTH_RESPONSE"
else
    echo -e "${RED}✗ Health check failed${NC}"
    echo "  Response: $HEALTH_RESPONSE"
    echo "  Make sure the app is deployed to $PRODUCTION_URL"
    exit 1
fi

# ============================================================
# Phase 2: Set Telegram Webhook
# ============================================================
echo ""
echo -e "${GREEN}[2/4] Setting Telegram webhook...${NC}"

TELEGRAM_WEBHOOK_URL="$PRODUCTION_URL/api/webhook/telegram"
echo "  Webhook URL: $TELEGRAM_WEBHOOK_URL"

TELEGRAM_RESPONSE=$(curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"$TELEGRAM_WEBHOOK_URL\",
    \"secret_token\": \"$TELEGRAM_WEBHOOK_SECRET\",
    \"allowed_updates\": [\"message\", \"callback_query\"]
  }")

if echo "$TELEGRAM_RESPONSE" | grep -q '"ok":true'; then
    echo -e "${GREEN}✓ Telegram webhook set successfully${NC}"
else
    echo -e "${RED}✗ Failed to set Telegram webhook${NC}"
    echo "  Response: $TELEGRAM_RESPONSE"
fi

# ============================================================
# Phase 3: Verify Telegram Webhook
# ============================================================
echo ""
echo -e "${GREEN}[3/4] Verifying Telegram webhook...${NC}"

WEBHOOK_INFO=$(curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo")

if echo "$WEBHOOK_INFO" | grep -q "$TELEGRAM_WEBHOOK_URL"; then
    echo -e "${GREEN}✓ Telegram webhook verified${NC}"
    echo "  Webhook Info:"
    echo "$WEBHOOK_INFO" | python3 -m json.tool 2>/dev/null || echo "$WEBHOOK_INFO"
else
    echo -e "${YELLOW}⚠ Webhook URL mismatch${NC}"
    echo "$WEBHOOK_INFO" | python3 -m json.tool 2>/dev/null || echo "$WEBHOOK_INFO"
fi

# ============================================================
# Phase 4: WhatsApp Webhook Instructions
# ============================================================
echo ""
echo -e "${GREEN}[4/4] WhatsApp Webhook Configuration${NC}"
echo -e "${YELLOW}WhatsApp webhook must be configured manually in Meta Developer Console:${NC}"
echo ""
echo "  1. Go to: https://developers.facebook.com/apps/"
echo "  2. Select your WhatsApp Business app"
echo "  3. Navigate to: WhatsApp → Configuration"
echo "  4. In Webhooks section, set:"
echo "     - Callback URL: $PRODUCTION_URL/api/webhook/whatsapp"
echo "     - Verify Token: \$WHATSAPP_VERIFY_TOKEN"
echo "  5. Subscribe to 'messages' field"
echo ""

# ============================================================
# Summary
# ============================================================
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Configure WhatsApp webhook in Meta Developer Console (see above)"
echo "  2. Test Telegram by sending a message to your bot"
echo "  3. Test account linking from the web dashboard"
echo "  4. Verify Stripe webhook at https://dashboard.stripe.com/webhooks"
echo ""
echo -e "${GREEN}Production URL: $PRODUCTION_URL${NC}"
echo ""
