#!/bin/bash

# =============================================================================
# Demo User Provisioning Script - TEST VERSION (1 user only)
# Uses batch-write-item for speed
# =============================================================================

set -e  # Exit on error

# Configuration
USER_POOL_ID="us-east-1_VePlciWu5"
REGION="us-east-1"
SOURCE_EMAIL="demo@tiltedtrades.com"
NUM_USERS=1  # Just 1 for testing
BATCH_SIZE=25  # DynamoDB limit

# Table names
EXECUTIONS_TABLE="tiltedtrades-dev-TradingExecutions"
MATCHED_TRADES_TABLE="tiltedtrades-dev-MatchedTrades"
TRADING_STATS_TABLE="tiltedtrades-dev-TradingStats"
USER_PROFILES_TABLE="tiltedtrades-dev-UserProfiles"
USER_PREFERENCES_TABLE="tiltedtrades-dev-UserPreferences"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Demo User Provisioning Script (TEST - 1 user) ===${NC}"
echo ""

# -----------------------------------------------------------------------------
# Function: Batch write items to DynamoDB
# -----------------------------------------------------------------------------
batch_write_items() {
  local table_name="$1"
  local items_file="$2"
  local new_user_id="$3"

  local total_items=$(jq '.Items | length' "$items_file")

  if [ "$total_items" -eq 0 ]; then
    return
  fi

  local batches=$(( (total_items + BATCH_SIZE - 1) / BATCH_SIZE ))

  for ((b=0; b<batches; b++)); do
    local start=$((b * BATCH_SIZE))

    local batch_request=$(jq -c --arg uid "$new_user_id" --argjson start "$start" --argjson size "$BATCH_SIZE" '
      {
        "'"$table_name"'": [.Items[$start:$start+$size][] | .userId.S = $uid | {"PutRequest": {"Item": .}}]
      }
    ' "$items_file")

    aws dynamodb batch-write-item \
      --request-items "$batch_request" \
      --region "$REGION" > /dev/null 2>&1 || true
  done
}

batch_write_profiles() {
  local table_name="$1"
  local items_file="$2"
  local new_user_id="$3"
  local new_email="$4"

  local total_items=$(jq '.Items | length' "$items_file")

  if [ "$total_items" -eq 0 ]; then
    return
  fi

  local batches=$(( (total_items + BATCH_SIZE - 1) / BATCH_SIZE ))

  for ((b=0; b<batches; b++)); do
    local start=$((b * BATCH_SIZE))

    local batch_request=$(jq -c --arg uid "$new_user_id" --arg email "$new_email" --argjson start "$start" --argjson size "$BATCH_SIZE" '
      {
        "'"$table_name"'": [.Items[$start:$start+$size][] | .userId.S = $uid | (if .email then .email.S = $email else . end) | {"PutRequest": {"Item": .}}]
      }
    ' "$items_file")

    aws dynamodb batch-write-item \
      --request-items "$batch_request" \
      --region "$REGION" > /dev/null 2>&1 || true
  done
}

# -----------------------------------------------------------------------------
# Step 1: Get source user's Cognito sub (userId)
# -----------------------------------------------------------------------------
echo -e "${YELLOW}Step 1: Looking up source user (${SOURCE_EMAIL})...${NC}"

SOURCE_USER_INFO=$(aws cognito-idp admin-get-user \
  --user-pool-id "$USER_POOL_ID" \
  --username "$SOURCE_EMAIL" \
  --region "$REGION" 2>/dev/null) || {
  echo -e "${RED}Error: Could not find user ${SOURCE_EMAIL} in Cognito${NC}"
  exit 1
}

SOURCE_USER_ID=$(echo "$SOURCE_USER_INFO" | jq -r '.UserAttributes[] | select(.Name=="sub") | .Value')

if [ -z "$SOURCE_USER_ID" ]; then
  echo -e "${RED}Error: Could not extract userId (sub) for ${SOURCE_EMAIL}${NC}"
  exit 1
fi

echo -e "${GREEN}Found source userId: ${SOURCE_USER_ID}${NC}"
echo ""

# -----------------------------------------------------------------------------
# Step 2: Export source user's data from all tables
# -----------------------------------------------------------------------------
echo -e "${YELLOW}Step 2: Exporting source user's data...${NC}"

TEMP_DIR=$(mktemp -d)
echo "Using temp directory: $TEMP_DIR"

export_table() {
  local table_name="$1"
  local output_file="$2"
  local all_items='{"Items":[]}'
  local last_key=""

  while true; do
    if [ -z "$last_key" ]; then
      response=$(aws dynamodb query \
        --table-name "$table_name" \
        --key-condition-expression "userId = :uid" \
        --expression-attribute-values "{\":uid\": {\"S\": \"$SOURCE_USER_ID\"}}" \
        --region "$REGION" \
        --output json)
    else
      response=$(aws dynamodb query \
        --table-name "$table_name" \
        --key-condition-expression "userId = :uid" \
        --expression-attribute-values "{\":uid\": {\"S\": \"$SOURCE_USER_ID\"}}" \
        --exclusive-start-key "$last_key" \
        --region "$REGION" \
        --output json)
    fi

    all_items=$(echo "$all_items" "$response" | jq -s '{"Items": (.[0].Items + .[1].Items)}')

    last_key=$(echo "$response" | jq -r '.LastEvaluatedKey // empty')
    if [ -z "$last_key" ]; then
      break
    fi
  done

  echo "$all_items" > "$output_file"
  echo $(jq '.Items | length' "$output_file")
}

echo "  Exporting TradingExecutions..."
EXEC_COUNT=$(export_table "$EXECUTIONS_TABLE" "$TEMP_DIR/executions.json")
echo -e "    ${GREEN}Found $EXEC_COUNT executions${NC}"

echo "  Exporting MatchedTrades..."
TRADES_COUNT=$(export_table "$MATCHED_TRADES_TABLE" "$TEMP_DIR/matched_trades.json")
echo -e "    ${GREEN}Found $TRADES_COUNT matched trades${NC}"

echo "  Exporting TradingStats..."
STATS_COUNT=$(export_table "$TRADING_STATS_TABLE" "$TEMP_DIR/stats.json")
echo -e "    ${GREEN}Found $STATS_COUNT stats records${NC}"

echo "  Exporting UserProfiles..."
PROFILES_COUNT=$(export_table "$USER_PROFILES_TABLE" "$TEMP_DIR/profiles.json")
echo -e "    ${GREEN}Found $PROFILES_COUNT profile records${NC}"

echo "  Exporting UserPreferences..."
PREFS_COUNT=$(export_table "$USER_PREFERENCES_TABLE" "$TEMP_DIR/preferences.json")
echo -e "    ${GREEN}Found $PREFS_COUNT preference records${NC}"

echo ""

# -----------------------------------------------------------------------------
# Step 3: Create test user and copy data
# -----------------------------------------------------------------------------
echo -e "${YELLOW}Step 3: Creating test demo user...${NC}"
echo ""

EMAIL="demo1@tiltedtrades.com"
PASSWORD="Demo1Pa\$\$"

echo -e "${YELLOW}--- Creating: $EMAIL ---${NC}"

if aws cognito-idp admin-get-user \
  --user-pool-id "$USER_POOL_ID" \
  --username "$EMAIL" \
  --region "$REGION" &>/dev/null; then
  echo -e "  ${YELLOW}User exists, getting userId...${NC}"
  NEW_USER_ID=$(aws cognito-idp admin-get-user \
    --user-pool-id "$USER_POOL_ID" \
    --username "$EMAIL" \
    --region "$REGION" | jq -r '.UserAttributes[] | select(.Name=="sub") | .Value')
else
  echo "  Creating Cognito user..."
  aws cognito-idp admin-create-user \
    --user-pool-id "$USER_POOL_ID" \
    --username "$EMAIL" \
    --user-attributes Name=email,Value="$EMAIL" Name=email_verified,Value=true \
    --message-action SUPPRESS \
    --region "$REGION" > /dev/null

  echo "  Setting password..."
  aws cognito-idp admin-set-user-password \
    --user-pool-id "$USER_POOL_ID" \
    --username "$EMAIL" \
    --password "$PASSWORD" \
    --permanent \
    --region "$REGION"

  NEW_USER_ID=$(aws cognito-idp admin-get-user \
    --user-pool-id "$USER_POOL_ID" \
    --username "$EMAIL" \
    --region "$REGION" | jq -r '.UserAttributes[] | select(.Name=="sub") | .Value')

  echo -e "  ${GREEN}Created: $NEW_USER_ID${NC}"
fi

echo "  Copying data (batch mode)..."

[ "$EXEC_COUNT" -gt 0 ] && echo "    Executions..." && batch_write_items "$EXECUTIONS_TABLE" "$TEMP_DIR/executions.json" "$NEW_USER_ID"
[ "$TRADES_COUNT" -gt 0 ] && echo "    Matched trades..." && batch_write_items "$MATCHED_TRADES_TABLE" "$TEMP_DIR/matched_trades.json" "$NEW_USER_ID"
[ "$STATS_COUNT" -gt 0 ] && echo "    Stats..." && batch_write_items "$TRADING_STATS_TABLE" "$TEMP_DIR/stats.json" "$NEW_USER_ID"
[ "$PROFILES_COUNT" -gt 0 ] && echo "    Profiles..." && batch_write_profiles "$USER_PROFILES_TABLE" "$TEMP_DIR/profiles.json" "$NEW_USER_ID" "$EMAIL"
[ "$PREFS_COUNT" -gt 0 ] && echo "    Preferences..." && batch_write_items "$USER_PREFERENCES_TABLE" "$TEMP_DIR/preferences.json" "$NEW_USER_ID"

echo -e "  ${GREEN}Done${NC}"

# -----------------------------------------------------------------------------
# Cleanup
# -----------------------------------------------------------------------------
rm -rf "$TEMP_DIR"

echo ""
echo -e "${GREEN}=== TEST Complete ===${NC}"
echo ""
echo "Test user created:"
echo "  Email: demo1@tiltedtrades.com"
echo "  Password: Demo1Pa\$\$"
echo ""
echo -e "${YELLOW}Log in to verify, then run: ./provision-demo-users.sh${NC}"
