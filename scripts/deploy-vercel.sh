#!/bin/bash
# ============================================================
# MemoBot Vercel Deployment Script
# ============================================================
# This script deploys MemoBot to Vercel production
# 
# Prerequisites:
#   1. Vercel CLI: npm i -g vercel
#   2. Vercel Token: Get from https://vercel.com/account/tokens
#   3. Set: export VERCEL_TOKEN=your_token
#
# Usage:
#   ./scripts/deploy-vercel.sh
# ============================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}MemoBot Vercel Deployment${NC}"
echo -e "${GREEN}============================================================${NC}"

# Check Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo -e "${RED}Error: Vercel CLI not installed${NC}"
    echo "Install with: npm i -g vercel"
    exit 1
fi

# Check for token
if [ -z "$VERCEL_TOKEN" ]; then
    echo -e "${RED}Error: VERCEL_TOKEN is not set${NC}"
    echo ""
    echo "Get a token from: https://vercel.com/account/tokens"
    echo "Then run: export VERCEL_TOKEN=your_token"
    exit 1
fi

# Navigate to web app directory
cd "$(dirname "$0")/../apps/web"

echo ""
echo -e "${GREEN}[1/4] Linking project to Vercel...${NC}"
vercel link --yes --token "$VERCEL_TOKEN"

echo ""
echo -e "${GREEN}[2/4] Setting environment variables...${NC}"

# Load environment variables from .env.local if present
if [ -f ".env.local" ]; then
    echo "Loading variables from .env.local..."
    while IFS='=' read -r key value; do
        # Skip comments and empty lines
        [[ "$key" =~ ^#.*$ ]] && continue
        [[ -z "$key" ]] && continue
        
        # Remove quotes from value
        value="${value%\"}"
        value="${value#\"}"
        value="${value%\'}"
        value="${value#\'}"
        
        if [[ -n "$key" && -n "$value" ]]; then
            echo "  Setting $key..."
            echo "$value" | vercel env add "$key" production --token "$VERCEL_TOKEN" 2>/dev/null || true
        fi
    done < .env.local
fi

echo ""
echo -e "${GREEN}[3/4] Deploying to production...${NC}"
vercel --prod --token "$VERCEL_TOKEN"

echo ""
echo -e "${GREEN}[4/4] Getting deployment info...${NC}"
vercel ls --token "$VERCEL_TOKEN" | head -5

echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Add custom domain in Vercel Dashboard"
echo "  2. Configure DNS at your registrar"
echo "  3. Run: ./scripts/setup-production-webhooks.sh"
echo ""
