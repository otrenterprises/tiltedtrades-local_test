#!/bin/bash

# =============================================================================
# Demo User Provisioning Script (Parallel Execution)
# Creates 20 demo users and copies data from source demo account
# Runs users in parallel for speed
# =============================================================================

set -e  # Exit on error

# Configuration
USER_POOL_ID="us-east-1_VePlciWu5"
REGION="us-east-1"
SOURCE_EMAIL="demo@tiltedtrades.com"
NUM_USERS=20
BATCH_SIZE=25  # DynamoDB limit
PARALLEL_USERS=5  # How many users to process at once

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

echo -e "${YELLOW}=== Demo User Provisioning Script (Parallel) ===${NC}"
echo ""

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

# Export variables for subshells
export TEMP_DIR REGION USER_POOL_ID BATCH_SIZE
export EXECUTIONS_TABLE MATCHED_TRADES_TABLE TRADING_STATS_TABLE USER_PROFILES_TABLE USER_PREFERENCES_TABLE
export EXEC_COUNT TRADES_COUNT STATS_COUNT PROFILES_COUNT PREFS_COUNT

# -----------------------------------------------------------------------------
# Step 3: Create demo users and copy data IN PARALLEL
# -----------------------------------------------------------------------------
echo -e "${YELLOW}Step 3: Creating $NUM_USERS demo users ($PARALLEL_USERS in parallel)...${NC}"
echo ""

