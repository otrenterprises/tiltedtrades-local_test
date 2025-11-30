# TiltedTrades Feature Documentation

This document consolidates all feature implementation details for the TiltedTrades trading analytics platform.

---

## Journal Feature

### Overview
Complete journal entry functionality allowing users to create, view, and manage trade journal entries with notes, tags, and chart uploads.

### Capabilities
- Full CRUD operations for journal entries
- Chart/image management with S3 storage
- Tag management and filtering
- Search and filter by date range
- Quick entry modal from Trade Log
- Auto-expansion from URL parameters

### Data Structure
```typescript
interface TradeJournal {
  userId: string
  tradeId: string
  journalText: string
  tags: string[]
  chartReferences: ChartReference[]
  createdAt: string
  updatedAt: string
}

interface ChartReference {
  chartId: string
  s3Key: string
  fileName: string
  caption?: string
  uploadedAt: string
}
```

### Usage
1. Navigate to Trade Log (`/app/trades`)
2. Click the **+ icon** in the Journal column
3. Enter notes, add tags (optional), upload chart (optional)
4. Click **"Save Journal"** or **"Open Full Editor"**

### API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/users/:userId/journals` | GET | List all journals |
| `/api/users/:userId/trades/:tradeId/journal` | GET/POST/DELETE | Journal CRUD |
| `/api/users/:userId/trades/:tradeId/journal/charts` | POST | Get chart upload URL |

---

## Trade Detail Page

### Features
- Complete execution history view
- P&L breakdown (gross/net)
- Commission details
- Entry/exit price analysis
- Duration calculation (hours, minutes, seconds)
- Journal integration

---

## API Integration

### Data Flow
- **Before**: `trading-data-local.json → LocalExcelDataService → TradeMatchingEngine → Components`
- **After**: `AWS API Gateway → API Services → React Query Hooks → Components`

### Trade Data Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/users/:userId/executions` | GET | Fetch raw execution records |
| `/api/users/:userId/trades?method={fifo\|perPosition}` | GET | Fetch matched trades |
| `/api/users/:userId/stats?period={ALL}` | GET | Fetch pre-calculated statistics |

### User Profile Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/users/:userId/profile` | GET/PUT | User profile |
| `/api/users/:userId/preferences` | GET/PUT | User preferences |

### Key Changes
- Trade matching handled server-side (no client-side calculation needed)
- Statistics pre-calculated in DynamoDB
- Instant switching between FIFO and Per Position views

---

## File Upload

### Upload Flow
1. User selects file in FileUploadModal
2. Frontend validates file (size, type)
3. Frontend requests presigned URL from API
4. Direct upload to S3 using presigned URL
5. S3 triggers trades-data Lambda
6. Lambda processes Excel → DynamoDB
7. trading-data-processor calculates trades and stats

### Validation Rules
- **Excel files**: Max 50MB, extensions .xlsx/.xls/.csv
- **Images**: Max 10MB, types image/png, image/jpeg, image/webp

### API Endpoint
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/users/:userId/upload` | POST | Get presigned S3 URL for upload |

---

## Balance Tracking

### Features
- Trading P&L from matched trades
- Manual balance entries (deposits, withdrawals, fees)
- Running balance calculation
- Balance history view

### Note
LocalBalanceService still used for manual entries - not fully migrated to API.

---

## Public Leaderboard

### Features
- Public profiles display without authentication
- Sorting by totalPL, winRate, totalTrades
- Anonymized usernames

### API Endpoint
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/public/profiles` | GET | Get public leaderboard (no auth) |

---

## Dashboard

### Statistics Displayed
- Total P&L (Net and Gross toggle)
- Win Rate
- Total Trades
- Profit Factor
- Average Win/Loss
- Best/Worst Trade
- Win/Loss streak

### Data Sources
- Trade data from MatchedTrades table
- Statistics calculated client-side for commission override support
- Supports both FIFO and Per Position methods

---

## Analytics

### Charts
- Equity Curve (cumulative P&L over time)
- P&L Distribution histogram
- Win Rate by symbol
- Performance by day of week
- Performance by time of day

### Features
- Date range filtering
- Symbol filtering
- Gross/Net P&L toggle
- FIFO/Per Position method switch

---

## Calendar

### Features
- Daily P&L view in calendar format
- Color-coded days (green=profit, red=loss)
- Monthly/weekly navigation
- Click to view day's trades

---

## Navigation

### Features
- Upload Data button (blue, prominent)
- P&L method toggle (FIFO/Per Position)
- User info section with email display
- Sign Out button (only when sidebar expanded)
- Responsive collapsed/expanded states

---

## Known Limitations

### Journal
- Chart images stored in S3 (requires auth)
- No rich text editor (plain text only)
- No versioning for concurrent edits

### Balance
- Manual entries stored locally
- No server sync for manual entries

### General
- Single user environment (no multi-tenancy)
- Commission overrides client-side only

---

*Last Updated: November 29, 2025*
