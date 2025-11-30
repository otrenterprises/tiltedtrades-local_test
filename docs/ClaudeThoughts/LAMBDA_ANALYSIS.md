# AWS Lambda Code Analysis Report

**Generated:** November 29, 2025  
**Scope:** All Lambda functions in `AWS/lambdas/`  
**Total Lines of Code:** 8,517

---

## Executive Summary

The Lambda codebase is **functional and well-structured** but has **significant code duplication** that increases maintenance burden. The Python Lambda (trades-data) is notably cleaner than the Node.js Lambdas. Key issues include 7 duplicate config files, inconsistent error handling patterns, and one Lambda with a monolithic 703-line handler.

| Metric | Value | Assessment |
|--------|-------|------------|
| Total Lambdas | 8 | ✅ Reasonable |
| Languages | Python 3.11 + Node.js 20.x | ✅ Good choices |
| Code Duplication | HIGH | ⚠️ 7 identical config.js files |
| Error Handling | GOOD | ✅ Consistent try/catch |
| Testing | NONE | ❌ No unit tests |
| Documentation | GOOD | ✅ JSDoc comments present |

---

## Lambda Inventory

| Lambda | Runtime | LOC | Purpose | Trigger |
|--------|---------|-----|---------|---------|
| `trades-data` | Python 3.11 | 1,547 | Excel parsing, validation, DynamoDB writes | S3 Event |
| `trading-data-processor` | Node.js 20.x | 471 | FIFO/Per-Position trade matching | Direct invoke / DynamoDB Stream |
| `trade-journal-api` | Node.js 20.x | 703 | Journal CRUD, chart uploads | API Gateway |
| `user-profile-api` | Node.js 20.x | 525 + 637 | Profile, preferences, trades, balance | API Gateway |
| `stats-calculator` | Node.js 20.x | 323 | Nightly statistics recalculation | EventBridge / Direct invoke |
| `file-upload-handler` | Node.js 20.x | 184 | Presigned URL generation | API Gateway |
| `public-profiles-api` | Node.js 20.x | 150 | Leaderboard, public profiles | API Gateway |
| `post-registration-trigger` | Node.js 20.x | 123 | New user profile creation | Cognito Post-Confirmation |

---

## Issue #1: Duplicated Config Files (HIGH PRIORITY)

### Problem
The `shared/types/config.js` file is **copied identically** into 7 Lambda directories:

```
tiltedtrades-dev-file-upload-handler/shared/types/config.js      (74 lines)
tiltedtrades-dev-post-registration-trigger/shared/types/config.js (74 lines)
tiltedtrades-dev-public-profiles-api/shared/types/config.js       (74 lines)
tiltedtrades-dev-stats-calculator/shared/types/config.js          (84 lines) ← DIFFERENT!
tiltedtrades-dev-trade-journal-api/shared/types/config.js         (84 lines)
tiltedtrades-dev-trading-data-processor/shared/types/config.js    (84 lines)
tiltedtrades-dev-user-profile-api/shared/types/config.js          (84 lines)
```

### Impact
- **Version drift**: 3 files have 74 lines, 4 files have 84 lines (newer version adds `USER_BALANCE_TABLE` and `COMMISSION_OVERRIDES_TABLE`)
- **Maintenance burden**: Any config change requires updating 7 files
- **Bug risk**: Easy to miss updating one file

### Difference Analysis
```javascript
// OLDER VERSION (74 lines) - Missing these tables:
// - USER_BALANCE_TABLE
// - COMMISSION_OVERRIDES_TABLE
// Present in: file-upload-handler, post-registration-trigger, public-profiles-api

// NEWER VERSION (84 lines) - Has all tables
// Present in: stats-calculator, trade-journal-api, trading-data-processor, user-profile-api
```

### Recommended Fix
Create a shared Lambda Layer for common code:

```
AWS/
├── lambda-layers/
│   ├── calculations/          # Already exists
│   └── shared-config/         # NEW - Create this
│       └── nodejs/
│           └── shared/
│               └── types/
│                   └── config.js
└── lambdas/
    └── */shared/types/config.js  # DELETE these duplicates
```

**Action Items:**
1. Create `AWS/lambda-layers/shared-config/` directory
2. Move canonical `config.js` to layer (use the 84-line version)
3. Update all Lambda `package.json` to reference layer
4. Delete `shared/types/config.js` from each Lambda
5. Update SAM/CloudFormation template to attach layer

---

## Issue #2: Monolithic trade-journal-api (MEDIUM PRIORITY)

