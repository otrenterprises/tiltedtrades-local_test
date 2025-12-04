# Site Info Panel - Implementation Guide

**Created**: December 4, 2025
**Status**: Ready for implementation
**Wireframe**: `docs/wireframes/SITE_INFO_WIREFRAME.md`

---

## Summary

Add a "Site Info" tab to the Settings page as the **last tab** in the navigation. This provides first-time users with a quick overview of the application's features and upload requirements.

---

## Implementation Steps

### Step 1: Update Settings.tsx

**File**: `src/pages/Settings/Settings.tsx`

1. Add new import for `Info` icon from Lucide:
```tsx
import { Settings as SettingsIcon, User, Shield, Bell, Palette, Key, Info } from 'lucide-react'
```

2. Add `'siteinfo'` to the `TabType` union:
```tsx
type TabType = 'general' | 'preferences' | 'privacy' | 'notifications' | 'api' | 'siteinfo'
```

3. Add new tab object to `tabs` array (at the end):
```tsx
{
  id: 'siteinfo',
  label: 'Site Info',
  icon: <Info className="w-4 h-4" />,
  description: 'Quick guide to TiltedTrades features',
},
```

4. Add case to `renderPanel()` switch:
```tsx
case 'siteinfo':
  return <SiteInfoPanel />
```

5. Add import for new panel:
```tsx
import SiteInfoPanel from './SiteInfoPanel'
```

---

### Step 2: Create SiteInfoPanel.tsx

**File**: `src/pages/Settings/SiteInfoPanel.tsx`

Create new component with these sections:

#### Section Structure:
1. **Navigation Toggles** - 2-column grid explaining Net/Gross and FIFO/Per Position
2. **Main Sections** - 6 cards for Dashboard, Trade Log, Balance, Journals, Analytics, Calendar
3. **Uploading Your Data** - File requirements + Quick Start steps

#### Key Content:

**P&L Display Toggle:**
- Net: P&L after commissions deducted. Your actual realized profit.
- Gross: P&L before commissions. Raw trading performance.

**P&L Method Toggle:**
- FIFO: First-In, First-Out. Entries matched with exits chronologically.
- Per Position: Groups all entries/exits for same symbol into single trades.

**File Upload Requirements (CRITICAL):**
- Must be Statement Report from CQG QTrader
- Downloaded from: QTrader → Reports → Statement Report
- All columns must be included (no hiding/removing)
- NOT modified after download (sheet name + headers must match)
- Format: .xlsx or .xls only
- System validates sheet name and column headers - modified files will fail

---

### Step 3: Styling Reference

Use existing Settings page patterns:
- Container: `bg-gray-900 rounded-lg p-6`
- Section headers: `text-lg font-semibold text-white mb-4`
- Card borders: `border border-gray-700`
- Labels: `text-xs text-gray-400`
- Body text: `text-sm text-gray-300`
- Warning/Important: `text-yellow-400` or `bg-yellow-900/20`

Icons to use (from Lucide):
- Dashboard: `BarChart3`
- Trade Log: `List`
- Balance: `Wallet`
- Journals: `BookOpen`
- Analytics: `TrendingUp`
- Calendar: `Calendar`
- Warning: `AlertTriangle`

---

## Files to Modify/Create

| File | Action |
|------|--------|
| `src/pages/Settings/Settings.tsx` | Modify - add tab + import |
| `src/pages/Settings/SiteInfoPanel.tsx` | **CREATE** - new panel component |

---

## Component Template

```tsx
// src/pages/Settings/SiteInfoPanel.tsx
import { BarChart3, List, Wallet, BookOpen, TrendingUp, Calendar, AlertTriangle } from 'lucide-react'

export default function SiteInfoPanel() {
  return (
    <div className="space-y-6">
      {/* Navigation Toggles Section */}
      <div className="bg-gray-900 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Navigation Toggles</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Net/Gross Card */}
          {/* FIFO/Per Position Card */}
        </div>
      </div>

      {/* Main Sections */}
      <div className="bg-gray-900 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Main Sections</h3>
        <div className="space-y-4">
          {/* 6 section cards */}
        </div>
      </div>

      {/* Upload Requirements */}
      <div className="bg-gray-900 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Uploading Your Data</h3>
        {/* Warning box + requirements + quick start */}
      </div>
    </div>
  )
}
```

---

## Testing Checklist

- [ ] Tab appears last in Settings navigation
- [ ] Panel renders correctly on desktop
- [ ] Panel renders correctly on mobile (stacked cards)
- [ ] All icons display properly
- [ ] Links/text are readable
- [ ] No TypeScript errors

---

## Reference Files

- Settings page structure: `src/pages/Settings/Settings.tsx`
- Existing panel example: `src/pages/Settings/GeneralPanel.tsx`
- Site architecture: `docs/ClaudeThoughts/SITE_MAP.md`
- Wireframe: `docs/wireframes/SITE_INFO_WIREFRAME.md`

---

*Ready for next conversation to implement*
