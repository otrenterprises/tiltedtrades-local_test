# TiltedTrades API Data Contracts

**Last Updated:** November 29, 2025

This document details the exact data structures sent to and received from each API endpoint.

---

## Table of Contents

1. [Trade Data API](#1-trade-data-api)
2. [Balance API](#2-balance-api)
3. [Journal API](#3-journal-api)
4. [User API](#4-user-api)
5. [Upload API](#5-upload-api)
6. [Public API](#6-public-api)
7. [Internal Lambda Payloads](#7-internal-lambda-payloads)
8. [DynamoDB Record Schemas](#8-dynamodb-record-schemas)

---

## 1. Trade Data API

### GET /api/users/{userId}/executions

**Query Parameters:**
```typescript
{
  startDate?: string      // YYYY-MM-DD
  endDate?: string        // YYYY-MM-DD  
  symbol?: string         // e.g., "MES", "ES"
  limit?: number          // Pagination limit
  nextToken?: string      // Pagination cursor
}
```

**Response:**
```typescript
{
  executions: TradingExecution[]
  total: number
  nextToken?: string
}

// TradingExecution
{
  userId: string
  executionId: string
  DBKey: string              // Original broker transaction ID
  Ticker: string             // Raw ticker (e.g., "MESZ24")
  TickerConversion: string   // Normalized (e.g., "MES")
  Side: 'Long' | 'Short'
  Quantity: number
  ExecutionPrice: number
  Fees: number               // Negative value
  TradingDay: string         // YYYY-MM-DD
  ExecutionTime: string      // HH:MM:SS
  Status: 'Entry' | 'Exit'
  uploadTimestamp?: string
  s3Key?: string
}
```

---

### GET /api/users/{userId}/trades

**Query Parameters:**
```typescript
{
  method?: 'fifo' | 'perPosition'  // Calculation method
  symbol?: string
  startDate?: string    // YYYY-MM-DD
  endDate?: string      // YYYY-MM-DD
  limit?: number
  offset?: number
  nextToken?: string
}
```

**Response:**
```typescript
{
  trades: MatchedTrade[]
  total: number
  nextToken?: string
}

// MatchedTrade
{
  userId: string
  calculationMethod_tradeId: string   // "fifo#123_456_0" or "perPosition#seq1"
  calculationMethod: 'fifo' | 'perPosition'
  tradeId: string
  symbol: string                      // "MES", "ES", etc.
  side: 'Long' | 'Short'
  entryDate: string                   // ISO timestamp
  exitDate: string                    // ISO timestamp
  tradingDay?: string                 // YYYY-MM-DD (futures trading day)
  entryPrice: number
  exitPrice: number
  quantity: number
  pl: number                          // Net P&L (includes commission)
  plPercent: number                   // % return based on account balance
  duration: number                    // Minutes
  commission: number                  // Negative value
  status: 'closed'
  hasCommissionOverride?: boolean
  hasJournal?: boolean
}
```

---

### GET /api/users/{userId}/stats

**Query Parameters:**
```typescript
{
  period?: 'ALL' | 'DAILY' | 'WEEKLY' | 'MONTHLY'
}
```

**Response:**
```typescript
{
  userId: string
  statsType: 'ALL' | 'DAILY' | 'WEEKLY' | 'MONTHLY'
  calculationMethod: 'fifo' | 'perPosition'
  calculatedAt: string                // ISO timestamp
  totalTrades: number
  winningTrades: number
  losingTrades: number
  breakevenTrades?: number
  winRate: number                     // 0-100
  grossPL: number                     // Before commission
  totalPL: number                     // Net (after commission)
  totalCommission: number             // Negative value
  profitFactor: number
  expectancy: number
  maxDrawdown: number
  maxDrawdownPercent: number
  averageWin?: number
  averageLoss?: number
  largestWin?: number
  largestLoss?: number
}
```

---

## 2. Balance API

### GET /api/users/{userId}/balance

**Response:**
```typescript
{
  entries: ApiBalanceEntry[]
  templates: ApiRecurringTemplate[]
  runningBalance: number
}

// ApiBalanceEntry
{
  userId: string
  entryId: string
  type: 'deposit' | 'withdrawal' | 'fee' | 'commission_adjustment'
  amount: number                      // Positive for deposits, signed for adjustments
  date: string                        // YYYY-MM-DD
  description: string
  balance?: number                    // Running balance (calculated)
  generatedFromTemplate?: string      // Template ID if auto-generated
  commissionMeta?: {                  // Only for commission_adjustment
    tradeCount?: number
    contractCount?: number
    startDate?: string
    endDate?: string
    symbol?: string
  }
  createdAt: string
  updatedAt: string
}
```

---

### POST /api/users/{userId}/balance

**Request Body:**
```typescript
{
  type: 'deposit' | 'withdrawal' | 'fee' | 'commission_adjustment'
  amount: number
  date: string                        // YYYY-MM-DD
  description?: string
  // Commission adjustment metadata (only for commission_adjustment)
  tradeCount?: number
  contractCount?: number
  startDate?: string
  endDate?: string
  symbol?: string
}
```

**Response:** `ApiBalanceEntry`

---

### PUT /api/users/{userId}/balance/{entryId}

**Request Body:**
```typescript
{
  type?: 'deposit' | 'withdrawal' | 'fee' | 'commission_adjustment'
  amount?: number
  date?: string
  description?: string
  tradeCount?: number
  contractCount?: number
  startDate?: string
  endDate?: string
  symbol?: string
}
```

**Response:** `ApiBalanceEntry`

---

### POST /api/users/{userId}/balance/templates

**Request Body:**
```typescript
{
  type: 'deposit' | 'withdrawal' | 'fee'
  amount: number
  date: string                        // Start date
  description?: string
  dayOfMonth: number                  // 1-28
  endDate?: string                    // Optional end date
}
```

**Response:** `ApiRecurringTemplate`

---

## 3. Journal API

### GET /api/users/{userId}/journals

**Query Parameters:**
```typescript
{
  tags?: string                       // Comma-separated
  symbol?: string
  calculationMethod?: 'fifo' | 'perPosition'
  startDate?: string
  endDate?: string
  limit?: number
  nextToken?: string
}
```

**Response:**
```typescript
TradeJournal[]

// TradeJournal
{
  userId: string
  tradeId: string
  rawTradeId?: string                 // Without method prefix
  calculationMethod: 'fifo' | 'perPosition'
  symbol: string
  exitDate: string
  journalText: string
  tags: string[]
  chartReferences?: ChartReference[]
  emotionalState?: {
    preTradeEmotion?: 'confident' | 'anxious' | 'calm' | 'rushed' | 'fearful' | 'greedy'
    postTradeEmotion?: 'satisfied' | 'frustrated' | 'relieved' | 'regret' | 'euphoric' | 'disappointed'
    stressLevel?: number              // 1-10
  }
  tradingPlan?: {
    entryPlan?: string
    stopLoss?: number
    targetProfit?: number
    positionSize?: number
    adheredToPlan?: boolean
  }
  commissionOverride?: {
    originalCommission: number
    overrideCommission: number
    reason?: string
  }
  createdAt: string
  updatedAt: string
  version?: number
}

// ChartReference
{
  chartId: string
  chartType: 'uploaded' | 'tradingview' | 'internal'
  s3Key?: string
  url?: string
  caption?: string
  description?: string
  uploadedAt: string
}
```

---

### POST /api/users/{userId}/trades/{tradeId}/journal

**Request Body:**
```typescript
{
  journalText: string
  tags?: string[]
  symbol?: string
  exitDate?: string
  calculationMethod?: 'fifo' | 'perPosition'
  emotionalState?: {
    preTradeEmotion?: string
    postTradeEmotion?: string
    stressLevel?: number
  }
  tradingPlan?: {
    entryPlan?: string
    stopLoss?: number
    targetProfit?: number
    positionSize?: number
    adheredToPlan?: boolean
  }
  commissionOverride?: {
    overrideCommission: number
    reason?: string
  }
}
```

**Response:** `TradeJournal`

---

### POST /api/users/{userId}/trades/{tradeId}/journal/charts

**Request Body:**
```typescript
{
  chartType: 'uploaded' | 'tradingview'
  fileExtension?: string              // For uploaded charts
  caption?: string
  url?: string                        // For TradingView charts
}
```

**Response:**
```typescript
{
  uploadUrl: string                   // Presigned S3 URL
  s3Key: string
  expiresIn: number                   // Seconds
}
```

---

## 4. User API

### GET /api/users/{userId}/profile

**Response:**
```typescript
{
  userId: string
  email: string
  displayName?: string
  bio?: string
  isPublic: boolean
  createdAt: string
  lastLoginAt?: string
  totalTrades?: number
  totalPL?: number
  winRate?: number
  profitFactor?: number
  avatarUrl?: string
}
```

---

### PUT /api/users/{userId}/profile

**Request Body:**
```typescript
{
  displayName?: string
  bio?: string
  isPublic?: boolean
}
```

**Response:** `UserProfile`

---

### GET /api/users/{userId}/preferences

**Response:**
```typescript
{
  userId: string
  calculationMethod: 'fifo' | 'perPosition'
  commissionTier: 'standard' | 'professional' | 'retail'
  timezone: string
  dateFormat: string
  currency: string
  notifications: {
    email: boolean
    uploadComplete: boolean
    weeklyReport: boolean
    monthlyReport: boolean
  }
  privacySettings: {
    showOnLeaderboard: boolean
    showRealName: boolean
    showStats: boolean
  }
  displayPreferences: {
    defaultView: 'overview' | 'trades' | 'stats'
    chartsPerPage: number
    theme: 'light' | 'dark' | 'auto'
  }
  riskSettings?: {
    defaultRiskPerTrade?: number
    maxDailyLoss?: number
  }
  createdAt: string
  updatedAt: string
}
```

---

### PUT /api/users/{userId}/preferences

**Request Body:**
```typescript
{
  calculationMethod?: 'fifo' | 'perPosition'
  commissionTier?: 'standard' | 'professional' | 'retail'
  timezone?: string
  dateFormat?: string
  currency?: string
  notifications?: Partial<NotificationPrefs>
  privacySettings?: Partial<PrivacySettings>
  displayPreferences?: Partial<DisplayPrefs>
  riskSettings?: Partial<RiskSettings>
}
```

**Response:** `UserPreferences`

---

## 5. Upload API

### POST /api/users/{userId}/upload

**Request Body:**
```typescript
{
  filename: string                    // Original filename
  contentType: string                 // MIME type
}
```

**Response:**
```typescript
{
  uploadUrl: string                   // Presigned S3 PUT URL
  s3Key: string                       // "users/{userId}/uploads/{timestamp}_{filename}"
  bucket: string
  expiresIn: number                   // 300 seconds (5 min)
}
```

**Browser then uploads directly to S3:**
```
PUT {uploadUrl}
Content-Type: {contentType}
Body: <file binary>
```

---

## 6. Public API

### GET /api/public/profiles

**Query Parameters:**
```typescript
{
  limit?: number
  sortBy?: 'totalPL' | 'winRate' | 'profitFactor'
  order?: 'asc' | 'desc'
}
```

**Response:**
```typescript
{
  profiles: LeaderboardEntry[]
  total: number
}

// LeaderboardEntry
{
  rank: number
  userId: string
  displayName: string
  bio?: string
  totalTrades: number
  totalPL: number
  winRate: number
  profitFactor: number
  joinedDate: string
  avatarUrl?: string
}
```

---

## 7. Internal Lambda Payloads

### trades-data → trading-data-processor

```typescript
{
  trigger: 'upload-complete'
  userId: string
  executionsWritten: number
  sourceFile: string
}
```

### Cognito → post-registration-trigger

```typescript
{
  version: string
  triggerSource: 'PostConfirmation_ConfirmSignUp'
  region: string
  userPoolId: string
  userName: string
  request: {
    userAttributes: {
      sub: string           // User ID
      email: string
      email_verified: string
    }
  }
  response: {}
}
```

---

## 8. DynamoDB Record Schemas

### TradingExecutions Table

| Attribute | Type | Key |
|-----------|------|-----|
| `userId` | String | PK |
| `executionId` | String | SK |
| `DBKey` | Number | - |
| `Ticker` | String | - |
| `TickerConversion` | String | - |
| `TradingDay` | String | - |
| `Time` | String | - |
| `Side` | String | - |
| `Quantity` | Number | - |
| `ExecutionPrice` | Number | - |
| `PositionEffect` | Number | - |
| `Fees` | Number | - |
| `PnLPerPosition` | Number | - |

### MatchedTrades Table

| Attribute | Type | Key |
|-----------|------|-----|
| `userId` | String | PK |
| `calculationMethod_tradeId` | String | SK |
| `calculationMethod` | String | - |
| `tradeId` | String | - |
| `symbol` | String | - |
| `side` | String | - |
| `entryDate` | String | - |
| `exitDate` | String | - |
| `tradingDay` | String | - |
| `entryPrice` | Number | - |
| `exitPrice` | Number | - |
| `quantity` | Number | - |
| `pl` | Number | - |
| `plPercent` | Number | - |
| `duration` | Number | - |
| `commission` | Number | - |
| `executionIds` | List | - |

### TradingStats Table

| Attribute | Type | Key |
|-----------|------|-----|
| `userId` | String | PK |
| `statsType` | String | SK |
| `totalTrades` | Number | - |
| `winningTrades` | Number | - |
| `losingTrades` | Number | - |
| `winRate` | Number | - |
| `grossPL` | Number | - |
| `totalPL` | Number | - |
| `totalCommission` | Number | - |
| `profitFactor` | Number | - |
| `expectancy` | Number | - |
| `maxDrawdown` | Number | - |

### TradeJournals Table

| Attribute | Type | Key |
|-----------|------|-----|
| `userId` | String | PK |
| `tradeId` | String | SK |
| `calculationMethod` | String | - |
| `symbol` | String | - |
| `exitDate` | String | GSI-SK |
| `journalText` | String | - |
| `tags` | List | - |
| `chartReferences` | List | - |
| `commissionOverride` | Map | - |

### UserBalance Table

| Attribute | Type | Key |
|-----------|------|-----|
| `userId` | String | PK |
| `entryId` | String | SK |
| `type` | String | - |
| `amount` | Number | - |
| `date` | String | - |
| `description` | String | - |
| `dayOfMonth` | Number | - |
| `commissionMeta` | Map | - |

---

*Generated by Claude Code analysis*
