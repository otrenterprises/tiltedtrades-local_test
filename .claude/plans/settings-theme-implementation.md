# Settings & Theme Implementation Plan

## Overview
Implement a complete Settings page and add light/dark mode theme support throughout the application.

---

## Current State Analysis

### Theme Implementation (As-Is)
- **Tailwind Config**: `darkMode: 'class'` is configured but unused
- **CSS Variables**: Only dark mode colors defined in `:root`
- **Hardcoded Colors**: 283 instances across 56 files
- **Pattern Used**: Direct dark colors (`bg-dark-secondary`, `bg-gray-800`, `text-slate-50`)
- **Pattern NOT Used**: Tailwind's `dark:` prefix pattern

### Files with Hardcoded Dark Colors
```
src/components/layout/Navigation.tsx
src/components/layout/PageLayout.tsx
src/pages/DashboardNew.tsx
src/pages/TradeLog.tsx
src/pages/Balance.tsx
src/pages/CalendarNew.tsx
src/pages/JournalList.tsx
src/pages/JournalEditor.tsx
src/pages/AnalyticsAPI.tsx
src/pages/Settings.tsx
src/components/journal/ChartGallery.tsx
src/components/upload/FileUploadModal.tsx
... and 44 more files
```

### Common Hardcoded Patterns to Replace
| Dark Class | Light Equivalent | CSS Variable |
|------------|------------------|--------------|
| `bg-dark` / `bg-[#0F172A]` | `bg-gray-50` | `--color-bg-primary` |
| `bg-dark-secondary` / `bg-[#1E293B]` | `bg-white` | `--color-bg-secondary` |
| `bg-dark-tertiary` / `bg-gray-700` | `bg-gray-100` | `--color-bg-tertiary` |
| `border-dark-border` / `border-gray-600` | `border-gray-200` | `--color-border` |
| `text-slate-50` / `text-white` | `text-gray-900` | `--color-text-primary` |
| `text-slate-300` / `text-gray-300` | `text-gray-600` | `--color-text-secondary` |
| `text-slate-400` / `text-gray-400` | `text-gray-500` | `--color-text-tertiary` |
| `text-slate-500` / `text-gray-500` | `text-gray-400` | `--color-text-muted` |

---

## Implementation Plan

### Phase 1: CSS Variable Foundation

#### Step 1.1: Update index.css with Light/Dark Variables
```css
@layer base {
  /* Light mode (default) */
  :root {
    --color-bg-primary: #F8FAFC;      /* slate-50 */
    --color-bg-secondary: #FFFFFF;     /* white */
    --color-bg-tertiary: #F1F5F9;      /* slate-100 */
    --color-border: #E2E8F0;           /* slate-200 */

    --color-text-primary: #0F172A;     /* slate-900 */
    --color-text-secondary: #475569;   /* slate-600 */
    --color-text-tertiary: #64748B;    /* slate-500 */
    --color-text-muted: #94A3B8;       /* slate-400 */

    /* Semantic colors (same in both modes) */
    --color-profit: #10B981;
    --color-loss: #EF4444;
    --color-caution: #F59E0B;
    --color-accent: #3B82F6;
    --color-premium: #A855F7;

    /* Component-specific */
    --color-card-bg: #FFFFFF;
    --color-input-bg: #F8FAFC;
    --color-hover-bg: #F1F5F9;
  }

  /* Dark mode */
  .dark {
    --color-bg-primary: #0F172A;       /* slate-900 */
    --color-bg-secondary: #1E293B;     /* slate-800 */
    --color-bg-tertiary: #334155;      /* slate-700 */
    --color-border: #475569;           /* slate-600 */

    --color-text-primary: #F8FAFC;     /* slate-50 */
    --color-text-secondary: #CBD5E1;   /* slate-300 */
    --color-text-tertiary: #94A3B8;    /* slate-400 */
    --color-text-muted: #64748B;       /* slate-500 */

    --color-card-bg: #1E293B;
    --color-input-bg: #334155;
    --color-hover-bg: #334155;
  }
}
```

#### Step 1.2: Add Tailwind Utility Classes
```css
@layer utilities {
  /* Background utilities */
  .bg-primary { background-color: var(--color-bg-primary); }
  .bg-secondary { background-color: var(--color-bg-secondary); }
  .bg-tertiary { background-color: var(--color-bg-tertiary); }
  .bg-card { background-color: var(--color-card-bg); }
  .bg-input { background-color: var(--color-input-bg); }
  .bg-hover { background-color: var(--color-hover-bg); }

  /* Text utilities */
  .text-primary { color: var(--color-text-primary); }
  .text-secondary { color: var(--color-text-secondary); }
  .text-tertiary { color: var(--color-text-tertiary); }
  .text-muted { color: var(--color-text-muted); }

  /* Border utilities */
  .border-theme { border-color: var(--color-border); }
}
```

---

### Phase 2: Theme Context & Toggle

#### Step 2.1: Create ThemeContext
**File:** `src/contexts/ThemeContext.tsx`

```typescript
interface ThemeContextType {
  theme: 'light' | 'dark' | 'system'
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark' | 'system') => void
}
```

Features:
- Persist preference to localStorage
- Sync with user preferences API (optional)
- Respect system preference when set to 'system'
- Apply `.dark` class to `<html>` element

#### Step 2.2: Add Theme Toggle to Mobile Menu
**File:** `src/components/layout/Navigation.tsx`

