#!/bin/bash
set -e

# Set your project ID and region
PROJECT_ID="medicap-455306"
REGION="us-central1"
IMAGE_NAME="medical-consultation-backend"

echo "Building Docker image locally..."
docker build -t "$IMAGE_NAME" .

echo "Tagging image for Google Container Registry..."
docker tag "$IMAGE_NAME" "gcr.io/$PROJECT_ID/$IMAGE_NAME"

echo "Authenticating with Google Cloud..."
gcloud auth configure-docker

echo "Pushing image to Google Container Registry..."
docker push "gcr.io/$PROJECT_ID/$IMAGE_NAME"

echo "Deploying to Cloud Run..."
gcloud run deploy "$IMAGE_NAME" \
  --image "gcr.io/$PROJECT_ID/$IMAGE_NAME" \
  --platform managed \
  --allow-unauthenticated \
  --port=8080 \
  --memory=512Mi \
  --cpu=1 \
  --timeout=3600 \
  --set-env-vars="$(grep -v '^#' .env.cloud | xargs)" \
  --update-env-vars="DEBUG=False" \
  --session-affinity \
  --min-instances=0 \
  --max-instances=10 \
  --region="$REGION"

echo "Deployment completed! Your service URL will be shown above." 