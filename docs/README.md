# TiltedTrades Local Test Environment

This is a standalone local testing environment for the TiltedTrades web application. It reads trading data from your local Excel workbook and displays it in the web interface **without** requiring any AWS services.

## Features

✅ **Local Excel Data Source**: Reads from your `Ongoing Original Orders.xlsx` file
✅ **No AWS Required**: Bypasses authentication and AWS services
✅ **Client-Side Calculations**: FIFO and Per-Position trade matching
✅ **Full UI/UX**: All dashboard, charts, and analytics features
✅ **Fast Refresh**: Update Excel → Run script → See changes instantly

## Initial Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Generate Initial Data

```bash
npm run refresh-data
```

This will:
- Read your Excel file from: `C:\Users\ccfic\OneDrive\Documents\All Things Trading\Live Trading\CQG\Ongoing Original Orders.xlsx`
- Parse the "RunningTotals" worksheet
- Convert dates from Excel serial numbers to readable format
- Output JSON to: `src/assets/trading-data-local.json`

### 3. Start Development Server

**Option A: Using Desktop Shortcut (Recommended)**

1. Double-click `create-shortcut.bat` to create a desktop shortcut
2. Double-click the "TiltedTrades" shortcut on your desktop
3. The server starts automatically and Chrome opens
4. When you close Chrome, the server automatically shuts down

**Option B: Manual Start**

```bash
npm run dev
```

The app will open at: http://localhost:3000

**Note:** With manual start, you need to manually stop the server (Ctrl+C) when done.

## Daily Workflow

### Updating Data

When you add new trades to your Excel file:

```bash
npm run refresh-data
```

The browser will automatically reload with the new data.

## Configuration

### Excel File Location

Edit `scripts/excel-to-json.js` to change the source file:

```javascript
const EXCEL_PATH = 'C:\\Path\\To\\Your\\Excel\\File.xlsx';
const SHEET_NAME = 'RunningTotals';
```

### Calculation Method

Switch between FIFO and Per-Position calculations using the toggle in the navigation bar.

## Project Structure

```
local_test/
├── src/
│   ├── components/       # UI components (from main app)
│   ├── pages/            # Dashboard, Trade Log, Analytics, etc.
│   ├── utils/            # Trade matching engine, calculations
│   ├── services/
│   │   └── LocalExcelDataService.ts   # Loads JSON data
│   ├── contexts/
│   │   └── MockAuthContext.tsx        # Bypasses AWS Cognito
│   ├── assets/
│   │   ├── trading-data-local.json    # Generated from Excel
│   │   ├── commissions.json
│   │   └── tick-values.json
│   └── App.tsx           # Modified to use local services
├── scripts/
│   └── excel-to-json.js  # Excel → JSON converter
├── package.json
└── .env.local            # Local environment variables
```

## What Gets Tested

✅ **Data Display**: Dashboard metrics, charts, trade log
✅ **Calculations**: FIFO vs Per-Position trade matching
✅ **UI Components**: All React components work identically
✅ **Visualizations**: Equity curve, monthly performance, etc.
✅ **Filtering**: By date range, symbol, trade type

## What's NOT Tested

❌ **File Upload**: S3 presigned URLs
❌ **Authentication**: AWS Cognito login/signup
❌ **API Calls**: DynamoDB queries via API Gateway
❌ **Lambda Processing**: Backend trade processing
❌ **Multi-User**: User isolation and permissions

## Troubleshooting

### Error: "Failed to load trading data"

Run `npm run refresh-data` to generate the JSON file.

### Error: "Sheet 'RunningTotals' not found"

Check that your Excel file has a sheet named "RunningTotals" or update the `SHEET_NAME` in `scripts/excel-to-json.js`.

### Dates showing as numbers

Make sure you're running the latest version of the refresh script, which converts Excel date serial numbers.

### Changes not appearing

1. Make sure you saved the Excel file
2. Run `npm run refresh-data`
3. Refresh the browser (or wait for auto-reload)

## Data Format

The Excel data should match the DynamoDB TradingExecutions table structure:

- **Date**: Trading date (MM/DD/YYYY)
- **Time**: Execution time (HH:MM:SS)
- **TickerConversion**: Symbol (ES, NQ, etc.)
- **Side**: Buy or Sell
- **Quantity**: Number of contracts
- **ExecutionPrice**: Fill price
- **PositionEffect**: 1 (open) or -1 (close)
- **OrderType**: Limit, Stop, or Market
- And other execution fields...

## Scripts

### NPM Scripts
- `npm run refresh-data` - Convert Excel to JSON
- `npm run dev` - Start development server (auto-refreshes data)
- `npm run build` - Build for production (refreshes data first)
- `npm run preview` - Preview production build

### Launcher Scripts
- `create-shortcut.bat` - Creates a desktop shortcut for easy access
- `start-tiltedtrades.bat` - Starts server and opens Chrome (auto-shutdown when Chrome closes)

## Notes

- This environment is completely isolated from the production codebase
- No changes made here will affect the main `tiltedtrades.com` folder
- Authentication is automatically bypassed (you're logged in as "test@local.dev")
- All data is loaded from the local JSON file, not AWS

## Optional Features

### Re-enabling Leaderboard (Multi-User Feature)

The Leaderboard and Public Profile features are commented out for local testing since they require multi-user functionality. To re-enable them:

1. **Uncomment Navigation Link** in `src/components/layout/Navigation.tsx`:
   ```typescript
   const navLinks = [
     // ... other links ...
     { to: '/app/leaderboard', icon: Trophy, label: 'Leaderboard' }, // Uncomment this line
     // ... other links ...
   ]
   ```

2. **Uncomment Imports** in `src/App.tsx`:
   ```typescript
   import { Leaderboard } from './pages/Leaderboard/Leaderboard' // Uncomment this line
   import { PublicProfile } from './pages/Profile/PublicProfile' // Uncomment this line
   ```

3. **Uncomment Routes** in `src/App.tsx`:
   ```typescript
   <Route path="/leaderboard" element={<Leaderboard />} /> // Uncomment this line
   <Route path="/profile/:userId" element={<PublicProfile />} /> // Uncomment this line
   ```

## Need Help?

Check the main project documentation or contact support.
