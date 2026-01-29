#!/bin/bash
set -e

echo "Updating Cloud Run service to LIVE MODE..."
echo ""

# This will auto-open browser for auth if needed
gcloud run services update lhc-api \
  --region us-central1 \
  --project lhc-terminal-alpha-1768620729 \
  --update-env-vars="DRY_RUN=false,MIN_PROFIT_USD=2,FLASH_ARB_CONTRACT_ADDRESS=0x8df331d5f493fe065692f97a349cfe8c6941bcea"

echo ""
echo "✅ DONE! Bot is now in LIVE MODE"
echo ""
echo "Monitor: https://lhc-web-29418249188.us-central1.run.app"
