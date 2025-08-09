#!/bin/bash
set -e

# KickStack Deployment Validation Script for Fly.io
echo "🔍 Validating KickStack deployment..."

# Support CI mode where hostname is provided as first argument
if [ -n "$1" ]; then
    HOSTNAME="$1"
    echo "📋 Using provided hostname: $HOSTNAME"
    BASE_URL="https://$HOSTNAME"
else
    # Get app info from flyctl (local mode)
    APP_INFO=$(flyctl status --json 2>/dev/null)
    if [ $? -ne 0 ]; then
        echo "❌ Failed to get app status. Are you in the right directory with fly.toml?"
        echo "💡 Usage: $0 [hostname] - provide hostname for CI mode"
        exit 1
    fi

    APP_NAME=$(echo $APP_INFO | jq -r '.Name')
    HOSTNAME=$(echo $APP_INFO | jq -r '.Hostname')
    STATUS=$(echo $APP_INFO | jq -r '.Status')
    
    echo "📋 App Details:"
    echo "  Name: $APP_NAME"
    echo "  Hostname: $HOSTNAME"
    echo "  Status: $STATUS"

    if [ "$STATUS" != "running" ]; then
        echo "❌ App is not running (status: $STATUS)"
        exit 1
    fi
    
    BASE_URL="https://$HOSTNAME"
fi

echo ""
echo "🔍 Testing endpoints..."

# Test health check
echo -n "  Health check... "
if curl -sf "$BASE_URL/health" > /dev/null; then
    echo "✅ OK"
else
    echo "❌ FAILED"
    EXIT_CODE=1
fi

# Test PostgREST API (anonymous access)
echo -n "  PostgREST API... "
if curl -sf "$BASE_URL/" -H "Accept: application/json" > /dev/null; then
    echo "✅ OK"
else
    echo "❌ FAILED"
    EXIT_CODE=1
fi

# Test GoTrue auth health
echo -n "  GoTrue Auth... "
if curl -sf "$BASE_URL/auth/health" > /dev/null; then
    echo "✅ OK"
else
    echo "❌ FAILED (auth may not have /health endpoint - checking signup instead)"
    # Try signup endpoint as alternative
    if curl -sf "$BASE_URL/auth/signup" -X POST -H "Content-Type: application/json" -d '{}' 2>/dev/null | grep -q "email"; then
        echo "✅ OK (via signup endpoint)"
    else
        echo "❌ FAILED"
        EXIT_CODE=1
    fi
fi

# Test Functions Gateway
echo -n "  Functions Gateway... "
if curl -sf "$BASE_URL/fn/health" > /dev/null || curl -sf "$BASE_URL/fn/hello" -X POST -H "Content-Type: application/json" -d '{"test":true}' > /dev/null; then
    echo "✅ OK"
else
    echo "❌ FAILED"
    EXIT_CODE=1
fi

# Test CORS headers
echo -n "  CORS headers... "
CORS_RESPONSE=$(curl -s -H "Origin: https://example.com" -H "Access-Control-Request-Method: GET" -H "Access-Control-Request-Headers: Authorization" -X OPTIONS "$BASE_URL/")
if echo "$CORS_RESPONSE" | grep -q "Access-Control-Allow-Origin"; then
    echo "✅ OK"
else
    echo "❌ FAILED"
    EXIT_CODE=1
fi

echo ""
echo "📊 Summary:"
if [ "${EXIT_CODE:-0}" -eq 0 ]; then
    echo "✅ All tests passed! Deployment looks healthy."
    echo ""
    echo "🌐 Your KickStack is available at:"
    echo "  Main API: $BASE_URL/"
    echo "  Auth: $BASE_URL/auth/"
    echo "  Functions: $BASE_URL/fn/"
    echo "  Health: $BASE_URL/health"
    echo ""
    echo "📖 Next steps:"
    echo "  1. Test with your own data/functions"
    echo "  2. Update your web app to use: $BASE_URL"
    echo "  3. Set up monitoring and alerts"
else
    echo "❌ Some tests failed. Check the logs:"
    echo "  fly logs"
    echo "  fly status"
    exit 1
fi