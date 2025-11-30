# TiltedTrades Project History

This document consolidates the project's implementation history, planning documents, and status updates for reference.

---

## Project Timeline

### Phase 1: Cognito Authentication (Complete - Nov 2025)
- Implemented AWS Cognito sign-in/sign-up with Amplify v6
- Auto-sign-in after email verification
- AuthContext, authService, ProtectedRoute components
- Environment configuration with Cognito credentials

### Phase 2: File Upload & Data Pipeline (Complete - Nov 25, 2025)
- Full upload pipeline using direct Lambda invocation (replaced DynamoDB Streams)
- S3 presigned URL generation via API Gateway + Lambda
- trades-data Lambda processes Excel files and writes to DynamoDB
- trading-data-processor Lambda handles trade matching and statistics
- Added BatchWrite retry logic with exponential backoff

### Phase 3: API Integration (Complete - Nov 27, 2025)
- Replaced local JSON/Excel data sources with AWS API Gateway endpoints
- Trade data fetched from MatchedTrades table (FIFO and Per Position)
- Statistics fetched from TradingStats table
- User profile and preferences API integration
- Journal API integration with S3 chart uploads

### Phase 4: Commission & Calculation Fixes (Nov 29, 2025)
- Fixed break-even trades calculation with Gross/Net P&L toggle
- Reverted to client-side calculated P&L for commission override support
- Lambda layer restored to version 6

---

## AWS Infrastructure

### Deployed Resources (us-east-1)
| Resource | Identifier | Status |
|----------|------------|--------|
| API Gateway | `dls0o6mkhg` (tiltedtrades-dev-api) | Active |
| S3 Bucket | `tiltedtrades-dev-filebucket-427687728291` | Active |
| Cognito User Pool | `us-east-1_VePlciWu5` | Active |
| Lambda Layer | `tiltedtrades-dev-calculations:6` | Active |

### Lambda Functions
| Function | Runtime | Purpose |
|----------|---------|---------|
| tiltedtrades-dev-trades-data | Python 3.11 | Excel file processing |
| tiltedtrades-dev-trading-data-processor | Node.js 20.x | Trade matching (FIFO + Per Position) |
| tiltedtrades-dev-stats-calculator | Node.js 20.x | Nightly stats recalculation |
| tiltedtrades-dev-file-upload-handler | Node.js 20.x | Presigned S3 URL generation |
| tiltedtrades-dev-user-profile-api | Node.js 20.x | User profiles & REST API |
| tiltedtrades-dev-trade-journal-api | Node.js 20.x | Trade journal CRUD |
| tiltedtrades-dev-public-profiles-api | Node.js 20.x | Public leaderboard |
| tiltedtrades-dev-post-registration-trigger | Node.js 20.x | User registration initialization |

### DynamoDB Tables
- TradingExecutions - Raw execution records
- MatchedTrades - Matched trades (FIFO and Per Position)
- TradingStats - Aggregated statistics
- UserProfiles - User profile data
- UserPreferences - User preferences
- TradeJournals - Journal entries
- BrokerCredentials - Broker connection info

---

## Data Pipeline Architecture

```
File Upload → S3 → trades-data Lambda → TradingExecutions (DynamoDB)
                                             ↓
                                    Direct Lambda Invocation
                                             ↓
                              trading-data-processor Lambda
                                             ↓
                             MatchedTrades + TradingStats tables
                                             ↓
                              EventBridge (nightly @ 2 AM UTC)
                                             ↓
                                    stats-calculator Lambda
```

### Key Pipeline Decisions
1. **Direct Lambda Invocation** - Replaced DynamoDB Streams to avoid race conditions with bulk uploads
2. **Dual Calculation Methods** - Both FIFO and Per Position trades stored for instant frontend switching
3. **Pre-calculated Statistics** - Stats calculated server-side for performance

---

## Known Issues & Workarounds

### FIFO vs Per Position Variance
- Small commission variance exists between methods (~$1.24 on large datasets)
- Root cause: Per Position uses broker-reported fees, FIFO uses calculated commission
- Workaround: Commission overrides applied client-side

### Commission Overrides
- Dashboard and Analytics use client-side calculated P&L (not apiStats)
- This ensures commission overrides are properly reflected
- Backend TradingStats table may show slightly different values

---

## Environment Configuration

```env
VITE_API_BASE_URL=https://dls0o6mkhg.execute-api.us-east-1.amazonaws.com/dev
VITE_COGNITO_USER_POOL_ID=us-east-1_VePlciWu5
VITE_COGNITO_CLIENT_ID=78tbqlscvaa6lgomedi7001qfg
VITE_AWS_REGION=us-east-1
VITE_S3_BUCKET_NAME=tiltedtrades-dev-filebucket-427687728291
```

---

## Files Modified During AWS Integration

### Frontend Changes
- `src/services/api/` - All service files updated for API calls
- `src/hooks/` - React Query hooks for data fetching
- `src/types/api/` - Type definitions matching DynamoDB schema
- `src/pages/` - Components updated to use API hooks

### Lambda Changes
- `tradesData/tradesData.py` - Added direct Lambda invocation
- `trading-data-processor/src/index.ts` - BatchWrite retry logic, DBKey usage
- Handler paths fixed for all Node.js Lambdas

---

## Previous Cleanup Actions

### Completed (Nov 23, 2025)
- Deleted backup files (10 .backup files, ~2,868 lines)
- Deleted unused page variants (Dashboard.tsx, DashboardAPI.tsx, Analytics.tsx)
- Removed duplicate hook definitions

### Preserved for Future
- Leaderboard and PublicProfile pages (for multi-user support)
- All utility functions (conservative approach)

---

*Last Updated: November 29, 2025*
