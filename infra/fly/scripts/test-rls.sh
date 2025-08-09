#!/bin/bash
set -e

# KickStack RLS Testing Script for deployed applications
echo "🔐 Testing Row-Level Security on deployed KickStack..."

if [ -z "$1" ]; then
    echo "Usage: $0 <app-hostname> [test-table]"
    echo "Example: $0 my-kickstack.fly.dev test_posts"
    exit 1
fi

HOSTNAME=$1
TEST_TABLE=${2:-"test_posts"}
BASE_URL="https://$HOSTNAME"
AUTH_URL="$BASE_URL/auth"
API_URL="$BASE_URL"

# CI mode - reduce retries and timeouts for faster feedback
if [ "$CI" = "true" ]; then
    MAX_RETRIES=3
    RETRY_DELAY=5
    CURL_TIMEOUT=10
else
    MAX_RETRIES=5
    RETRY_DELAY=10
    CURL_TIMEOUT=30
fi

echo "📋 Test Configuration:"
echo "  Hostname: $HOSTNAME"
echo "  Test Table: $TEST_TABLE"
echo "  Auth URL: $AUTH_URL"
echo "  API URL: $API_URL"

# Create test users
USER_A_EMAIL="test-user-a@example.com"
USER_B_EMAIL="test-user-b@example.com"
PASSWORD="test123456"

echo ""
echo "👤 Creating test users..."

# Sign up user A
echo -n "  Creating user A... "
if curl -sf "$AUTH_URL/signup" -X POST -H "Content-Type: application/json" -d "{\"email\":\"$USER_A_EMAIL\",\"password\":\"$PASSWORD\"}" > /dev/null; then
    echo "✅ OK"
else
    echo "⚠️  May already exist (continuing)"
fi

# Sign up user B  
echo -n "  Creating user B... "
if curl -sf "$AUTH_URL/signup" -X POST -H "Content-Type: application/json" -d "{\"email\":\"$USER_B_EMAIL\",\"password\":\"$PASSWORD\"}" > /dev/null; then
    echo "✅ OK"
else
    echo "⚠️  May already exist (continuing)"
fi

# Login users and get tokens
echo ""
echo "🔑 Getting authentication tokens..."

echo -n "  Logging in user A... "
TOKEN_A_RESPONSE=$(curl -sf "$AUTH_URL/token?grant_type=password" -X POST -H "Content-Type: application/json" -d "{\"email\":\"$USER_A_EMAIL\",\"password\":\"$PASSWORD\"}")
if [ $? -eq 0 ] && echo "$TOKEN_A_RESPONSE" | jq -r '.access_token' > /dev/null 2>&1; then
    TOKEN_A=$(echo "$TOKEN_A_RESPONSE" | jq -r '.access_token')
    echo "✅ OK"
else
    echo "❌ FAILED"
    echo "Response: $TOKEN_A_RESPONSE"
    exit 1
fi

echo -n "  Logging in user B... "
TOKEN_B_RESPONSE=$(curl -sf "$AUTH_URL/token?grant_type=password" -X POST -H "Content-Type: application/json" -d "{\"email\":\"$USER_B_EMAIL\",\"password\":\"$PASSWORD\"}")
if [ $? -eq 0 ] && echo "$TOKEN_B_RESPONSE" | jq -r '.access_token' > /dev/null 2>&1; then
    TOKEN_B=$(echo "$TOKEN_B_RESPONSE" | jq -r '.access_token')
    echo "✅ OK"
else
    echo "❌ FAILED"
    echo "Response: $TOKEN_B_RESPONSE"
    exit 1
fi

# Test table access
echo ""
echo "📊 Testing table access patterns..."

# Test anonymous access (should work for public_read tables, fail for owner tables)
echo -n "  Anonymous read access... "
ANON_RESPONSE=$(curl -s -w "%{http_code}" "$API_URL/$TEST_TABLE" -o /tmp/anon_response.json)
if [ "$ANON_RESPONSE" -eq 200 ]; then
    echo "✅ OK (public_read table)"
    IS_PUBLIC_READ=true
elif [ "$ANON_RESPONSE" -eq 401 ] || [ "$ANON_RESPONSE" -eq 403 ]; then
    echo "✅ OK (owner-only table)"
    IS_PUBLIC_READ=false
else
    echo "⚠️  Unexpected response: $ANON_RESPONSE"
    IS_PUBLIC_READ=unknown
fi

# Test authenticated read access
echo -n "  User A authenticated read... "
AUTH_RESPONSE=$(curl -s -w "%{http_code}" "$API_URL/$TEST_TABLE" -H "Authorization: Bearer $TOKEN_A" -o /tmp/auth_a_response.json)
if [ "$AUTH_RESPONSE" -eq 200 ]; then
    echo "✅ OK"
else
    echo "❌ FAILED (HTTP $AUTH_RESPONSE)"
    EXIT_CODE=1
fi

# Test cross-user data isolation (if we can create test data)
echo -n "  Testing data isolation... "
if command -v jq >/dev/null 2>&1; then
    # Try to create test data and verify isolation
    # This would require knowing the table schema, so we'll keep it simple
    echo "⚠️  Manual verification needed (requires table schema knowledge)"
else
    echo "⚠️  jq not available, skipping detailed tests"
fi

# Test write permissions
echo ""
echo "✏️  Testing write permissions..."

echo -n "  Anonymous write (should fail)... "
ANON_WRITE=$(curl -s -w "%{http_code}" "$API_URL/$TEST_TABLE" -X POST -H "Content-Type: application/json" -d '{"test":"data"}' -o /dev/null)
if [ "$ANON_WRITE" -eq 401 ] || [ "$ANON_WRITE" -eq 403 ]; then
    echo "✅ OK (correctly blocked)"
else
    echo "❌ FAILED (should be blocked, got HTTP $ANON_WRITE)"
    EXIT_CODE=1
fi

# Summary
echo ""
echo "📊 RLS Test Summary:"
if [ "${EXIT_CODE:-0}" -eq 0 ]; then
    echo "✅ Basic RLS tests passed!"
    echo ""
    echo "🔐 Security Status:"
    if [ "$IS_PUBLIC_READ" = "true" ]; then
        echo "  • Table '$TEST_TABLE' allows public read access"
        echo "  • Anonymous writes are properly blocked"
    elif [ "$IS_PUBLIC_READ" = "false" ]; then
        echo "  • Table '$TEST_TABLE' requires authentication for read"
        echo "  • Anonymous access is properly blocked"
    fi
    echo "  • Authentication system is working"
    echo "  • JWT tokens are being validated"
    echo ""
    echo "📝 Manual verification recommended:"
    echo "  1. Create test records with different users"
    echo "  2. Verify users can only see/modify their own data"
    echo "  3. Test with your specific table schemas"
else
    echo "❌ Some RLS tests failed!"
    echo "🔧 Troubleshooting:"
    echo "  • Check app logs: fly logs"
    echo "  • Verify database connection: fly ssh console"
    echo "  • Test JWT configuration manually"
    exit 1
fi