### Problem
`trade-journal-api/src/index.js` is **703 lines** in a single file with:
- 9 handler functions
- Route parsing logic
- DynamoDB operations
- S3 operations
- Lambda invocations

### Current Structure
```javascript
// index.js (703 lines)
handler()                        // Main router
buildJournalTradeId()           // Helper
extractRawTradeId()             // Helper
extractCalculationMethod()       // Helper
handleGetJournal()              // 37 lines
handleCreateUpdateJournal()     // ~150 lines
handleDeleteJournal()           // ~50 lines
handleChartUpload()             // ~80 lines
handleDeleteChart()             // ~60 lines
handleListJournals()            // ~55 lines
verifyTradeExists()             // Helper
getExistingJournal()            // Helper
getMatchedTrade()               // Helper
triggerStatsRecalculation()     // Helper
```

### Recommended Refactor
Split into route modules (similar to `user-profile-api/routes/balance.js`):

```
trade-journal-api/src/
├── index.js              # Router only (~100 lines)
├── routes/
│   ├── journal.js        # Journal CRUD handlers
│   └── charts.js         # Chart upload/delete handlers
├── helpers/
│   ├── tradeId.js        # buildJournalTradeId, extractRawTradeId, etc.
│   └── dynamo.js         # getExistingJournal, verifyTradeExists, etc.
└── services/
    └── stats.js          # triggerStatsRecalculation
```

---

## Issue #3: Python vs Node.js Inconsistency (LOW PRIORITY)

### Observation
The `trades-data` Lambda uses Python with a **well-organized modular structure**:

```
tiltedtrades-dev-trades-data/
├── tradesData.py              # Main handler (373 lines)
├── handlers/
│   ├── validation.py          # File validation
│   ├── transformation.py      # Data transformation
│   ├── json_conversion.py     # JSON conversion
│   ├── dynamodb.py           # DynamoDB writes
│   ├── s3_archive.py         # S3 archival
│   └── monitoring.py         # Logging/metrics
├── models/
│   ├── excel_schema.py       # Schema definitions
│   ├── trading_execution.py  # Data models
│   └── original_order.py     # Legacy model
└── utils/
    ├── config.py             # Configuration
    ├── excel.py              # Excel parsing
    ├── calculations.py       # Commission calcs
    └── json_helpers.py       # JSON utilities
```

This is **significantly better organized** than the Node.js Lambdas. Consider adopting this pattern for Node.js Lambdas.

### Assessment
- **Not a bug** - just different organizational approaches
- Python Lambda is exemplary; Node.js Lambdas should aspire to similar structure
- No action required unless doing major refactoring

---

## Issue #4: Missing Tests (MEDIUM PRIORITY)

### Problem
**Zero test files** found in Lambda directories:

```bash
$ find AWS/lambdas -name "*.test.js" -o -name "*_test.py" -o -name "test_*.py"
# (no results)
```

### Risk Assessment
| Lambda | Risk if Untested |
|--------|------------------|
| `trades-data` | HIGH - Excel parsing is complex |
| `trading-data-processor` | HIGH - Financial calculations |
| `trade-journal-api` | MEDIUM - CRUD is straightforward |
| `user-profile-api` | MEDIUM - CRUD is straightforward |
| `stats-calculator` | HIGH - Statistical accuracy critical |

### Recommended Test Strategy
```
AWS/lambdas/tiltedtrades-dev-trades-data/
└── tests/
    ├── test_validation.py
    ├── test_transformation.py
    └── fixtures/
        ├── valid_upload.xlsx
        └── invalid_upload.xlsx

AWS/lambdas/tiltedtrades-dev-trading-data-processor/
└── __tests__/
    ├── index.test.js
    └── fixtures/
        └── sample_executions.json
```

**Priority order for testing:**
1. `trading-data-processor` - Trade matching must be accurate
2. `stats-calculator` - Statistics must be correct
3. `trades-data` - Excel parsing edge cases
4. API Lambdas - Can use integration tests

---

## Issue #5: Error Handling Inconsistencies (LOW PRIORITY)

### Good Pattern (Used Consistently)
```javascript
try {
  // operation
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
  console.error('Error:', errorMessage, error);
  // handle error
}
```

### Minor Inconsistencies Found

**1. Some catch blocks swallow errors silently:**
```javascript
// trade-journal-api line 520-523
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
  console.error('Error deleting chart from S3:', errorMessage, error);
  // ❌ No re-throw, continues silently
}
```

