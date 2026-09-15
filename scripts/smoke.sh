#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
WS_URL="${BASE_URL/http/ws}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
STAMP="$(date +%s)$RANDOM"
PASS_COUNT=0

request() {
  local method="$1" path="$2" expected="$3" label="$4"
  shift 4
  local code
  code=$(curl -s -o "$WORK/body" -D "$WORK/headers" -w '%{http_code}' -X "$method" "$BASE_URL$path" "$@" || echo 000)
  if [ "$code" != "$expected" ]; then
    echo "FAIL [$label] expected $expected got $code: $(cat "$WORK/body" 2>/dev/null)"
    exit 1
  fi
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "ok   [$label] $code"
}

json() {
  node -e "const body = JSON.parse(require('fs').readFileSync('$WORK/body', 'utf8')); console.log($1)"
}

assert_json() {
  local expression="$1" expected="$2" label="$3"
  local actual
  actual=$(json "$expression")
  if [ "$actual" != "$expected" ]; then
    echo "FAIL [$label] expected $expected got $actual"
    exit 1
  fi
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "ok   [$label]"
}

assert_header() {
  local name="$1" expected="$2" label="$3"
  if ! grep -i "^$name: $expected" "$WORK/headers" >/dev/null; then
    echo "FAIL [$label] header $name missing or not $expected"
    exit 1
  fi
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "ok   [$label]"
}

JSON_HEADER=(-H 'Content-Type: application/json')

signup() {
  local who="$1" label="$2"
  request POST /api/auth/signup 201 "$label" "${JSON_HEADER[@]}" \
    -d "{\"name\":\"Smoke $who\",\"email\":\"smoke-$who+$STAMP@example.com\",\"password\":\"password123\"}"
}

echo "--- happy path against $BASE_URL"
request GET /health 200 "health"
assert_json "body.ok" "true" "health reports ok"
assert_json "typeof body.commit" "string" "health reports a commit"
request OPTIONS /api/groups 204 "cors preflight"
assert_header "access-control-allow-origin" '\*' "cors allows any origin"

signup a "signup a"
TOKEN_A=$(json "body.token")
AUTH_A=(-H "Authorization: Bearer $TOKEN_A")
request POST /api/auth/login 200 "login a" "${JSON_HEADER[@]}" \
  -d "{\"email\":\"smoke-a+$STAMP@example.com\",\"password\":\"password123\"}"
request GET /api/me 200 "me a" "${AUTH_A[@]}"
assert_json "body.profile.email" "smoke-a+$STAMP@example.com" "me returns the signed in profile"
request POST /api/me/cam-consent 200 "cam consent" "${AUTH_A[@]}" "${JSON_HEADER[@]}" -d '{"allowed":true}'
request POST /api/groups 201 "create group" "${AUTH_A[@]}" "${JSON_HEADER[@]}" -d '{"name":"Smoke Squad"}'
GROUP_ID=$(json "body.id")
request POST "/api/groups/$GROUP_ID/invites" 201 "create invite" "${AUTH_A[@]}"
INVITE_CODE=$(json "body.code")
request GET /api/designs 200 "list designs" "${AUTH_A[@]}"

signup b "signup b"
TOKEN_B=$(json "body.token")
AUTH_B=(-H "Authorization: Bearer $TOKEN_B")
request GET "/api/groups/$GROUP_ID/history" 403 "history denied before joining" "${AUTH_B[@]}"
request POST "/api/invites/$INVITE_CODE/accept" 200 "accept invite" "${AUTH_B[@]}"
assert_json "body.id" "$GROUP_ID" "accept returns the joined group"
request GET "/api/groups/$GROUP_ID/history" 200 "history after joining" "${AUTH_B[@]}"
request POST "/api/groups/$GROUP_ID/visibility" 200 "owner makes group public" "${AUTH_A[@]}" "${JSON_HEADER[@]}" -d '{"public":true}'
assert_json "body.isPublic" "true" "visibility reflects public"
signup c "signup c"
TOKEN_C=$(json "body.token")
AUTH_C=(-H "Authorization: Bearer $TOKEN_C")
request GET /api/groups/public 200 "public groups listed" "${AUTH_C[@]}"
assert_json "body.groups.some(g => g.id === '$GROUP_ID')" "true" "public list contains the crew"
request POST "/api/groups/$GROUP_ID/join" 200 "join public group" "${AUTH_C[@]}"
request GET /api/me 200 "me c" "${AUTH_C[@]}"
assert_json "body.groups.some(g => g.id === '$GROUP_ID')" "true" "joined crew appears on me"
request POST "/api/groups/$GROUP_ID/visibility" 200 "owner makes group private again" "${AUTH_A[@]}" "${JSON_HEADER[@]}" -d '{"public":false}'

echo "--- unhappy path"
request GET /api/me 401 "me without token"
request GET /api/me 401 "me with garbage token" -H 'Authorization: Bearer nope'
request POST /api/auth/signup 400 "signup short password" "${JSON_HEADER[@]}" \
  -d "{\"name\":\"Short\",\"email\":\"smoke-short+$STAMP@example.com\",\"password\":\"short\"}"
request POST /api/auth/signup 409 "signup duplicate email" "${JSON_HEADER[@]}" \
  -d "{\"name\":\"Again\",\"email\":\"smoke-a+$STAMP@example.com\",\"password\":\"password123\"}"
request POST /api/auth/login 401 "login wrong password" "${JSON_HEADER[@]}" \
  -d "{\"email\":\"smoke-a+$STAMP@example.com\",\"password\":\"wrongpassword\"}"
request POST /api/groups 400 "group without name" "${AUTH_A[@]}" "${JSON_HEADER[@]}" -d '{"name":"   "}'
request POST /api/invites/nope/accept 404 "accept unknown invite" "${AUTH_B[@]}"
request POST "/api/groups/$GROUP_ID/visibility" 403 "member cannot change visibility" "${AUTH_B[@]}" "${JSON_HEADER[@]}" -d '{"public":true}'
request POST "/api/groups/$GROUP_ID/visibility" 400 "visibility non boolean" "${AUTH_A[@]}" "${JSON_HEADER[@]}" -d '{"public":"yes"}'
request POST /api/groups 201 "create private group" "${AUTH_A[@]}" "${JSON_HEADER[@]}" -d '{"name":"Smoke Secret"}'
PRIVATE_ID=$(json "body.id")
request POST "/api/groups/$PRIVATE_ID/join" 403 "join private group" "${AUTH_C[@]}"
request POST /api/groups/nope/join 404 "join unknown group" "${AUTH_C[@]}"
request POST /api/me/cam-consent 400 "cam consent non boolean" "${AUTH_A[@]}" "${JSON_HEADER[@]}" -d '{"allowed":"yes"}'
request POST /api/designs 400 "invalid design" "${AUTH_A[@]}" "${JSON_HEADER[@]}" -d '{"design":{}}'
request GET /api/nope 404 "unknown api route" "${AUTH_A[@]}"
request GET /nope 404 "unknown path"

echo "--- websocket against $WS_URL"
node "$SCRIPT_DIR/ws-probe.mjs" "$WS_URL"
PASS_COUNT=$((PASS_COUNT + 10))

echo "SMOKE PASSED ($PASS_COUNT checks)"
