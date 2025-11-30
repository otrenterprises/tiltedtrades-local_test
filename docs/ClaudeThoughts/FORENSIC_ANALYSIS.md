# TiltedTrades Forensic Code Analysis

**Date:** November 29, 2025  
**Analyst:** Claude Code  
**Project:** tiltedtrades-local_test

---

## Executive Summary

TiltedTrades is a well-architected trading journal and analytics platform for futures traders. The codebase demonstrates mature patterns with a clean separation between frontend (React/TypeScript) and backend (AWS Lambda). The project recently underwent cleanup (documented in cleanUpSummary_20251129), leaving a focused, maintainable codebase. While the architecture is solid, there are opportunities for optimization and several dead code artifacts to address.

---

## 1. Architecture Analysis

### 1.1 Project Structure

```
tiltedtrades-local_test-master/
├── AWS/                          # Backend infrastructure
│   ├── lambdas/                  # 8 Lambda functions
│   │   ├── tiltedtrades-dev-trades-data/           # Python - Excel processing
│   │   ├── tiltedtrades-dev-trading-data-processor/ # Node.js - Trade matching
│   │   ├── tiltedtrades-dev-stats-calculator/       # Node.js - Statistics batch
│   │   ├── tiltedtrades-dev-file-upload-handler/    # Node.js - S3 presigned URLs
│   │   ├── tiltedtrades-dev-user-profile-api/       # Node.js - Profile CRUD
│   │   ├── tiltedtrades-dev-trade-journal-api/      # Node.js - Journal API
│   │   ├── tiltedtrades-dev-public-profiles-api/    # Node.js - Leaderboard
│   │   └── tiltedtrades-dev-post-registration-trigger/ # Node.js - Cognito hook
│   ├── lambda-layers/calculations/  # Shared calculation module
│   └── scripts/                     # Migration scripts
├── src/                          # Frontend React application
│   ├── components/               # Reusable UI components (153K)
│   ├── pages/                    # Page components (345K)
│   ├── hooks/                    # React Query hooks (43K)
│   ├── services/                 # API & auth services (67K)
│   ├── utils/                    # Utilities & calculations (72K)
│   ├── types/                    # TypeScript definitions (31K)
│   ├── contexts/                 # React contexts (11K)
│   └── config/                   # Environment configuration
├── scripts/                      # Admin/maintenance scripts
└── docs/                         # Documentation
```

### 1.2 Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Frontend Framework** | React | 18.2.0 |
| **Build Tool** | Vite | 5.0.8 |
| **Language** | TypeScript | 5.2.2 |
| **Styling** | Tailwind CSS | 3.4.0 |
| **State Management** | React Query + Zustand | 5.90.9 / 5.0.8 |
| **Routing** | React Router | 7.9.4 |
| **Forms** | React Hook Form + Zod | 7.66.0 / 4.1.12 |
| **Charts** | Recharts | 3.3.0 |
| **Data Tables** | TanStack Table | 8.21.3 |
| **Auth** | AWS Amplify + Cognito | 6.15.8 |
| **HTTP Client** | Axios | 1.13.2 |
| **Backend** | AWS Lambda (Python 3.11 / Node.js 20.x) | - |
| **Database** | DynamoDB | - |
| **Storage** | S3 | - |

### 1.3 Design Patterns Identified

| Pattern | Implementation | Location |
|---------|---------------|----------|
| **Repository Pattern** | API services abstract data access | `src/services/api/*.ts` |
| **Factory Pattern** | TradeMatchingEngine creates trade objects | `src/utils/calculations/tradeMatching.ts` |
| **Observer Pattern** | React Query cache invalidation | `src/hooks/useTrades.ts` |
| **Strategy Pattern** | FIFO vs Per-Position calculation methods | `TradeMatchingEngine.matchTrades()` |
| **Reducer Pattern** | Auth state management | `src/contexts/AuthContext.tsx` |
| **Singleton Pattern** | API client instance | `src/services/api/client.ts` |
| **Provider Pattern** | Auth & Navigation contexts | `src/contexts/` |
| **Facade Pattern** | Commission/Stats calculators | `src/utils/calculations/` |
| **Circuit Breaker** | Query execution limiter | `src/hooks/useTrades.ts:79-101` |

---

## 2. Data Flow Mapping

