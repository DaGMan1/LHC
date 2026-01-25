#!/bin/bash

# LHC-1 Alpha Core - Google Cloud Run Deployment
# Usage: ./deploy.sh <GCP_PROJECT_ID>

set -e

PROJECT_ID=$1
REGION="us-central1"
REPO_NAME="alpha-core"

if [ -z "$PROJECT_ID" ]; then
    echo "Usage: ./deploy.sh <GCP_PROJECT_ID>"
    echo "Example: ./deploy.sh lhc-alpha-core"
    exit 1
fi

echo "========================================"
echo "🚀 LHC-1 Alpha Core Deployment"
echo "========================================"
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo ""

# Enable services
echo "🔧 Enabling Google Cloud services..."
gcloud services enable \
    artifactregistry.googleapis.com \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    secretmanager.googleapis.com \
    --project $PROJECT_ID

# Create Artifact Registry repository if it doesn't exist
echo "📦 Setting up Artifact Registry..."
gcloud artifacts repositories describe $REPO_NAME --location=$REGION --project=$PROJECT_ID > /dev/null 2>&1 || \
    gcloud artifacts repositories create $REPO_NAME \
        --repository-format=docker \
        --location=$REGION \
        --project=$PROJECT_ID

# Configure Docker authentication
gcloud auth configure-docker $REGION-docker.pkg.dev --quiet

# ============================================
# SECRET MANAGER - Store BOT_PRIVATE_KEY securely
# ============================================
echo "🔐 Setting up Secret Manager..."

# Check if secret exists, if not create it
SECRET_NAME="lhc-bot-private-key"
if ! gcloud secrets describe $SECRET_NAME --project=$PROJECT_ID > /dev/null 2>&1; then
    echo "Creating secret $SECRET_NAME..."

    # Read from .env or prompt
    if [ -f .env ]; then
        BOT_KEY=$(grep "^BOT_PRIVATE_KEY=" .env | cut -d'=' -f2)
    fi

    if [ -z "$BOT_KEY" ]; then
        echo "Enter your BOT_PRIVATE_KEY (hot wallet for gas fees):"
        read -s BOT_KEY
    fi

    echo -n "$BOT_KEY" | gcloud secrets create $SECRET_NAME \
        --data-file=- \
        --project=$PROJECT_ID

    echo "✅ Secret created"
else
    echo "✅ Secret already exists"
fi

# Grant Cloud Run access to the secret
echo "Granting Cloud Run access to secret..."
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
gcloud secrets add-iam-policy-binding $SECRET_NAME \
    --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor" \
    --project=$PROJECT_ID --quiet

# ============================================
# BUILD API
# ============================================
echo ""
echo "🔨 Building API..."
API_IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/api:latest"
gcloud builds submit . \
    --config cloudbuild-api.yaml \
    --substitutions=_IMAGE_NAME=$API_IMAGE \
    --project $PROJECT_ID

# ============================================
# BUILD WEB
# ============================================
echo ""
echo "🔨 Building Web..."
WEB_IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/web:latest"
gcloud builds submit . \
    --config cloudbuild-web.yaml \
    --substitutions=_IMAGE_NAME=$WEB_IMAGE \
    --project $PROJECT_ID

# ============================================
# DEPLOY API
# ============================================
echo ""
echo "🚀 Deploying API to Cloud Run..."
gcloud run deploy lhc-api \
    --image $API_IMAGE \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --project $PROJECT_ID \
    --port 3001 \
    --memory 512Mi \
    --cpu 1 \
    --min-instances 1 \
    --max-instances 3 \
    --set-env-vars="NODE_ENV=production,BASE_RPC_URL=https://mainnet.base.org,DRY_RUN=true,MIN_PROFIT_USD=5,MAX_GAS_PRICE_GWEI=0.1,MAX_FLASH_LOAN_USD=10000" \
    --set-secrets="BOT_PRIVATE_KEY=$SECRET_NAME:latest"

# Get API URL
API_URL=$(gcloud run services describe lhc-api --platform managed --region $REGION --project $PROJECT_ID --format 'value(status.url)')
echo "✅ API deployed: $API_URL"

# ============================================
# DEPLOY WEB
# ============================================
echo ""
echo "🚀 Deploying Web to Cloud Run..."
gcloud run deploy lhc-web \
    --image $WEB_IMAGE \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --project $PROJECT_ID \
    --port 3000 \
    --memory 512Mi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 3 \
    --set-env-vars="NEXT_PUBLIC_API_URL=$API_URL,NODE_ENV=production"

WEB_URL=$(gcloud run services describe lhc-web --platform managed --region $REGION --project $PROJECT_ID --format 'value(status.url)')

# ============================================
# DONE
# ============================================
echo ""
echo "========================================"
echo "✅ DEPLOYMENT COMPLETE!"
echo "========================================"
echo ""
echo "🌐 Web Dashboard: $WEB_URL"
echo "🔌 API Endpoint:  $API_URL"
echo ""
echo "📋 Next Steps:"
echo "1. Open $WEB_URL in your browser"
echo "2. Connect your MAIN MetaMask wallet (owner)"
echo "3. Deploy the FlashArb contract"
echo "4. Authorize the bot wallet as executor"
echo "5. Click GO LIVE!"
echo ""
echo "🤖 Bot Wallet: 0x273fdD310c80e95B92eA60Bf12A4391Ca2C3f640"
echo "   (This is your executor - can trigger trades but NOT withdraw)"
echo ""
echo "========================================"