**2. Python uses different error format:**
```python
# tradesData.py
except Exception as e:
    error_message = str(e)
    stack_trace = traceback.format_exc()
    logger.error(f"Unexpected error: {error_message}")
```

### Recommendation
Create shared error handling utilities:

```javascript
// shared/utils/errors.js
function formatError(error, context) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`[${context}] Error:`, message, error);
  return message;
}

function createErrorResponse(statusCode, message, headers) {
  return {
    statusCode,
    headers,
    body: JSON.stringify({ error: message })
  };
}
```

---

## Issue #6: Hardcoded Lambda Names (LOW PRIORITY)

### Problem
Lambda function names are hardcoded with environment:

```javascript
// trade-journal-api line 690
FunctionName: `tiltedtrades-${config.ENVIRONMENT}-stats-calculator`,

// tradesData.py line 276-279
trading_processor_function = os.environ.get(
    'TRADING_DATA_PROCESSOR_FUNCTION',
    'tiltedtrades-dev-trading-data-processor'
)
```

### Assessment
- Python version is **better** - uses environment variable with fallback
- Node.js version uses string interpolation which is acceptable
- Not a critical issue but could cause problems with different naming conventions

### Recommended Fix
Add to config.js:
```javascript
// config.js
STATS_CALCULATOR_FUNCTION: process.env.STATS_CALCULATOR_FUNCTION ||
  `tiltedtrades-${env}-stats-calculator`,
TRADING_PROCESSOR_FUNCTION: process.env.TRADING_PROCESSOR_FUNCTION ||
  `tiltedtrades-${env}-trading-data-processor`,
```

---

## Issue #7: CORS Headers Duplication (LOW PRIORITY)

### Problem
CORS headers are defined identically in every API Lambda:

```javascript
// Repeated in: trade-journal-api, user-profile-api, public-profiles-api, file-upload-handler
const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};
```

### Recommendation
1. Move to API Gateway level (preferred) - configure CORS in API Gateway
2. Or add to shared config:
```javascript
// shared/types/config.js
exports.CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};
```

---

## Code Quality Metrics

### Complexity Analysis

| Lambda | Cyclomatic Complexity | Assessment |
|--------|-----------------------|------------|
| `trades-data` (Python) | LOW | Well-decomposed into handlers |
| `trading-data-processor` | MEDIUM | Single file but organized |
| `trade-journal-api` | HIGH | 703 lines, needs splitting |
| `user-profile-api` | MEDIUM | Has route separation |
| `stats-calculator` | LOW | Focused responsibility |
| `file-upload-handler` | LOW | Simple presigned URL logic |
| `public-profiles-api` | LOW | Simple CRUD |
| `post-registration-trigger` | LOW | Single purpose |

### Security Checklist

| Check | Status |
|-------|--------|
| User ID validation from JWT | ✅ All API Lambdas |
| User ID path/auth mismatch check | ✅ Prevents accessing other users' data |
| Input validation | ⚠️ Basic (could be stronger) |
| SQL injection | ✅ N/A (DynamoDB) |
| Presigned URL expiry | ✅ 5 minutes |
| Sensitive data logging | ✅ No PII in logs |
| Error message exposure | ⚠️ Some internal errors exposed |

---

## Recommendations Summary

### High Priority
| # | Issue | Effort | Impact |
|---|-------|--------|--------|
| 1 | Create shared config Lambda Layer | 2 hours | Eliminates 7 duplicate files |
| 2 | Add unit tests for trading-data-processor | 4 hours | Validates financial accuracy |

### Medium Priority
| # | Issue | Effort | Impact |
|---|-------|--------|--------|
| 3 | Split trade-journal-api into modules | 2 hours | Improves maintainability |
| 4 | Add unit tests for stats-calculator | 2 hours | Validates statistics |
| 5 | Standardize error handling utility | 1 hour | Consistency |

### Low Priority
| # | Issue | Effort | Impact |
|---|-------|--------|--------|
| 6 | Move Lambda names to config | 30 min | Cleaner code |
| 7 | Move CORS to API Gateway | 1 hour | Cleaner code |
| 8 | Add input validation library | 2 hours | Security hardening |

---

## Appendix A: Config File Diff

