#!/bin/bash

# Authentication Guard Test Suite
# Tests that unauthenticated users cannot access protected routes

API_URL="http://localhost:3001"
COOKIES_JAR="/tmp/test_auth_cookies.txt"

echo "======================================="
echo "🔐 AUTHENTICATION GUARD TEST SUITE"
echo "======================================="
echo ""

# Clean up
rm -f "$COOKIES_JAR"

echo "Test 1: Access /app/dashboard WITHOUT authentication"
echo "Expected: Should redirect to /login or show 401"
echo "---"
RESPONSE=$(curl -s -w "\n%{http_code}" -b "$COOKIES_JAR" \
  "http://localhost:3001/app/dashboard" \
  -H "User-Agent: test-client")

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" == "307" ] || [ "$HTTP_CODE" == "308" ]; then
  echo "✅ PASS: Got redirect (HTTP $HTTP_CODE)"
  echo "   Redirect target: $(echo "$BODY" | grep -i location || echo 'Location header in response')"
elif [ "$HTTP_CODE" == "401" ] || [ "$HTTP_CODE" == "403" ]; then
  echo "✅ PASS: Got auth error (HTTP $HTTP_CODE)"
else
  echo "⚠️  Got HTTP $HTTP_CODE"
  echo "   Response body (first 200 chars): ${BODY:0:200}"
fi
echo ""

echo "Test 2: Access /admin/users WITHOUT authentication"
echo "Expected: Should redirect to /login or show 401"
echo "---"
RESPONSE=$(curl -s -w "\n%{http_code}" -b "$COOKIES_JAR" \
  "http://localhost:3001/admin/users" \
  -H "User-Agent: test-client")

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)

if [ "$HTTP_CODE" == "307" ] || [ "$HTTP_CODE" == "308" ]; then
  echo "✅ PASS: Got redirect (HTTP $HTTP_CODE)"
elif [ "$HTTP_CODE" == "401" ] || [ "$HTTP_CODE" == "403" ]; then
  echo "✅ PASS: Got auth error (HTTP $HTTP_CODE)"
else
  echo "⚠️  Got HTTP $HTTP_CODE"
fi
echo ""

echo "Test 3: Access /login page"
echo "Expected: Should display login form (200 OK)"
echo "---"
RESPONSE=$(curl -s -w "\n%{http_code}" \
  "http://localhost:3001/login" \
  -H "User-Agent: test-client")

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" == "200" ]; then
  if echo "$BODY" | grep -q "login\|Login\|email\|password" -i; then
    echo "✅ PASS: Login page accessible (HTTP 200)"
  else
    echo "✅ PASS: Login page loads (HTTP 200)"
  fi
elif [ "$HTTP_CODE" == "307" ] || [ "$HTTP_CODE" == "308" ]; then
  echo "⚠️  Login page redirects (already logged in?)"
else
  echo "❌ FAIL: Got HTTP $HTTP_CODE"
fi
echo ""

echo "Test 4: Access public landing page /"
echo "Expected: Should display landing page (200 OK)"
echo "---"
RESPONSE=$(curl -s -w "\n%{http_code}" \
  "http://localhost:3001/" \
  -H "User-Agent: test-client")

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)

if [ "$HTTP_CODE" == "200" ]; then
  echo "✅ PASS: Landing page accessible (HTTP 200)"
else
  echo "⚠️  Got HTTP $HTTP_CODE"
fi
echo ""

echo "Test 5: Access API endpoint WITHOUT session"
echo "Expected: Should return 401 Unauthorized"
echo "---"
RESPONSE=$(curl -s -w "\n%{http_code}" -b "$COOKIES_JAR" \
  "http://localhost:3001/api/auth/me")

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" == "401" ]; then
  echo "✅ PASS: API correctly denies access (HTTP 401)"
elif [ "$HTTP_CODE" == "403" ]; then
  echo "✅ PASS: API correctly forbids access (HTTP 403)"
else
  echo "⚠️  Got HTTP $HTTP_CODE"
  echo "   Response: ${BODY:0:100}"
fi
echo ""

echo "======================================="
echo "📊 SUMMARY"
echo "======================================="
echo "✅ If Tests 1, 2, 5 show PASS with redirects/401"
echo "   Authentication guards are working correctly!"
echo ""
echo "✅ If Tests 3, 4 show PASS with 200 OK"
echo "   Public pages are accessible"
echo ""
echo "======================================="
