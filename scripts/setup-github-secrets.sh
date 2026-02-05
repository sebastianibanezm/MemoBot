#!/bin/bash
# ============================================================
# MemoBot GitHub Secrets Setup Script
# ============================================================
# This script helps you set up GitHub Actions secrets for CI/CD
# Requires: GitHub CLI (gh) authenticated
# ============================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}MemoBot GitHub Secrets Setup${NC}"
echo -e "${GREEN}============================================================${NC}"

# Check if gh is installed and authenticated
if ! command -v gh &> /dev/null; then
    echo -e "${RED}Error: GitHub CLI (gh) is not installed${NC}"
    echo "Install it from: https://cli.github.com/"
    exit 1
fi

if ! gh auth status &> /dev/null; then
    echo -e "${RED}Error: GitHub CLI is not authenticated${NC}"
    echo "Run: gh auth login"
    exit 1
fi

# Get repository info
REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner' 2>/dev/null)
if [ -z "$REPO" ]; then
    echo -e "${RED}Error: Not in a GitHub repository${NC}"
    exit 1
fi

echo -e "${GREEN}Repository: $REPO${NC}"
echo ""

# Function to set a secret
set_secret() {
    local name=$1
    local value=$2
    
    if [ -z "$value" ]; then
        echo -e "${YELLOW}Skipping $name (no value provided)${NC}"
        return
    fi
    
    echo -n "Setting $name... "
    if echo "$value" | gh secret set "$name" --repo "$REPO" 2>/dev/null; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗${NC}"
    fi
}

# ============================================================
# Required Secrets for CI/CD
# ============================================================

echo -e "${YELLOW}These secrets are required for GitHub Actions to run builds:${NC}"
echo ""
echo "You can provide values interactively or set environment variables:"
echo "  export GH_CLERK_PK=pk_test_..."
echo "  export GH_CLERK_SK=sk_test_..."
echo "  etc."
echo ""

# Clerk
read -p "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY [${GH_CLERK_PK:-empty}]: " CLERK_PK_INPUT
CLERK_PK="${CLERK_PK_INPUT:-$GH_CLERK_PK}"

read -p "CLERK_SECRET_KEY [${GH_CLERK_SK:-empty}]: " CLERK_SK_INPUT
CLERK_SK="${CLERK_SK_INPUT:-$GH_CLERK_SK}"

# Supabase
read -p "NEXT_PUBLIC_SUPABASE_URL [${GH_SUPABASE_URL:-empty}]: " SUPABASE_URL_INPUT
SUPABASE_URL="${SUPABASE_URL_INPUT:-$GH_SUPABASE_URL}"

read -p "NEXT_PUBLIC_SUPABASE_ANON_KEY [${GH_SUPABASE_ANON:-empty}]: " SUPABASE_ANON_INPUT
SUPABASE_ANON="${SUPABASE_ANON_INPUT:-$GH_SUPABASE_ANON}"

read -p "SUPABASE_SERVICE_ROLE_KEY [${GH_SUPABASE_SERVICE:-empty}]: " SUPABASE_SERVICE_INPUT
SUPABASE_SERVICE="${SUPABASE_SERVICE_INPUT:-$GH_SUPABASE_SERVICE}"

# AI Keys
read -p "OPENAI_API_KEY [${GH_OPENAI_KEY:-empty}]: " OPENAI_INPUT
OPENAI_KEY="${OPENAI_INPUT:-$GH_OPENAI_KEY}"

read -p "ANTHROPIC_API_KEY [${GH_ANTHROPIC_KEY:-empty}]: " ANTHROPIC_INPUT
ANTHROPIC_KEY="${ANTHROPIC_INPUT:-$GH_ANTHROPIC_KEY}"

# Webhook Secrets
read -p "TELEGRAM_WEBHOOK_SECRET [${GH_TG_SECRET:-empty}]: " TG_SECRET_INPUT
TG_SECRET="${TG_SECRET_INPUT:-$GH_TG_SECRET}"

read -p "WHATSAPP_VERIFY_TOKEN [${GH_WA_VERIFY:-empty}]: " WA_VERIFY_INPUT
WA_VERIFY="${WA_VERIFY_INPUT:-$GH_WA_VERIFY}"

read -p "WHATSAPP_APP_SECRET [${GH_WA_SECRET:-empty}]: " WA_SECRET_INPUT
WA_SECRET="${WA_SECRET_INPUT:-$GH_WA_SECRET}"

echo ""
echo -e "${GREEN}Setting secrets...${NC}"
echo ""

# Set all secrets
set_secret "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" "$CLERK_PK"
set_secret "CLERK_SECRET_KEY" "$CLERK_SK"
set_secret "NEXT_PUBLIC_SUPABASE_URL" "$SUPABASE_URL"
set_secret "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$SUPABASE_ANON"
set_secret "SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_SERVICE"
set_secret "OPENAI_API_KEY" "$OPENAI_KEY"
set_secret "ANTHROPIC_API_KEY" "$ANTHROPIC_KEY"
set_secret "TELEGRAM_WEBHOOK_SECRET" "$TG_SECRET"
set_secret "WHATSAPP_VERIFY_TOKEN" "$WA_VERIFY"
set_secret "WHATSAPP_APP_SECRET" "$WA_SECRET"

echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}Done!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo "Secrets have been configured for repository: $REPO"
echo ""
echo "You can verify secrets at:"
echo "  https://github.com/$REPO/settings/secrets/actions"
echo ""
echo "To list current secrets:"
echo "  gh secret list --repo $REPO"
echo ""