### 2.1 Primary Data Flow: Excel → DynamoDB → React

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER UPLOAD FLOW                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Excel File (.xlsx)                                                  │
│       │                                                              │
│       ▼                                                              │
│  [FileUploadModal.tsx] ──────► [upload.service.ts]                  │
│       │                              │                               │
│       │                              ▼                               │
│       │                   POST /api/users/{userId}/upload            │
│       │                              │                               │
│       │                              ▼                               │
│       │                   [file-upload-handler Lambda]               │
│       │                        │                                     │
│       │                        ▼                                     │
│       │              Generate Presigned S3 URL                       │
│       │                        │                                     │
│       ▼                        ▼                                     │
│  Browser PUT to S3 ◄────── Return URL                               │
│       │                                                              │
│       ▼                                                              │
│  S3 Bucket: users/{userId}/uploads/                                  │
│       │                                                              │
│       │ (S3 Event Trigger)                                          │
│       ▼                                                              │
│  [trades-data Lambda - Python]                                       │
│       │                                                              │
│       ├─► Validate Excel structure                                   │
│       ├─► Transform & normalize rows                                 │
│       ├─► Archive original JSON to S3                                │
│       ├─► Convert to TradingExecution records                        │
│       ├─► Batch write to DynamoDB (TradingExecutions)               │
│       └─► Invoke trading-data-processor (async)                      │
│              │                                                       │
│              ▼                                                       │
│  [trading-data-processor Lambda - Node.js]                           │
│       │                                                              │
│       ├─► Query all user executions                                  │
│       ├─► Sort chronologically                                       │
│       ├─► Match trades (FIFO + Per Position)                        │
│       ├─► Delete old MatchedTrades                                   │
│       ├─► Write both methods to MatchedTrades table                  │
│       ├─► Apply commission overrides                                 │
│       ├─► Calculate statistics                                       │
│       └─► Update TradingStats table                                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     FRONTEND DATA CONSUMPTION                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  React Component (e.g., DashboardNew.tsx)                           │
│       │                                                              │
│       ▼                                                              │
│  useTrades({ method: calculationMethod }) ← React Query Hook        │
│       │                                                              │
│       ▼                                                              │
│  tradeService.getTrades() ← API Service                             │
│       │                                                              │
│       ▼                                                              │
│  apiClient.get('/api/users/{userId}/trades')                        │
│       │                                                              │
│       │ (Axios interceptor adds JWT from Cognito)                   │
│       ▼                                                              │
│  API Gateway → Lambda → DynamoDB Query                              │
│       │                                                              │
│       │ (Response: MatchedTrade[])                                  │
│       ▼                                                              │
│  transformToTrade() ← Data transformation                           │
│       │                                                              │
│       ▼                                                              │
│  StatisticsCalculator.calculateMetrics(trades, showGrossPL)         │
│       │                                                              │
│       ▼                                                              │
│  Render charts and metrics                                           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Entry Points

| Entry Point | Type | Handler |
|------------|------|---------|
| `/login` | UI Route | `LoginForm.tsx` |
| `/signup` | UI Route | `SignupForm.tsx` |
| `/app/*` | Protected Routes | Various page components |
| `S3 upload trigger` | AWS Event | `trades-data` Lambda |
| `DynamoDB Stream` | AWS Event | `trading-data-processor` Lambda |
| `EventBridge schedule` | AWS Event | `stats-calculator` Lambda |
| `Cognito post-confirm` | AWS Event | `post-registration-trigger` Lambda |
| `API Gateway /api/*` | REST API | Multiple Lambda handlers |

### 2.3 State Management

| State Type | Technology | Scope |
|-----------|------------|-------|
| Server State | React Query | API data caching, 5-min stale time |
| Auth State | useReducer (AuthContext) | Global authentication |
| Navigation State | Zustand | Sidebar, modals |
| Local UI State | useState | Component-level |
| Balance Data | LocalBalanceService | JSON + localStorage |
| Form State | React Hook Form | Form inputs |

---

## 3. Functionality Audit

### 3.1 Core Modules

| Module | Purpose | LOC | Complexity |
|--------|---------|-----|------------|
| `TradeMatchingEngine` | FIFO/Per-Position matching | 498 | High |
| `StatisticsCalculator` | Trading metrics | 193 | Medium |
| `CommissionCalculator` | Tiered commission rates | 179 | Medium |
| `ContractSpecsCalculator` | Futures specs (tick values) | ~100 | Low |
| `AuthContext` | Authentication state | 212 | Medium |
| `LocalBalanceService` | Account balance tracking | 379 | Medium |