# Function to provision a single user (will be run in background)
provision_user() {
  local i=$1
  local EMAIL="demo${i}@tiltedtrades.com"
  local PASSWORD="Demo${i}Pa\$\$"

  echo "[User $i] Starting $EMAIL..."

  # Check if user already exists
  if aws cognito-idp admin-get-user \
    --user-pool-id "$USER_POOL_ID" \
    --username "$EMAIL" \
    --region "$REGION" &>/dev/null; then
    NEW_USER_ID=$(aws cognito-idp admin-get-user \
      --user-pool-id "$USER_POOL_ID" \
      --username "$EMAIL" \
      --region "$REGION" | jq -r '.UserAttributes[] | select(.Name=="sub") | .Value')
    echo "[User $i] Exists: $NEW_USER_ID"
  else
    # Create user
    aws cognito-idp admin-create-user \
      --user-pool-id "$USER_POOL_ID" \
      --username "$EMAIL" \
      --user-attributes Name=email,Value="$EMAIL" Name=email_verified,Value=true \
      --message-action SUPPRESS \
      --region "$REGION" > /dev/null

    # Set permanent password
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

    echo "[User $i] Created: $NEW_USER_ID"
  fi

  # Copy data using batch writes
  # TradingExecutions
  if [ "$EXEC_COUNT" -gt 0 ]; then
    local total_items=$(jq '.Items | length' "$TEMP_DIR/executions.json")
    local batches=$(( (total_items + BATCH_SIZE - 1) / BATCH_SIZE ))
    for ((b=0; b<batches; b++)); do
      local start=$((b * BATCH_SIZE))
      local batch_request=$(jq -c --arg uid "$NEW_USER_ID" --argjson start "$start" --argjson size "$BATCH_SIZE" '
        {"'"$EXECUTIONS_TABLE"'": [.Items[$start:$start+$size][] | .userId.S = $uid | {"PutRequest": {"Item": .}}]}
      ' "$TEMP_DIR/executions.json")
      aws dynamodb batch-write-item --request-items "$batch_request" --region "$REGION" > /dev/null 2>&1 || true
    done
  fi

  # MatchedTrades
  if [ "$TRADES_COUNT" -gt 0 ]; then
    local total_items=$(jq '.Items | length' "$TEMP_DIR/matched_trades.json")
    local batches=$(( (total_items + BATCH_SIZE - 1) / BATCH_SIZE ))
    for ((b=0; b<batches; b++)); do
      local start=$((b * BATCH_SIZE))
      local batch_request=$(jq -c --arg uid "$NEW_USER_ID" --argjson start "$start" --argjson size "$BATCH_SIZE" '
        {"'"$MATCHED_TRADES_TABLE"'": [.Items[$start:$start+$size][] | .userId.S = $uid | {"PutRequest": {"Item": .}}]}
      ' "$TEMP_DIR/matched_trades.json")
      aws dynamodb batch-write-item --request-items "$batch_request" --region "$REGION" > /dev/null 2>&1 || true
    done
  fi

  # TradingStats
  if [ "$STATS_COUNT" -gt 0 ]; then
    local total_items=$(jq '.Items | length' "$TEMP_DIR/stats.json")
    local batches=$(( (total_items + BATCH_SIZE - 1) / BATCH_SIZE ))
    for ((b=0; b<batches; b++)); do
      local start=$((b * BATCH_SIZE))
      local batch_request=$(jq -c --arg uid "$NEW_USER_ID" --argjson start "$start" --argjson size "$BATCH_SIZE" '
        {"'"$TRADING_STATS_TABLE"'": [.Items[$start:$start+$size][] | .userId.S = $uid | {"PutRequest": {"Item": .}}]}
      ' "$TEMP_DIR/stats.json")
      aws dynamodb batch-write-item --request-items "$batch_request" --region "$REGION" > /dev/null 2>&1 || true
    done
  fi

  # UserProfiles
  if [ "$PROFILES_COUNT" -gt 0 ]; then
    local total_items=$(jq '.Items | length' "$TEMP_DIR/profiles.json")
    local batches=$(( (total_items + BATCH_SIZE - 1) / BATCH_SIZE ))
    for ((b=0; b<batches; b++)); do
      local start=$((b * BATCH_SIZE))
      local batch_request=$(jq -c --arg uid "$NEW_USER_ID" --arg email "$EMAIL" --argjson start "$start" --argjson size "$BATCH_SIZE" '
        {"'"$USER_PROFILES_TABLE"'": [.Items[$start:$start+$size][] | .userId.S = $uid | (if .email then .email.S = $email else . end) | {"PutRequest": {"Item": .}}]}
      ' "$TEMP_DIR/profiles.json")
      aws dynamodb batch-write-item --request-items "$batch_request" --region "$REGION" > /dev/null 2>&1 || true
    done
  fi

  # UserPreferences
  if [ "$PREFS_COUNT" -gt 0 ]; then
    local total_items=$(jq '.Items | length' "$TEMP_DIR/preferences.json")
    local batches=$(( (total_items + BATCH_SIZE - 1) / BATCH_SIZE ))
    for ((b=0; b<batches; b++)); do
      local start=$((b * BATCH_SIZE))
      local batch_request=$(jq -c --arg uid "$NEW_USER_ID" --argjson start "$start" --argjson size "$BATCH_SIZE" '
        {"'"$USER_PREFERENCES_TABLE"'": [.Items[$start:$start+$size][] | .userId.S = $uid | {"PutRequest": {"Item": .}}]}
      ' "$TEMP_DIR/preferences.json")
      aws dynamodb batch-write-item --request-items "$batch_request" --region "$REGION" > /dev/null 2>&1 || true
    done
  fi

  echo "[User $i] DONE"
}

export -f provision_user

# Run users in parallel batches
for ((batch_start=1; batch_start<=NUM_USERS; batch_start+=PARALLEL_USERS)); do
  batch_end=$((batch_start + PARALLEL_USERS - 1))
  if [ $batch_end -gt $NUM_USERS ]; then
    batch_end=$NUM_USERS
  fi

  echo -e "${YELLOW}Processing users $batch_start to $batch_end in parallel...${NC}"

  # Launch parallel jobs
  pids=()
  for ((i=batch_start; i<=batch_end; i++)); do
    provision_user $i &
    pids+=($!)
  done

  # Wait for all jobs in this batch
  for pid in "${pids[@]}"; do
    wait $pid
  done

  echo -e "${GREEN}Batch complete${NC}"
  echo ""
done

# -----------------------------------------------------------------------------
# Cleanup
# -----------------------------------------------------------------------------
rm -rf "$TEMP_DIR"

echo -e "${GREEN}=== Provisioning Complete ===${NC}"
echo ""
echo "Created users:"
for i in $(seq 1 $NUM_USERS); do
  echo "  demo${i}@tiltedtrades.com / Demo${i}Pa\$\$"
done
