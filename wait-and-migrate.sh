#!/bin/bash

# Wait for Render deployment and trigger migration
# This script polls the endpoint until it's available, then runs the migration

echo "🔍 Checking if Render deployment is complete..."
echo ""

MAX_ATTEMPTS=20
ATTEMPT=0
SLEEP_TIME=30

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  ATTEMPT=$((ATTEMPT + 1))
  echo "Attempt $ATTEMPT/$MAX_ATTEMPTS..."

  # Try to hit the migration endpoint
  RESPONSE=$(curl -s -X POST https://dexkeeta.onrender.com/api/admin/migrate-snapshots \
    -H "Content-Type: application/json" \
    -w "\n%{http_code}")

  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" = "200" ]; then
    echo ""
    echo "✅ Migration endpoint is live!"
    echo ""
    echo "Response:"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    echo ""
    echo "🎉 Migration complete! Now recording initial snapshot..."
    echo ""

    # Record first snapshot
    SNAPSHOT_RESPONSE=$(curl -s -X POST https://dexkeeta.onrender.com/api/admin/record-snapshots \
      -H "Content-Type: application/json")

    echo "Snapshot Response:"
    echo "$SNAPSHOT_RESPONSE" | jq '.' 2>/dev/null || echo "$SNAPSHOT_RESPONSE"
    echo ""
    echo "✅ All done! APY tracking is now active."
    echo "   (Note: APY will show 0% until 24h of data is collected)"
    exit 0
  elif [ "$HTTP_CODE" = "404" ] || [ "$HTTP_CODE" = "000" ]; then
    echo "   Still deploying (endpoint not found)..."
  else
    echo "   Got HTTP $HTTP_CODE - deployment may still be in progress"
  fi

  if [ $ATTEMPT -lt $MAX_ATTEMPTS ]; then
    echo "   Waiting ${SLEEP_TIME}s before next attempt..."
    sleep $SLEEP_TIME
  fi
done

echo ""
echo "❌ Deployment did not complete within expected time."
echo "   Please check Render dashboard: https://dashboard.render.com"
echo "   Then manually run:"
echo "   curl -X POST https://dexkeeta.onrender.com/api/admin/migrate-snapshots"
exit 1
