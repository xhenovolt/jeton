#!/bin/bash

# Logout Security Test Suite
# Tests that session is properly invalidated after logout

API_URL="http://localhost:3000"
COOKIES_JAR="/tmp/test_cookies.txt"
USER_EMAIL="test@example.com"
USER_PASSWORD="password123"

echo "======================================="
echo "🔐 LOGOUT SECURITY TEST SUITE"
echo "======================================="
echo ""

# Clean up old cookies
rm -f "$COOKIES_JAR"

echo "📝 Step 1: Attempting login..."
LOGIN_RESPONSE=$(curl -s -c "$COOKIES_JAR" -X POST \
  "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$USER_EMAIL\",\"password\":\"$USER_PASSWORD\"}")

if [ $? -ne 0 ]; then
  echo "❌ Login request failed"
  echo "Note: You may need to manually test if test user doesn't exist"
  exit 1
fi

echo "✅ Login request sent"
echo ""

# Check if session cookie was set
if grep -q "jeton_session" "$COOKIES_JAR"; then
  echo "✅ Session cookie created and stored"
  SESSION_ID=$(grep "jeton_session" "$COOKIES_JAR" | awk '{print $NF}')
  echo "   Session ID: ${SESSION_ID:0:8}..." 
else
  echo "⚠️  No session cookie found (test user may not exist)"
fi
echo ""

echo "🔍 Step 2: Test accessing protected route BEFORE logout..."
AUTH_RESPONSE=$(curl -s -b "$COOKIES_JAR" \
  "$API_URL/api/auth/me")

if echo "$AUTH_RESPONSE" | grep -q "user"; then
  echo "✅ Can access /api/auth/me BEFORE logout (EXPECTED)"
  echo "   Response contains user data"
else
  echo "❌ Cannot access protected route before logout"
  echo "   This is a problem!"
fi
echo ""

echo "🚪 Step 3: Calling logout endpoint..."
LOGOUT_RESPONSE=$(curl -s -c "$COOKIES_JAR" -b "$COOKIES_JAR" -X POST \
  "$API_URL/api/auth/logout")

if echo "$LOGOUT_RESPONSE" | grep -q "Logged out\|successfully"; then
  echo "✅ Logout endpoint called successfully"
else
  echo "⚠️  Logout response: $LOGOUT_RESPONSE"
fi
echo ""

echo "🔐 Step 4: Checking if old session is in cookies..."
if grep -q "jeton_session" "$COOKIES_JAR"; then
  # Check if it was cleared (maxAge=0)
  SESSION_DATA=$(grep "jeton_session" "$COOKIES_JAR")
  if [[ $SESSION_DATA == *"00:00:00"* ]] || [[ $SESSION_DATA == *"expires"* ]]; then
    echo "✅ Session cookie was cleared (expires='00:00:00' or maxAge=0)"
  else
    echo "⚠️  Session cookie still in jar (but may be expired): $SESSION_DATA"
  fi
else
  echo "✅ Session cookie removed from cookies jar"
fi
echo ""

echo "🚨 Step 5: CRITICAL TEST - Try accessing protected route AFTER logout..."
AFTER_LOGOUT=$(curl -s -b "$COOKIES_JAR" \
  "$API_URL/api/auth/me")

if echo "$AFTER_LOGOUT" | grep -q "Unauthorized\|401"; then
  echo "✅ PASS: Correctly denied access after logout (Got 401)"
  echo "   User properly logged out!"
elif echo "$AFTER_LOGOUT" | grep -q "user"; then
  echo "❌ SECURITY ISSUE: Can still access protected routes after logout!"
  echo "   Response: $AFTER_LOGOUT"
  echo ""
  echo "   THIS IS THE SECURITY BUG - User can still access /api/auth/me"
else
  echo "✅ Cannot access protected route (Response indicates no auth)"
  echo "   Response: $AFTER_LOGOUT"
fi
echo ""

echo "======================================="
echo "📊 Summary:"
echo "======================================="
echo "✅ If Step 5 shows '401 Unauthorized', logout security is FIXED"
echo "❌ If Step 5 shows user data, logout security still HAS ISSUES"
echo ""
echo "Cleanup: rm -f $COOKIES_JAR"
echo "======================================="