Location: In the "More" bottom sheet, add toggle in settings section:
```
┌─────────────────────────────┐
│         ━━━━━━━━            │
│    Menu              [X]    │
├─────────────────────────────┤
│  Dashboard                  │
│  Calendar                   │
│  ...                        │
├─────────────────────────────┤
│  P&L Display: [Net] [Gross] │
│  P&L Method:  [FIFO] [Per]  │
│  Theme:    [☀️] [🌙] [Auto] │  ← NEW
├─────────────────────────────┤
│  user@email.com             │
│  [Sign Out]                 │
└─────────────────────────────┘
```

#### Step 2.3: Add Theme Toggle to Settings Page
**File:** `src/pages/Settings.tsx`

Location: Display/Trading section with segmented control:
- Light
- Dark
- System (auto)

---

### Phase 3: Component Migration

#### Migration Strategy
Use find/replace with manual verification. Process by category:

**Priority 1: Layout Components (High Impact)**
- [ ] `Navigation.tsx` - Sidebar and mobile nav
- [ ] `PageLayout.tsx` - Main content wrapper
- [ ] `App.tsx` - Root wrapper

**Priority 2: Page Components**
- [ ] `DashboardNew.tsx`
- [ ] `TradeLog.tsx`
- [ ] `Balance.tsx`
- [ ] `CalendarNew.tsx`
- [ ] `JournalList.tsx`
- [ ] `JournalEditor.tsx`
- [ ] `AnalyticsAPI.tsx`
- [ ] `Settings.tsx`

**Priority 3: Shared Components**
- [ ] `MetricCard.tsx`
- [ ] `FileUploadModal.tsx`
- [ ] `BalanceEntryModal.tsx`
- [ ] `ChartGallery.tsx`
- [ ] Chart components (EquityCurve, etc.)

**Priority 4: Auth Pages**
- [ ] `Login.tsx`
- [ ] `SignUp.tsx`
- [ ] `ForgotPassword.tsx`
- [ ] Other auth flows

#### Find/Replace Patterns
```
# Background replacements
bg-dark-secondary  →  bg-secondary
bg-dark-tertiary   →  bg-tertiary
bg-dark            →  bg-primary
bg-gray-800        →  bg-secondary
bg-gray-900        →  bg-primary
bg-gray-700        →  bg-tertiary
bg-[#1E293B]       →  bg-secondary
bg-[#0F172A]       →  bg-primary

# Text replacements
text-slate-50      →  text-primary
text-white         →  text-primary (context-dependent)
text-slate-300     →  text-secondary
text-slate-400     →  text-tertiary
text-gray-300      →  text-secondary
text-gray-400      →  text-tertiary
text-gray-500      →  text-muted

# Border replacements
border-dark-border →  border-theme
border-gray-600    →  border-theme
border-gray-700    →  border-theme
```

---

### Phase 4: Testing & Polish

#### Step 4.1: Visual Testing Checklist
- [ ] Dashboard - all cards, charts, metrics
- [ ] Trade Log - table, filters, pagination
- [ ] Balance - entries, modals, forms
- [ ] Calendar - day cells, tooltips, navigation
- [ ] Journals - list, editor, chart gallery
- [ ] Analytics - all chart types
- [ ] Settings - all sections
- [ ] Mobile navigation - bottom nav, bottom sheet
- [ ] Auth pages - login, signup, forgot password
- [ ] Modals - upload, balance entry, journal quick edit
- [ ] Toast notifications
- [ ] Loading states
- [ ] Empty states
- [ ] Error states

#### Step 4.2: Edge Cases
- [ ] Charts (Recharts) - may need separate theming
- [ ] Scrollbars - already use CSS variables
- [ ] Focus states - ensure visible in both modes
- [ ] Disabled states
- [ ] Selection states

#### Step 4.3: System Preference Detection
- [ ] Test `prefers-color-scheme: dark` media query
- [ ] Test theme switching without refresh
- [ ] Test persistence across sessions

---

## File Changes Summary

| Category | Files | Estimated Changes |
|----------|-------|-------------------|
| CSS/Config | 2 | index.css, tailwind.config.js |
| Context | 1 | ThemeContext.tsx (new) |
| Layout | 2 | Navigation.tsx, PageLayout.tsx |
| Pages | 8 | All main pages |
| Components | ~45 | Various shared components |
| **Total** | **~58 files** | **~300 class replacements** |

---

## Execution Order

1. **Create ThemeContext** - Foundation for toggle
2. **Update index.css** - Define light/dark variables
3. **Add utility classes** - Bridge to new system
4. **Migrate Navigation.tsx** - Includes mobile toggle
5. **Migrate PageLayout.tsx** - Main content area
6. **Migrate pages** - One by one with testing
7. **Migrate components** - Shared components
8. **Test & polish** - Visual QA in both modes

---

## Notes

### Recharts Theming
Recharts components may need explicit color props that read from CSS variables or theme context:
```tsx
const { resolvedTheme } = useTheme()
const gridColor = resolvedTheme === 'dark' ? '#475569' : '#E2E8F0'
```

### Inline Styles
Search for inline `style={{ backgroundColor: }}` patterns - these need manual attention.

### Gradients
Gradient classes (`bg-gradient-to-br from-accent to-premium`) should work in both modes if semantic colors are used.

### Charts & Graphs
Consider creating a `useChartTheme()` hook that returns appropriate colors for the current theme.

---

## Post-Implementation

- [ ] Update user preferences API to store theme preference
- [ ] Add theme to Amplify environment variables (if needed for SSR)
- [ ] Document theme system for future component development
