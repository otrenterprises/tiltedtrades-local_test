# Calculation Methods Documentation

This document covers the FIFO and Per Position trade matching algorithms, known issues, and planned fixes.

---

## Overview

TiltedTrades supports two calculation methods for matching trades:

| Method | Description | Use Case |
|--------|-------------|----------|
| **FIFO** | First-In-First-Out matching | Tax reporting, IRS compliance |
| **Per Position** | Groups all entries/exits within a position | Broker's view, position analysis |

Both methods are calculated server-side and stored in DynamoDB for instant switching.

---

## FIFO Matching Algorithm

### How It Works
1. Sort executions chronologically by `DBKey`
2. Maintain an `openPositions` queue
3. For each execution:
   - If opening (PositionEffect > 0): Push to queue
   - If closing (PositionEffect < 0): Pop from queue (FIFO order)
4. Create trade for each entry-exit match

### Key Fields
- `DBKey`: Unique execution identifier (chronological sorting)
- `PositionEffect`: Change in position (+/-)
- `Status`: "To Open XXX" or "To Close XXX"

### Trade ID Format
```
{closeExecution.DBKey}_{tradeCounter}
```

### P&L Calculation
```
grossPL = (exitPrice - entryPrice) * quantity * contractMultiplier * direction
netPL = grossPL - commission
```

---

## Per Position Matching Algorithm

### How It Works
1. Group executions by position lifecycle ("To Open" → "To Close")
2. Create one trade per complete position
3. Use broker's `PnLPerPosition` field when available

### Advantages
- Matches broker's P&L exactly
- Simpler for position analysis
- Fewer total trades

### Limitations
- Uses broker-reported fees (may differ from calculated)
- Less granular for tax reporting

---

## Known Issue: FIFO Display Spike

### Problem
Equity curve shows visual spikes on days with large scaling positions when using FIFO method.

### Root Cause
- FIFO creates many individual trades from scaling positions
- Example: 80 executions → 50 trades with P&L range -$779 to +$235
- When sorted by exit date, large winners appear before losers → visual spike
- Total P&L is correct, only display is affected

### Example Scenario
```
Timeline:
  13:19 - Buy 3 @ 6046.5  (Entry 1)
  ...
  19:25 - Buy 1 @ 5945    (Entry 27)
  01:01 - Sell 5 @ 5978   (Close partial)
  ...
  01:13 - Sell 3 @ 5983   (Close final)

FIFO creates 50 trades with varying P&L:
  Trade 1: Entry 27 → Close = +$165
  Trade 48: Entry 3 → Close = -$415
  ...
```

### Proposed Solution
Add position grouping to FIFO trades for display consolidation:

```typescript
interface Trade {
  // Existing fields
  id: string
  pl: number
  exitDate: Date

  // New fields
  positionGroupId?: string     // Links trades from same position
  isScalingPosition?: boolean  // Flag for positions with many trades
}
```

Equity curve rendering would consolidate scaling positions:
- Detect groups with >10 trades
- Display as single point on curve
- Trade log still shows all individual trades

---

## Known Issue: FIFO vs Per Position Variance

### Problem
Small P&L and commission variance between methods (~$1.24 on large datasets).

### Root Cause
| Method | Commission Source |
|--------|------------------|
| FIFO | `CommissionCalculator.calculateCommission()` |
| Per Position | `exec.Fees` (broker-reported) |

### Solution Required
Update Per Position to use calculated commission:

```javascript
// Current (in createTradeFromPosition):
const totalFees = executions.reduce((sum, exec) => sum + (exec.Fees ?? 0), 0);

// Should be:
const commission = CommissionCalculator.calculateCommission(symbol, quantity, commissionTier);
```

### Implementation Steps
1. Update TypeScript source in `@tiltedtrades/calculations`
2. Compile and test locally
3. Publish new package version
4. Update Lambda layer
5. Deploy and reprocess trades

---

## Commission Calculation

### Commission Tiers
Tier 3 is currently used ($0.60/side for MES).

### Formula
```
commission = ratePerSide * quantity * 2 (round trip)
```

### Commission Overrides
- Stored in MatchedTrades table per trade
- Applied client-side for display
- Backend TradingStats may not reflect overrides

---

## Cross-Method Journal Detection

### Challenge
Trades have different IDs between FIFO and Per Position methods. Journal entries are linked by trade ID.

### Solution
- Journal linked by `tradeId` field
- Frontend checks both `trade.id` and `trade.tradeId`
- Works across calculation method switches

---

## Files Involved

### Lambda Layer
- `tradeMatching.ts` - FIFO and Per Position algorithms
- `commission.ts` - Commission calculator
- `statistics.ts` - Metrics calculation
- `types.ts` - Trade interface definitions

### Frontend
- `src/utils/calculations/tradeMatching.ts` - Local matching (reference)
- `src/utils/calculations/statistics.ts` - Statistics calculator
- `src/pages/Analytics/AnalyticsAPI.tsx` - Equity curve rendering

---

## Verification Queries

### Check Trade Counts
```bash
# FIFO trades
aws dynamodb query --table-name tiltedtrades-dev-MatchedTrades \
  --key-condition-expression "userId = :uid AND begins_with(calculationMethod_tradeId, :method)" \
  --expression-attribute-values '{":uid":{"S":"USER_ID"},":method":{"S":"fifo#"}}' \
  --select COUNT --region us-east-1

# Per Position trades
aws dynamodb query --table-name tiltedtrades-dev-MatchedTrades \
  --key-condition-expression "userId = :uid AND begins_with(calculationMethod_tradeId, :method)" \
  --expression-attribute-values '{":uid":{"S":"USER_ID"},":method":{"S":"perPosition#"}}' \
  --select COUNT --region us-east-1
```

---

## Expected Data (Reference)

From Excel RunningTotals sheet:
| Metric | Value |
|--------|-------|
| FIFO Trades | 1,740 |
| Per Position Trades | 827 |
| Gross P&L | -$7,768.50 |
| Total Fees | -$4,767.00 |
| Net P&L | -$12,535.50 |

---

*Last Updated: November 29, 2025*
