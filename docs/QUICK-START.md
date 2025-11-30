# TiltedTrades - Quick Start Guide

## First Time Setup (One-Time Only)

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Generate Data from Excel**
   ```bash
   npm run refresh-data
   ```

3. **Create Desktop Shortcut**
   - Double-click `create-shortcut.bat`
   - A shortcut will appear on your desktop

## Daily Use

### Starting TiltedTrades

**Easy Way:**
- Double-click the **TiltedTrades** shortcut on your desktop
- The server starts automatically
- Chrome opens to your trading journal
- **When you close Chrome, the server automatically stops**

**Manual Way:**
```bash
npm run dev
```
Then manually open: http://localhost:3000

### Updating Your Trading Data

When you add new trades to your Excel file:

1. Save your Excel file
2. Run: `npm run refresh-data`
3. Refresh the browser (or it auto-reloads)

## How the Auto-Shutdown Works

The desktop shortcut uses a completely self-contained launcher that:

1. ✅ Runs silently with NO console windows visible
2. ✅ Starts the Node.js development server in the background
3. ✅ Waits for the server to be ready
4. ✅ Opens Chrome in app mode (looks like a standalone app)
5. ✅ Monitors the Chrome process continuously
6. ✅ **When you close Chrome (click the X), the server automatically stops**
7. ✅ Cleans up all processes and frees up system resources

**Everything is self-contained:** Just close the Chrome window and everything stops automatically - no console windows, no manual cleanup needed!

## Navigation Features

### Sidebar Navigation
- **Collapsed:** Shows only icons (64px wide)
- **Expanded:** Shows icons + labels (240px wide)
- **Toggle:** Click the chevron button at the bottom of the sidebar

### P&L Calculation Methods
Toggle between FIFO and Per-Position at the bottom of the sidebar:
- **FIFO:** First In First Out matching
- **Per Position:** Uses broker's PnLPerPosition data

## Available Pages

- **Dashboard:** Overview metrics, charts, and performance
- **Trade Log:** Detailed list of all trades
- **Balance:** Account balance tracking over time
- **Journals:** Trade journal entries and notes
- **Analytics:** Advanced analytics and statistics
- **Calendar:** Calendar view of trading activity
- **Settings:** Application preferences

## Troubleshooting

### Server won't start
- Check if port 3000 is already in use
- Try closing Chrome and other apps
- Restart your computer

### Data not updating
1. Save your Excel file
2. Run `npm run refresh-data`
3. Check the console for errors
4. Verify the Excel file path in `scripts/excel-to-json.js`

### Shortcut not working
1. Make sure you ran `npm install` first
2. Try running `start-tiltedtrades.bat` directly
3. Check if Chrome is installed at the default location

### Server keeps running after Chrome closes
- The monitoring script checks every 2 seconds
- It should stop within moments of closing Chrome
- Check Task Manager for any lingering node.exe processes if needed

## Files Overview

- `create-shortcut.bat` - Creates the desktop shortcut (double-click this first)
- `start-tiltedtrades.vbs` - Hidden launcher (no console windows)
- `launcher.js` - Node.js script that manages server lifecycle
- `scripts/excel-to-json.js` - Converts Excel to JSON
- `src/assets/trading-data-local.json` - Your trading data (auto-generated)

## Need Help?

Check the full README.md for detailed documentation or contact support.