```diff
--- file-upload-handler/shared/types/config.js (74 lines)
+++ stats-calculator/shared/types/config.js (84 lines)

@@ -30,6 +30,10 @@
         `${projectName}-${env}-BrokerCredentials`,
     TRADE_JOURNALS_TABLE: process.env.TRADE_JOURNALS_TABLE ||
         `${projectName}-${env}-TradeJournals`,
+    USER_BALANCE_TABLE: process.env.USER_BALANCE_TABLE ||
+        `${projectName}-${env}-UserBalance`,
+    COMMISSION_OVERRIDES_TABLE: process.env.COMMISSION_OVERRIDES_TABLE ||
+        `${projectName}-${env}-CommissionOverrides`,
     // S3 Bucket

@@ -47,7 +51,9 @@
         matchedTrades: config.MATCHED_TRADES_TABLE,
         tradingStats: config.TRADING_STATS_TABLE,
         brokerCredentials: config.BROKER_CREDENTIALS_TABLE,
-        tradeJournals: config.TRADE_JOURNALS_TABLE
+        tradeJournals: config.TRADE_JOURNALS_TABLE,
+        userBalance: config.USER_BALANCE_TABLE,
+        commissionOverrides: config.COMMISSION_OVERRIDES_TABLE
     };
 }
```

---

## Appendix B: Lambda Dependency Graph

```
┌─────────────────┐
│   S3 Upload     │
│   (Excel file)  │
└────────┬────────┘
         │ S3 Event
         ▼
┌─────────────────┐      Direct Invoke      ┌─────────────────────────┐
│   trades-data   │ ───────────────────────▶│ trading-data-processor  │
│   (Python)      │                         │ (Node.js)               │
└────────┬────────┘                         └───────────┬─────────────┘
         │                                              │
         │ Writes                                       │ Writes
         ▼                                              ▼
┌─────────────────┐                         ┌─────────────────────────┐
│ TradingExecutions│                         │     MatchedTrades       │
│   (DynamoDB)    │                         │     (DynamoDB)          │
└─────────────────┘                         └───────────┬─────────────┘
                                                        │
                    ┌───────────────────────────────────┘
                    │ DynamoDB Stream (optional)
                    ▼
         ┌─────────────────────┐
         │   stats-calculator  │◀──── EventBridge (2 AM daily)
         │     (Node.js)       │
         └──────────┬──────────┘
                    │ Writes
                    ▼
         ┌─────────────────────┐
         │    TradingStats     │
         │    (DynamoDB)       │
         └─────────────────────┘

┌─────────────────┐     API Gateway     ┌─────────────────────────┐
│   Frontend      │◀───────────────────▶│   user-profile-api      │
│   (React)       │                     │   trade-journal-api     │
│                 │                     │   file-upload-handler   │
│                 │                     │   public-profiles-api   │
└─────────────────┘                     └─────────────────────────┘

┌─────────────────┐     Cognito         ┌─────────────────────────┐
│   User Signup   │────────────────────▶│ post-registration-trigger│
└─────────────────┘   Post-Confirm      └─────────────────────────┘
```

---

## Appendix C: File-by-File LOC Breakdown

```
Location                                                          Lines
────────────────────────────────────────────────────────────────────────
tiltedtrades-dev-trades-data/
├── tradesData.py                                                   373
├── handlers/validation.py                                          151
├── handlers/transformation.py                                      112
├── handlers/s3_archive.py                                         235
├── handlers/dynamodb.py                                           100
├── handlers/json_conversion.py                                    159
├── handlers/monitoring.py                                         283
├── handlers/original_data.py                                      113
├── models/trading_execution.py                                    617
├── models/excel_schema.py                                         429
├── models/original_order.py                                       323
├── utils/config.py                                                147
├── utils/excel.py                                                 272
├── utils/calculations.py                                          169
├── utils/json_helpers.py                                          233
├── utils/ses.py                                                   358
├── utils/historical_context.py                                    572
                                                        Subtotal: 4,646

tiltedtrades-dev-user-profile-api/
├── user-profile-api/src/index.js                                  525
├── user-profile-api/src/routes/balance.js                         637
├── shared/types/config.js                                          84
                                                        Subtotal: 1,246

tiltedtrades-dev-trade-journal-api/
├── trade-journal-api/src/index.js                                 703
├── shared/types/config.js                                          84
                                                        Subtotal:   787

tiltedtrades-dev-trading-data-processor/
├── trading-data-processor/src/index.js                            471
├── shared/types/config.js                                          84
                                                        Subtotal:   555

tiltedtrades-dev-stats-calculator/
├── stats-calculator/src/index.js                                  323
├── shared/types/config.js                                          84
                                                        Subtotal:   407

Other Lambdas (combined)                                           876
────────────────────────────────────────────────────────────────────────
TOTAL                                                            8,517
```

---

*Report generated for Claude Code refactoring reference*