### 3.2 Trade Matching Engine Deep Dive

**FIFO Method (`matchSymbolTrades`):**
- Groups executions by symbol
- Tracks open positions with remaining quantities
- Handles long/short position determination via `PositionEffect`
- Matches entries to exits chronologically
- Creates one `Trade` record per matched contract pair
- Applies commission per matched contract

**Per-Position Method (`matchSymbolTradesPerPosition`):**
- Uses broker's `Status` field ("To Open"/"To Close")
- Tracks complete position lifecycle
- Creates one `Trade` per position cycle (open→close)
- Uses broker's `PnLPerPosition` when available
- Sums all `Fees` from executions

**Key Difference:**
```
FIFO: 3 entry contracts matched with 1 exit of 3 = 3 trade records
Per-Position: Same scenario = 1 trade record with quantity=3
```

### 3.3 Supporting Functionality

| Component | Function |
|-----------|----------|
| `DashboardNew` | Primary analytics view with metrics, charts |
| `CalendarNew` | Trading calendar heatmap (52K - largest component) |
| `TradeLog` | Searchable trade list with filtering |
| `JournalEditor` | Trade note editing with chart attachments |
| `AnalyticsAPI` | Detailed analytics with period filtering |
| `Balance` | Account balance tracking (deposits/withdrawals) |
| `Settings` | User preferences, commission tier, notifications |

---

## 4. Code Health Check

### 4.1 Unused Exports Identified

The following exports are defined but never imported elsewhere:

**Type Definitions (potentially intentional for API contracts):**
- `ApiResponse`, `PaginatedResponse`, `StatsResponse`
- `ChartUploadRequest`, `DateRangeParams`

**Utility Functions:**
- `formatCompactNumber` - Number formatting
- `formatDuration` - Time duration formatting  
- `formatPL` - P&L formatting (superseded?)
- `formatRelativeTime` - Relative time display
- `formatSymbol` - Symbol formatting
- `truncateText` - Text truncation

**Calendar Helpers (may be for future use):**
- `getAvailableMonths`, `getCalendarData`, `getMonthCalendarData`
- `getMaxAbsPL`, `getPLIntensity`

**React Query Hooks (may be for future features):**
- `useBalanceTemplates`, `useChartUpload`
- `useExecutions`, `useInvalidateBalance`, `useInvalidateTrades`
- `usePreferences`, `useTradesByDateRange`, `useTradesBySymbol`
- `useUpdatePreferences`, `useUpdateProfile`

**Components:**
- `ConsoleLogDownloader` - Debug tool (kept intentionally per cleanup notes)

### 4.2 Circular Dependency Analysis

Analyzed import patterns - **No true circular dependencies found**. Previous scan false positives were:
- Type-only imports (not runtime circular)
- Parent importing child (normal React pattern)
- Service importing config (unidirectional)

### 4.3 Code Duplication Assessment

| Area | Finding |
|------|---------|
| Commission calculation | Duplicated between frontend (`commission.ts`) and Lambda layer - **intentional** for offline/online parity |
| Trade matching | Duplicated between frontend and Lambda layer - **same reason** |
| Type definitions | Some overlap in `types/api/` and `types/` - minor redundancy |
| Date formatting | Multiple approaches (date-fns, manual) - could consolidate |

### 4.4 Complexity Hotspots

| File | Issue | Recommendation |
|------|-------|----------------|
| `CalendarNew.tsx` (52K) | Very large component | Split into sub-components |
| `tradeMatching.ts` | Complex FIFO logic | Well-documented, acceptable |
| `JournalList.tsx` (21K) | Large, many responsibilities | Extract filtering logic |
| `Balance.tsx` (21K) | Complex balance management | Consider splitting modal logic |

### 4.5 Dead Code Artifacts

Based on cleanup summary, these were quarantined to `src/_NotUsed/`:
- `CalendarNew.tsx.bak`
- `chartHelpers.ts.bak`  
- `LocalExcelDataService.ts`
- `LocalJournalService.ts`
- `Skeleton.tsx`
- `LandingPage.tsx`

**Recommendation:** Delete `src/_NotUsed/` directory entirely if confirmed unused.

---

## 5. Recommendations

### 5.1 Refactoring Opportunities

**High Priority:**

