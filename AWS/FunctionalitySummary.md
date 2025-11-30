# TiltedTrades Lambda Functions - Functionality Summary

**Last Updated**: November 27, 2025

This document provides a comprehensive explanation of each Lambda function in the TiltedTrades project, including their purpose, triggers, data flow, and DynamoDB table interactions.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Lambda Functions](#lambda-functions)
   - [trades-data (Python)](#1-tiltedtrades-dev-trades-data)
   - [trading-data-processor (Node.js)](#2-tiltedtrades-dev-trading-data-processor)
   - [stats-calculator (Node.js)](#3-tiltedtrades-dev-stats-calculator)
   - [file-upload-handler (Node.js)](#4-tiltedtrades-dev-file-upload-handler)
   - [user-profile-api (Node.js)](#5-tiltedtrades-dev-user-profile-api)
   - [trade-journal-api (Node.js)](#6-tiltedtrades-dev-trade-journal-api)
   - [public-profiles-api (Node.js)](#7-tiltedtrades-dev-public-profiles-api)
   - [post-registration-trigger (Node.js)](#8-tiltedtrades-dev-post-registration-trigger)
3. [Shared Calculations Layer](#shared-calculations-layer)
4. [DynamoDB Tables Reference](#dynamodb-tables-reference)
5. [Data Flow Diagrams](#data-flow-diagrams)

---

## Architecture Overview

The TiltedTrades backend consists of 8 Lambda functions that work together to:

1. **Accept and process trading data** from Excel/CSV file uploads
2. **Match trades** using FIFO or Per Position calculation methods
3. **Calculate trading statistics** and performance metrics
4. **Provide REST APIs** for the frontend application
5. **Manage user profiles** and preferences
6. **Support trade journaling** with notes and chart attachments
7. **Display public leaderboards** for users who opt-in

### Technology Stack

- **Python 3.11**: Excel file processing (`trades-data`)
- **Node.js 20.x**: All other Lambda functions
- **DynamoDB**: NoSQL database for all data storage
- **S3**: File uploads, chart storage, and data archival
- **Cognito**: User authentication and authorization
- **API Gateway**: REST API endpoints
- **EventBridge**: Scheduled task triggers

---

## Lambda Functions

### 1. tiltedtrades-dev-trades-data

**Runtime**: Python 3.11
**Trigger**: S3 Object Created event (when user uploads Excel file to `users/{userId}/uploads/`)
**Purpose**: Core data processing pipeline that transforms uploaded Excel trading data into normalized execution records.

#### Processing Pipeline

1. **File Validation**: Validates Excel file format and required columns
2. **Original Data Archive**: Saves raw data to S3 for audit trail
3. **Data Transformation**: Normalizes column names and data types
4. **JSON Conversion**: Converts each row to a `TradingExecution` record with:
   - Symbol conversion (CQG symbol → standard ticker like MES)
   - Position tracking (determines if trade is opening/closing)
   - Notional value calculation using tick values
   - Fee calculation (no longer uses historical tier dates - uses fixed tier 3)
   - P&L Per Position calculation for Per Position matching
5. **Processed Data Archive**: Saves processed JSON to S3
6. **DynamoDB Write**: Batch writes all execution records
7. **Lambda Invocation**: Asynchronously triggers `trading-data-processor` for trade matching

#### Input Data

Expects Excel file with columns including:
- `Orders_Transactions_TransactionID` (becomes `DBKey`)
- `Orders_OrderFills_TradingDay`
- `Orders_OrderFills_OrderFilledTime`
- `Orders_OrderFills_SymbolCommodity` (CQG symbol)
- `Orders_OrderFills_PositionEffect`
- `Orders_OrderFills_Side`
- `Orders_OrderFills_Quantity`
- `Orders_OrderFills_ExecutionPrice`

#### Output

- **TradingExecutions table**: One record per execution with normalized fields
- **S3 archives**: Original and processed JSON files

#### Key Files

- `tradesData.py` - Main handler orchestrating the pipeline
- `handlers/validation.py` - File validation logic
- `handlers/transformation.py` - Data normalization
- `handlers/json_conversion.py` - Core conversion logic with historical context
- `handlers/dynamodb.py` - Batch write operations
- `models/trading_execution.py` - TradingExecution data model
- `utils/config.py` - Configuration settings
- `utils/historical_context.py` - Fetches existing positions for incremental uploads

#### DynamoDB Tables Accessed

- **TradingExecutions**: Write (batch)
- **Read for historical context**: Fetches previous executions for position tracking

---

### 2. tiltedtrades-dev-trading-data-processor

**Runtime**: Node.js 20.x
**Trigger**:
- Direct invocation from `trades-data` Lambda (primary)
- DynamoDB Stream from TradingExecutions table (backup/incremental)

**Purpose**: Matches executions into complete trades using FIFO and Per Position methods, then calculates trading statistics.

#### Processing Logic

1. **Determine Trigger Type**: Direct invocation or DynamoDB stream
2. **Fetch User Preferences**: Get calculation method and commission tier
3. **Load All Executions**: Query all executions for the user from DynamoDB
4. **Sort Chronologically**: Order by Date + Time for accurate FIFO
5. **Calculate BOTH Methods** (Hybrid Approach):
   - **FIFO Matching**: Creates one trade per entry-exit contract pair
   - **Per Position Matching**: Creates one trade per complete position cycle
6. **Delete Old Trades**: Remove existing matched trades for recalculation
7. **Write New Trades**: Store both FIFO and Per Position results
8. **Calculate Statistics**: Using user's preferred method
9. **Update Stats Table**: Store aggregated metrics

#### Trade Matching Methods

**FIFO (First In First Out)**:
- Matches entries to exits chronologically
- One trade record per contract-to-contract match
- Example: 3 entry contracts + 1 exit of 3 → 3 separate trade records
- Commission: Round-trip per matched contract ($1.20 for MES at tier 3)

**Per Position**:
- Uses broker's Status field and PnLPerPosition
- One trade record per complete position lifecycle (open → close)
- Example: Multiple entries + multiple exits = 1 trade record
- Commission: Sum of all fees in the position

#### DynamoDB Tables Accessed

- **TradingExecutions**: Read (query all user's executions)
- **UserPreferences**: Read (get calculation method, commission tier)
- **MatchedTrades**: Delete (old trades), Write (new trades)
- **TradingStats**: Write (aggregated statistics)

#### Sort Key Format for MatchedTrades

```
calculationMethod_tradeId = "fifo#entryDBKey_exitDBKey_index"
calculationMethod_tradeId = "perPosition#entryDBKey_exitDBKey_index"
```

---

### 3. tiltedtrades-dev-stats-calculator

**Runtime**: Node.js 20.x
**Trigger**: EventBridge scheduled rule (nightly at 2 AM UTC)

**Purpose**: Batch recalculates statistics for ALL users. Serves as both a nightly sync and a backup if real-time calculation fails.

#### Processing Logic

1. **Get All Users**: Scan UserProfiles table for all registered users
2. **For Each User**:
   - Get user's preferred calculation method from preferences
   - Fetch all matched trades (using preferred method prefix)
   - Calculate comprehensive metrics using StatisticsCalculator
   - Save to TradingStats table
   - Update UserProfile with summary stats (totalTrades, totalPL, winRate)

#### Metrics Calculated

- Total trades, winning trades, losing trades, breakeven trades
- Win rate (percentage)
- Average win, average loss
- Largest win, largest loss
- Gross P&L (before commission)
- Net P&L (after commission)
- Total commission paid
- Profit factor
- Expectancy
- Maximum drawdown (dollars and percentage)

#### DynamoDB Tables Accessed

- **UserProfiles**: Scan (get all users), Update (summary stats)
- **UserPreferences**: Read (calculation method)
- **MatchedTrades**: Query (user's trades by method)
- **TradingStats**: Write (calculated metrics)

---

### 4. tiltedtrades-dev-file-upload-handler

**Runtime**: Node.js 20.x
**Trigger**: API Gateway POST request to `/api/users/{userId}/upload`

**Purpose**: Generates presigned S3 URLs for direct browser-to-S3 file uploads, avoiding Lambda payload limits for large files.

#### Request Flow

1. **Validate User**: Ensure authenticated user matches requested userId
2. **Validate Request**: Check filename, file type (.xlsx, .xls, .csv), and size (max 50MB)
3. **Generate S3 Key**: `users/{userId}/uploads/{timestamp}_{sanitizedFilename}`
4. **Create Presigned URL**: 5-minute expiration for PUT operation
5. **Optional Email Notification**: If user has notifications enabled, send upload started email
6. **Return Response**: Presigned URL, S3 key, bucket name, expiration

#### Security Features

- Cognito JWT validation (userId must match authenticated user)
- File type whitelist
- File size limit
- Short-lived presigned URLs (5 minutes)

#### DynamoDB Tables Accessed

- **UserProfiles**: Read (get user for notification preferences)

#### AWS Services Used

- **S3**: Generate presigned URL
- **SES**: Send notification email (optional)

---

### 5. tiltedtrades-dev-user-profile-api

**Runtime**: Node.js 20.x
**Trigger**: API Gateway requests to `/api/users/{userId}/*`

**Purpose**: Comprehensive REST API for user data management including profiles, preferences, and trade data queries.

#### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/profile` | Get user profile |
| PUT | `/profile` | Update profile (displayName, isPublic, bio, location, accountStartingBalance) |
| GET | `/preferences` | Get user preferences |
| PUT | `/preferences` | Update preferences (calculationMethod, commissionTier, timezone, etc.) |
| GET | `/executions` | Query execution records with optional date range |
| GET | `/trades` | Query matched trades by calculation method (fifo/perPosition) |
| GET | `/stats` | Get trading statistics by period (ALL, DAILY, WEEKLY, MONTHLY) |
| POST | `/sync` | Placeholder for future broker API sync |

#### Security

- All endpoints require authentication
- userId in path must match authenticated Cognito user

#### DynamoDB Tables Accessed

- **UserProfiles**: Read/Update
- **UserPreferences**: Read/Update
- **TradingExecutions**: Query
- **MatchedTrades**: Query
- **TradingStats**: Read

---

### 6. tiltedtrades-dev-trade-journal-api

**Runtime**: Node.js 20.x
**Trigger**: API Gateway requests to `/api/users/{userId}/trades/{tradeId}/journal*`

**Purpose**: CRUD operations for trade journals including text notes, tags, and chart/screenshot attachments.

#### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/trades/{tradeId}/journal` | Get journal for specific trade |
| POST | `/trades/{tradeId}/journal` | Create or update journal entry |
| DELETE | `/trades/{tradeId}/journal` | Delete journal and associated charts |
| POST | `/trades/{tradeId}/journal/charts` | Get presigned URL for chart upload |
| DELETE | `/trades/{tradeId}/journal/charts/{chartId}` | Delete specific chart |
| GET | `/journals` | List all journals with filtering (tags, symbol) |

#### Journal Entry Structure

- `journalText`: Free-form text notes
- `tags`: Array of lowercase tags for categorization
- `chartReferences`: Array of chart attachments
  - Type: `uploaded`, `tradingview`, or `internal`
  - S3 key for uploaded images
  - URL for TradingView charts

#### Chart Upload Flow

1. Frontend requests presigned URL via POST to `/journal/charts`
2. Lambda generates URL with S3 path: `users/{userId}/journal/charts/{tradeId}/{chartId}.{ext}`
3. Frontend uploads directly to S3 using presigned URL
4. Frontend calls POST `/journal` to save chart reference metadata

#### DynamoDB Tables Accessed

- **TradeJournals**: CRUD operations
- **MatchedTrades**: Read (verify trade exists before creating journal)

#### AWS Services Used

- **S3**: Presigned URLs for chart upload, delete chart objects

---

### 7. tiltedtrades-dev-public-profiles-api

**Runtime**: Node.js 20.x
**Trigger**: API Gateway requests to `/api/public/profiles*` (NO authentication required)

**Purpose**: Public endpoints for leaderboard display and public profile viewing. Only shows data for users who have opted in (`isPublic = true`).

#### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/profiles` | Leaderboard - list public profiles sorted by performance |
| GET | `/profiles/{userId}` | Single public profile details |

#### Leaderboard Query Parameters

- `limit`: Number of profiles to return (default: 50)
- `sortBy`: Ranking metric - `totalPL`, `winRate`, or `totalTrades`

#### Public Profile Fields

Only non-sensitive data is exposed:
- userId
- displayName
- bio
- location
- totalTrades
- totalPL
- winRate
- createdAt
- rank (calculated)

#### Privacy

- Users must explicitly set `isPublic = true` in their profile
- Private profiles return 403 Forbidden
- Sensitive fields (email, account balance) are never exposed

#### DynamoDB Tables Accessed

- **UserProfiles**: Query LeaderboardIndex GSI (isPublic = true), Read individual profiles

---

### 8. tiltedtrades-dev-post-registration-trigger

**Runtime**: Node.js 20.x
**Trigger**: Cognito Post-Confirmation event (after user verifies email/phone)

**Purpose**: Initialize new user accounts with default profile and preferences immediately after registration.

#### Processing Logic

1. **Extract User Data**: Get userId (sub), email, and name from Cognito event
2. **Create User Profile**: Insert into UserProfiles with defaults:
   - `isPublic`: false
   - `totalTrades`: 0
   - `totalPL`: 0
   - `winRate`: 0
   - `accountStartingBalance`: 0
3. **Create User Preferences**: Insert into UserPreferences with defaults:
   - `calculationMethod`: 'fifo'
   - `commissionTier`: 'fixed'
   - `timezone`: 'America/New_York'
   - `dateFormat`: 'MM/DD/YYYY'
   - `currency`: 'USD'
   - Notification and display preferences

#### Idempotency

Uses `ConditionExpression: 'attribute_not_exists(userId)'` to prevent overwriting if record already exists (handles retries).

#### Error Handling

Errors are logged but do not fail the registration - returns event to allow Cognito to complete the sign-up flow.

#### DynamoDB Tables Accessed

- **UserProfiles**: Write (create)
- **UserPreferences**: Write (create)

---

## Shared Calculations Layer

**Location**: `lambda-layers/calculations/nodejs/node_modules/@tiltedtrades/calculations/dist/`

A shared Lambda Layer containing reusable calculation logic used by multiple Lambda functions.

### Exported Modules

#### TradeMatchingEngine

Matches executions into complete trades using two methods:

**FIFO Matching (`matchTrades(executions, 'fifo', tier)`)**:
- Groups executions by symbol
- Sorts by DBKey (chronological)
- Uses PositionEffect to determine opening/closing
- Creates one trade per contract-to-contract match
- Calculates commission per matched contract

**Per Position Matching (`matchTrades(executions, 'perPosition', tier)`)**:
- Uses Status field ("To Open", "To Close")
- Uses PositionQty to detect position close (= 0)
- Creates one trade per complete position lifecycle
- Uses PnLPerPosition from broker when available
- Sums all fees for commission

#### CommissionCalculator

Calculates trading commissions based on symbol and tier.

- Loads commission rates from `data/commissions.json`
- Default brokerage: AMP
- Default tier: 'fixed' (uses tier 3 rates)
- Returns round-trip commission (entry + exit)
- Commission is always negative (cost)

Example rates for MES:
- Tier 1: $0.62/side ($1.24 round-trip)
- Tier 3/Fixed: $0.60/side ($1.20 round-trip)

#### StatisticsCalculator

Calculates comprehensive trading metrics from matched trades:

- Trade counts (total, winning, losing, breakeven)
- Win rate percentage
- P&L metrics (gross, net, commission)
- Profit factor
- Expectancy
- Maximum drawdown (dollars and percentage)
- Helper methods: getCumulativePL, getDailyPL, getMonthlyPL, getPerformanceBySymbol

#### ContractSpecsCalculator

Provides futures contract specifications:

- Loads from `data/tick-values.json`
- Returns point value (dollars per 1.0 point move)
- Returns tick size and tick value
- Supports all major futures symbols (ES, MES, NQ, MNQ, etc.)

### Data Files in Layer

- `data/commissions.json` - Commission rates by symbol and tier
- `data/tick-values.json` - Contract specifications (point values, tick sizes)

---

## DynamoDB Tables Reference

### TradingExecutions

Stores individual execution records from trading platform exports.

| Attribute | Type | Description |
|-----------|------|-------------|
| userId (PK) | String | Cognito user ID |
| executionId (SK) | String | Unique execution identifier |
| DBKey | Number | TransactionID from original data |
| Ticker | String | CQG symbol |
| TickerConversion | String | Standardized symbol (e.g., MES) |
| TradingDay | String | Date (YYYY-MM-DD) |
| Date | String | Formatted date |
| Time | String | Execution time |
| Side | String | Buy or Sell |
| Quantity | Number | Number of contracts |
| ExecutionPrice | Number | Fill price |
| PositionEffect | Number | Position change (+opening, -closing) |
| PositionQty | Number | Position quantity after execution |
| Status | String | "To Open", "To Close", etc. |
| Fees | Number | Commission (negative) |
| NotionalValue | Number | Calculated value |
| PnLPerPosition | Number | Broker-provided P&L |

### MatchedTrades

Stores matched trades from both calculation methods.

| Attribute | Type | Description |
|-----------|------|-------------|
| userId (PK) | String | Cognito user ID |
| calculationMethod_tradeId (SK) | String | Format: `{method}#{tradeId}` |
| calculationMethod | String | 'fifo' or 'perPosition' |
| tradeId | String | Unique trade identifier |
| symbol | String | Trading symbol |
| side | String | 'Long' or 'Short' |
| entryDate | String | ISO timestamp |
| exitDate | String | ISO timestamp |
| entryPrice | Number | Average entry price |
| exitPrice | Number | Average exit price |
| quantity | Number | Number of contracts |
| pl | Number | Net P&L (includes commission) |
| plPercent | Number | P&L percentage |
| duration | Number | Trade duration in minutes |
| commission | Number | Total commission (negative) |
| status | String | 'closed' |
| executionIds | List | Array of DBKeys |

### TradingStats

Stores aggregated trading statistics.

| Attribute | Type | Description |
|-----------|------|-------------|
| userId (PK) | String | Cognito user ID |
| statsType (SK) | String | 'ALL', 'DAILY', 'WEEKLY', 'MONTHLY' |
| lastCalculatedAt | String | ISO timestamp |
| totalTrades | Number | Total closed trades |
| winningTrades | Number | Profitable trades |
| losingTrades | Number | Losing trades |
| breakevenTrades | Number | Breakeven trades |
| winRate | Number | Win percentage |
| grossPL | Number | P&L before commission |
| totalPL | Number | Net P&L |
| totalCommission | Number | Commission paid (negative) |
| profitFactor | Number | Gross profit / gross loss |
| expectancy | Number | Average P&L per trade |
| maxDrawdown | Number | Maximum drawdown in dollars |
| maxDrawdownPercent | Number | Maximum drawdown percentage |

### UserProfiles

Stores user profile information.

| Attribute | Type | Description |
|-----------|------|-------------|
| userId (PK) | String | Cognito user ID |
| dataType (SK) | String | 'PROFILE' |
| email | String | User email |
| displayName | String | Display name |
| isPublic | Boolean | Leaderboard opt-in |
| bio | String | User bio |
| location | String | User location |
| accountStartingBalance | Number | Starting account balance |
| totalTrades | Number | Summary stat |
| totalPL | Number | Summary stat |
| winRate | Number | Summary stat |
| createdAt | String | Account creation date |
| updatedAt | String | Last update date |

**GSI**: LeaderboardIndex (isPublic = true, sorted by totalPL)

### UserPreferences

Stores user preferences and settings.

| Attribute | Type | Description |
|-----------|------|-------------|
| userId (PK) | String | Cognito user ID |
| preferenceKey (SK) | String | 'DEFAULT' |
| calculationMethod | String | 'fifo' or 'perPosition' |
| commissionTier | String | 'fixed', '1', '2', '3', '4' |
| timezone | String | User timezone |
| dateFormat | String | Date display format |
| currency | String | Currency code |
| notificationPreferences | Map | Email notification settings |
| displayPreferences | Map | UI preferences |

### TradeJournals

Stores trade journal entries.

| Attribute | Type | Description |
|-----------|------|-------------|
| userId (PK) | String | Cognito user ID |
| tradeId (SK) | String | Associated trade ID |
| journalText | String | Journal notes |
| tags | List | Array of tags |
| chartReferences | List | Array of chart attachments |
| calculationMethod | String | 'fifo' or 'perPosition' |
| symbol | String | Trade symbol |
| exitDate | String | Trade exit date |
| createdAt | String | Journal creation date |
| updatedAt | String | Last update date |

**GSI**: UserDateIndex (userId, sorted by exitDate)

---

## Data Flow Diagrams

### File Upload and Processing Flow

```
User uploads Excel file via React App
            ↓
file-upload-handler Lambda
  → Generates presigned S3 URL
  → Returns URL to frontend
            ↓
Browser uploads directly to S3
  → S3 bucket: users/{userId}/uploads/{filename}
            ↓
S3 triggers trades-data Lambda
  → Validates Excel file
  → Transforms and normalizes data
  → Writes to TradingExecutions table
  → Invokes trading-data-processor (async)
            ↓
trading-data-processor Lambda
  → Fetches all user executions
  → Matches trades (FIFO + Per Position)
  → Deletes old MatchedTrades
  → Writes new MatchedTrades
  → Calculates statistics
  → Updates TradingStats
```

### Nightly Stats Recalculation Flow

```
EventBridge (2 AM UTC)
            ↓
stats-calculator Lambda
  → Scans all users from UserProfiles
  → For each user:
      → Get preferences (calculation method)
      → Query MatchedTrades
      → Calculate metrics
      → Update TradingStats
      → Update UserProfile summary
```

### User Registration Flow

```
User signs up via Cognito
            ↓
Email/phone verification
            ↓
Cognito Post-Confirmation trigger
            ↓
post-registration-trigger Lambda
  → Creates UserProfile record
  → Creates UserPreferences record
  → Returns event to Cognito
            ↓
User can now log in and use the app
```

---

*End of Functionality Summary*