1. **Split Large Components**
   ```
   CalendarNew.tsx (52K) →
   ├── CalendarGrid.tsx
   ├── CalendarDayCell.tsx
   ├── CalendarHeader.tsx
   └── CalendarFilters.tsx
   ```

2. **Consolidate Unused Exports**
   - Audit and remove unused utility functions
   - Or document them as "planned for future use"

3. **Extract Modal Logic**
   - `BalanceEntryModal` (23K) could be split
   - `FileUploadModal` (10K) is appropriately sized

**Medium Priority:**

4. **Centralize Date Formatting**
   - Create a single `dateUtils.ts` for all date operations
   - Currently split between `date-fns` usage and manual formatting

5. **Type Definition Consolidation**
   - Merge overlapping types in `types/api/` with core types
   - Create a single source of truth for `Trade`, `Execution`, etc.

### 5.2 Architectural Improvements

1. **Backend Lambda Layer Optimization**
   - The `@tiltedtrades/calculations` layer is well-designed
   - Consider adding unit tests for the layer

2. **Error Boundary Implementation**
   - Add React Error Boundaries around major sections
   - Currently relies on component-level error handling

3. **Caching Strategy Enhancement**
   - React Query configured for 5-min stale time
   - Consider longer cache for historical data (won't change)

### 5.3 Performance Considerations

| Area | Current State | Recommendation |
|------|--------------|----------------|
| Trade Loading | All trades loaded at once | Implement virtual scrolling for >1000 trades |
| Chart Rendering | Recharts performs adequately | Consider SVG simplification for large datasets |
| Balance Calculation | Async JSON import + localStorage | Consider IndexedDB for larger datasets |
| Commission Init | Runs on every trade match | Cache monthly volumes between renders |

### 5.4 Code Organization Suggestions

1. **Move Commission Tier Constants**
   - Currently hardcoded in multiple places
   - Create `src/constants/commissions.ts`

2. **Standardize API Response Handling**
   - Some services check for array vs object responses
   - Standardize API Gateway response format

3. **Add API Versioning Prep**
   - Current endpoints: `/api/users/{userId}/...`
   - Consider: `/api/v1/users/{userId}/...`

---

## 6. Security Assessment

| Check | Status | Notes |
|-------|--------|-------|
| JWT Validation | ✅ | API client interceptor validates Cognito tokens |
| User Isolation | ✅ | All queries scoped by userId |
| Presigned URL Expiry | ✅ | 5-minute expiration |
| File Type Validation | ✅ | Whitelist: .xlsx, .xls, .csv |
| XSS Prevention | ✅ | React's default escaping |
| CORS | ✅ | Configured in API Gateway |
| Secrets Management | ✅ | Environment variables, no hardcoded keys |
| Session Management | ✅ | 30-min idle timeout, logout on close |

---

## 7. Testing Coverage Assessment

| Area | Current State |
|------|--------------|
| Unit Tests | Not present in repository |
| Integration Tests | Not present |
| E2E Tests | Not present |
| Lambda Tests | Not present |

**Recommendation:** Prioritize tests for:
1. `TradeMatchingEngine` (critical business logic)
2. `StatisticsCalculator` (financial calculations)
3. `CommissionCalculator` (money calculations)

---

## 8. Documentation Quality

| Document | Status | Quality |
|----------|--------|---------|
| `README.md` | ✅ Present | Good overview |
| `QUICK-START.md` | ✅ Present | Helpful for onboarding |
| `PROJECT_HISTORY.md` | ✅ Present | Good historical context |
| `FEATURES.md` | ✅ Present | Feature documentation |
| `CALCULATION_METHODS.md` | ✅ Present | Excellent technical detail |
| `FunctionalitySummary.md` | ✅ Present | Excellent backend reference |
| Inline Code Comments | Mixed | Some areas well-documented, others sparse |

---

## 9. Summary

### Strengths
- Clean architectural separation (frontend/backend)
- Well-designed trade matching with dual-method support
- Comprehensive AWS infrastructure
- Recent cleanup improved maintainability
- Good security practices
- Excellent backend documentation

### Areas for Improvement
- Large component sizes need splitting
- Unused exports should be cleaned or documented
- Missing test coverage
- Some code duplication (intentional but could be shared differently)

### Risk Assessment
- **Low Risk:** Core calculation logic is solid
- **Medium Risk:** Large components may become harder to maintain
- **Low Risk:** No security vulnerabilities identified

---

*Generated by Claude Code forensic analysis*
