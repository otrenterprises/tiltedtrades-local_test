# Multi-Broker Support Implementation Plan

**Generated:** November 29, 2025  
**Status:** Planning Document  
**Scope:** Architecture changes to support multiple brokers and data feeds beyond AMP/CQG

---

## Executive Summary

The TiltedTrades platform currently has **hardcoded dependencies** on AMP Futures as the broker and CQG as the data feed. To open this to the public, we need to introduce a **broker abstraction layer** that routes uploaded files to the appropriate processing pipeline based on user configuration.

This document outlines:
1. Current broker-specific touchpoints
2. Proposed architecture changes
3. Database schema additions
4. Implementation phases
5. Testing strategy

**Estimated Total Effort:** 40-60 hours across multiple phases

---

## Part 1: Current State Analysis

### 1.1 Broker-Specific Code Locations

The following components contain AMP/CQG-specific logic:

```
AWS/lambdas/tiltedtrades-dev-trades-data/
├── data/
│   ├── symbol_conversion.json    ← CQG symbol → Standard symbol mapping
│   ├── commissions.json          ← AMP commission tiers (hardcoded "AMP" key)
│   └── tick-values.json          ← Universal, but loaded in broker context
├── models/
│   ├── excel_schema.py           ← AMP Excel column names (Orders_OrderFills_*)
│   └── trading_execution.py      ← CQGSymbol, FullCQGSymbol field names
├── handlers/
│   ├── validation.py             ← Validates "Orders" sheet, AMP columns
│   ├── transformation.py         ← Column renaming for AMP format
│   └── json_conversion.py        ← Uses CQG symbol conversion
├── utils/
│   ├── calculations.py           ← Commission calculation references "AMP" broker
│   └── config.py                 ← References symbol_conversion.json path
└── tradesData.py                 ← Main handler loads AMP-specific data files
```

### 1.2 Hardcoded AMP/CQG References

| File | Line(s) | Hardcoded Element |
|------|---------|-------------------|
| `excel_schema.py` | 177-320 | Column names: `Orders_OrderFills_*`, `Orders_Transactions_*` |
| `excel_schema.py` | 177 | Sheet name: `"Orders"` |
| `trading_execution.py` | Various | Fields: `CQGSymbol`, `FullCQGSymbol` |
| `calculations.py` | ~45 | `broker_data = commissions_data.get('AMP', {})` |
| `symbol_conversion.json` | All | CQG → Standard symbol mapping |
| `commissions.json` | Root key | `"AMP": { ... }` structure |

### 1.3 Data Flow for AMP/CQG (Current)

```
┌─────────────────────────────────────────────────────────────────┐
│                        CURRENT FLOW (AMP/CQG)                    │
└─────────────────────────────────────────────────────────────────┘

User uploads Excel (AMP format)
        │
        ▼
┌─────────────────┐
│  trades-data    │
│  Lambda         │
│                 │
│  1. Validate    │ ← Checks for "Orders" sheet
│     - Sheet     │ ← Checks AMP column names
│     - Columns   │
│                 │
│  2. Transform   │ ← Renames Orders_OrderFills_* → standard names
│     - Columns   │ ← Uses CQG symbol conversion
│     - Symbols   │
│                 │
│  3. Calculate   │ ← Applies AMP commission rates
│     - Fees      │
└────────┬────────┘
         │
         ▼
   DynamoDB (TradingExecutions)
```

---

## Part 2: Proposed Architecture

### 2.1 Supported Brokers & Data Sources

| Broker | Primary Data Source | Fallback |
|--------|--------------------| ---------|
| AMP Futures (CQG) | Excel upload | — |
| NinjaTrader / Tradovate | API connection | CSV/Excel |
| Rithmic | API connection | CSV/Excel |
| Generic | — | CSV/Excel |

**Note:** NinjaTrader and Tradovate are the same company and share a backend API, so they are treated as a single broker handler.

### 2.2 Strategy Pattern for Broker Handlers

Introduce a **BrokerHandler** abstraction that encapsulates all broker-specific logic:

```
┌─────────────────────────────────────────────────────────────────┐
│                    PROPOSED FLOW (Multi-Broker)                  │
└─────────────────────────────────────────────────────────────────┘

         ┌──────────────────────────────────────┐
         │           Data Ingestion             │
         │  ┌─────────────┐  ┌───────────────┐  │
         │  │ API Sync    │  │ File Upload   │  │
         │  │ (Primary)   │  │ (Fallback)    │  │
         │  └──────┬──────┘  └───────┬───────┘  │
         └─────────┼─────────────────┼──────────┘
                   │                 │
                   └────────┬────────┘
                            ▼
                   ┌─────────────────┐
                   │     Router      │
                   │  (by brokerId)  │
                   └────────┬────────┘
                            │
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ AMP/CQG Handler │ │ NinjaTrader/    │ │ Rithmic Handler │
│                 │ │ Tradovate       │ │                 │
│ - Excel upload  │ │ Handler         │ │ - API sync      │
│ - CQG symbols   │ │                 │ │ - Rithmic syms  │
│ - AMP comms     │ │ - API sync      │ │ - Broker comms  │
│                 │ │ - Native syms   │ │                 │
│                 │ │ - NT/TV comms   │ │                 │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         └───────────────────┴───────────────────┘
                            │
                            ▼
               DynamoDB (TradingExecutions)
               (Normalized format - same for all brokers)
```

### 2.2 Broker Handler Interface

Each broker handler must implement these operations:

```python
# Conceptual interface (Python)
class BrokerHandler(ABC):
    """Abstract base class for broker-specific processing"""
    
    @property
    @abstractmethod
    def broker_id(self) -> str:
        """Unique identifier: 'amp_cqg', 'ninjatrader', 'rithmic', 'generic'"""
        pass
    
    @property
    @abstractmethod
    def supports_api_sync(self) -> bool:
        """Whether this broker supports API-based data sync"""
        pass
    
    @property
    @abstractmethod
    def supported_file_types(self) -> List[str]:
        """Supported fallback file extensions: ['.xlsx', '.csv']"""
        pass
    
    # API Sync Methods (for brokers that support it)
    @abstractmethod
    def sync_executions(self, credentials: BrokerCredentials, 
                        since: datetime = None) -> List[TradingExecution]:
        """Fetch executions from broker API (if supports_api_sync=True)"""
        pass
    
    # File Upload Methods (primary for AMP, fallback for others)
    @abstractmethod
    def validate_file(self, file_data: bytes) -> ValidationResult:
        """Validate file format and required fields"""
        pass
    
    @abstractmethod
    def parse_executions(self, file_data: bytes) -> List[TradingExecution]:
        """Parse file into normalized TradingExecution records"""
        pass
    
    # Common Methods
    @abstractmethod
    def convert_symbol(self, raw_symbol: str) -> str:
        """Convert broker-specific symbol to standard format"""
        pass
    
    @abstractmethod
    def calculate_commission(self, symbol: str, quantity: int, tier: str) -> Decimal:
        """Calculate commission for a trade"""
        pass
```

### 2.3 Normalized Execution Format

All broker handlers output the **same normalized format** for DynamoDB:

```python
# This is the target format - same for ALL brokers
@dataclass
class NormalizedExecution:
    userId: str
    executionId: str           # Unique ID
    DBKey: int                 # Transaction ID from broker
    
    # Timing
    Date: str                  # YYYY-MM-DD
    Time: str                  # HH:MM:SS
    TradingDay: str            # Futures trading day
    
    # Symbol (NORMALIZED - not broker-specific)
    Symbol: str                # Standard symbol: MES, ES, NQ (not CQG/broker format)
    
    # Execution details
    Side: str                  # "Buy" or "Sell"
    Quantity: int
    ExecutionPrice: Decimal
    OrderType: str             # "Market", "Limit", "Stop"
    
    # Position tracking
    PositionEffect: int        # +N opening, -N closing
    PositionQty: int           # Position after execution
    Status: str                # "To Open Long", "To Close", etc.
    
    # Fees
    Fees: Decimal              # Commission (negative)
    
    # Metadata
    Exchange: str
    ContractExpiration: str
    BrokerId: str              # NEW: "amp_cqg", "tradovate", etc.
    RawSymbol: str             # NEW: Original symbol before conversion
```

---

## Part 3: Database Schema Changes

### 3.1 UserPreferences Table Updates

Add broker configuration to user preferences:

```typescript
// Current UserPreferences schema
interface UserPreferences {
  userId: string
  preferenceKey: string        // 'DEFAULT'
  calculationMethod: string    // 'fifo' | 'perPosition'
  commissionTier: string       // 'fixed' | '1' | '2' | '3' | '4'
  // ... existing fields
}

// NEW FIELDS TO ADD
interface UserPreferences {
  // ... existing fields ...
  
  // NEW: Broker configuration
  brokerId: string             // 'amp_cqg' | 'tradovate' | 'ninjatrader' | 'generic'
  dataFeedId: string           // 'cqg' | 'rithmic' | 'tradovate_native' | 'generic'
  
  // NEW: Broker-specific settings (optional overrides)
  brokerSettings?: {
    accountId?: string         // For multi-account users
    customCommissionRate?: number  // Override default rates
    symbolMappingOverrides?: Record<string, string>  // Custom symbol mappings
  }
}
```

### 3.2 New Table: BrokerConfigurations

Store broker metadata (could also be a static JSON file):

```typescript
// DynamoDB Table: BrokerConfigurations
interface BrokerConfiguration {
  brokerId: string             // PK: 'amp_cqg', 'tradovate', etc.
  
  // Display info
  displayName: string          // "AMP Futures (CQG)"
  website: string
  logoUrl?: string
  
  // Capabilities
  supportedFileTypes: string[] // ['.xlsx', '.csv']
  dataFeedId: string           // Associated data feed
  
  // Feature flags
  isActive: boolean            // Enable/disable for new users
  isBeta: boolean              // Show beta badge in UI
  
  // Processing
  handlerLambda: string        // Lambda function name for this broker
  schemaVersion: string        // Track schema changes
}
```

### 3.3 TradingExecutions Table Updates

Add broker tracking fields:

```typescript
// ADD these fields to existing TradingExecutions records
interface TradingExecution {
  // ... existing fields ...
  
  // NEW: Broker tracking
  brokerId: string             // 'amp_cqg', 'tradovate', etc.
  rawSymbol: string            // Original symbol before normalization
  processingVersion: string    // Handler version that processed this
}
```

---

## Part 4: Implementation Phases

### Phase 1: Refactor Current Code (No New Features)

**Goal:** Extract AMP/CQG logic into a dedicated handler without changing functionality

**Tasks:**

1. **Create broker handler structure**
   ```
   AWS/lambdas/tiltedtrades-dev-trades-data/
   ├── brokers/
   │   ├── __init__.py
   │   ├── base_handler.py      ← Abstract base class
   │   ├── amp_cqg/
   │   │   ├── __init__.py
   │   │   ├── handler.py       ← AMP/CQG implementation
   │   │   ├── schema.py        ← Move excel_schema.py content here
   │   │   ├── symbols.py       ← Symbol conversion logic
   │   │   └── commissions.py   ← Commission calculation
   │   └── registry.py          ← Handler registry/factory
   ```

2. **Move existing code into amp_cqg handler**
   - Move `excel_schema.py` → `brokers/amp_cqg/schema.py`
   - Move symbol conversion logic → `brokers/amp_cqg/symbols.py`
   - Move commission logic → `brokers/amp_cqg/commissions.py`
   - Keep data files in `data/amp_cqg/` subdirectory

3. **Update main handler to use factory pattern**
   ```python
   # tradesData.py
   from brokers.registry import get_broker_handler
   
   def lambda_handler(event, context):
       user_id = extract_user_id(event)
       broker_id = get_user_broker_preference(user_id)  # Default: 'amp_cqg'
       
       handler = get_broker_handler(broker_id)
       result = handler.process_file(event)
       # ... rest of processing
   ```

4. **Add brokerId to UserPreferences defaults**
   - Update `post-registration-trigger` to set `brokerId: 'amp_cqg'`
   - Add migration for existing users (all get `brokerId: 'amp_cqg'`)

**Deliverables:**
- Refactored code with same functionality
- All existing tests pass (once we have tests)
- No user-facing changes

**Estimated Effort:** 8-12 hours

---

### Phase 2: Add Broker Selection UI

**Goal:** Allow users to select their broker in settings

**Tasks:**

1. **Frontend: Settings page broker selector**
   ```typescript
   // New component: BrokerSelector.tsx
   interface BrokerOption {
     id: string
     name: string
     logo?: string
     supportsApiSync?: boolean
     isBeta?: boolean
     isDisabled?: boolean
   }
   
   const BROKER_OPTIONS: BrokerOption[] = [
     { id: 'amp_cqg', name: 'AMP Futures (CQG)', supportsApiSync: false },
     { id: 'ninjatrader', name: 'NinjaTrader / Tradovate', supportsApiSync: true, isDisabled: true },
     { id: 'rithmic', name: 'Rithmic', supportsApiSync: true, isDisabled: true },
     { id: 'generic', name: 'Generic CSV', supportsApiSync: false, isBeta: true, isDisabled: true },
   ]
   ```

2. **Frontend: Upload modal shows expected format**
   - Display expected file format based on selected broker
   - Show sample file download link
   - Warn if file doesn't match expected broker format

3. **API: Update preferences endpoint**
   - Add `brokerId` to allowed update fields
   - Validate broker ID against supported list

4. **Backend: Store broker preference**
   - Update `user-profile-api` to handle `brokerId`

**Deliverables:**
- Broker selection in Settings
- Upload instructions per broker
- User preferences include broker

**Estimated Effort:** 6-8 hours

---

### Phase 3: Routing Infrastructure

**Goal:** Route uploads to correct handler based on user preference

**Tasks:**

1. **Update trades-data Lambda router**
   ```python
   def lambda_handler(event, context):
       user_id = extract_user_id(event)
       
       # Get user's broker preference
       preferences = get_user_preferences(user_id)
       broker_id = preferences.get('brokerId', 'amp_cqg')
       
       # Get appropriate handler
       handler = get_broker_handler(broker_id)
       
       if handler is None:
           return error_response(f"Unsupported broker: {broker_id}")
       
       # Validate file format matches broker
       validation = handler.validate_file(event)
       if not validation.success:
           return error_response(validation.message)
       
       # Process with broker-specific handler
       return handler.process(event, context)
   ```

2. **Create "not implemented" placeholder handlers**
   ```python
   # brokers/ninjatrader/handler.py
   class NinjaTraderHandler(BrokerHandler):
       broker_id = 'ninjatrader'
       supports_api_sync = True
       
       def validate_file(self, file_data):
           return ValidationResult(
               success=False,
               message="NinjaTrader/Tradovate support coming soon! Currently only AMP/CQG is supported."
           )
       
       def sync_executions(self, credentials, since=None):
           raise NotImplementedError("API sync not yet implemented")
   ```

3. **Add broker ID to processed executions**
   - Tag all TradingExecution records with `brokerId`
   - Store `rawSymbol` for debugging

**Deliverables:**
- Routing logic in place
- Graceful handling of unsupported brokers
- Execution records tagged with broker

**Estimated Effort:** 6-8 hours

---

### Phase 4: NinjaTrader / Tradovate Handler

**Goal:** Implement support for NinjaTrader/Tradovate (same backend API)

**Tasks:**

1. **Create NinjaTrader handler structure**
   ```
   brokers/ninjatrader/
   ├── handler.py           # API sync + file fallback
   ├── api_client.py        # API connection logic
   ├── schema.py            # CSV/Excel fallback schema
   ├── symbols.py           # Symbol conversion
   ├── commissions.py       # Commission calculation
   └── data/
       ├── symbol_conversion.json
       └── commissions.json
   ```

2. **Implement API sync (primary)**
   - OAuth/API key authentication
   - Historical execution fetch
   - Incremental sync support

3. **Implement file fallback (secondary)**
   - CSV/Excel parsing for manual uploads
   - Validation logic

4. **Testing**
   - Unit tests for API client
   - Unit tests for file parser
   - Integration tests end-to-end

5. **Enable in UI**
   - Broker connection settings
   - Manual upload fallback option

**Deliverables:**
- Full NinjaTrader/Tradovate support
- API sync + file fallback
- Test coverage

**Estimated Effort:** 16-20 hours

---

### Phase 5: Rithmic Handler

**Goal:** Implement support for Rithmic (used by many prop firms)

**Tasks:**

1. **Create Rithmic handler structure**
   ```
   brokers/rithmic/
   ├── handler.py           # API sync + file fallback
   ├── api_client.py        # Rithmic API connection
   ├── schema.py            # CSV/Excel fallback schema
   ├── symbols.py           # Symbol conversion
   ├── commissions.py       # Commission calculation
   └── data/
       └── symbol_conversion.json
   ```

2. **Implement API sync (primary)**
   - Rithmic API authentication
   - Historical execution fetch
   - Incremental sync support

3. **Implement file fallback (secondary)**
   - CSV/Excel parsing for manual uploads

4. **Testing**
   - Unit tests
   - Integration tests

**Deliverables:**
- Full Rithmic support
- API sync + file fallback
- Test coverage

**Estimated Effort:** 16-20 hours

---

### Phase 6: Generic CSV Handler

**Goal:** Allow users with unsupported brokers to upload standardized CSV

**Tasks:**

1. **Define generic CSV schema**
   ```csv
   Date,Time,Symbol,Side,Quantity,Price,Commission
   2024-11-29,09:30:00,MES,Buy,1,6050.25,-1.24
   ```

2. **Create generic handler**
   - Minimal validation
   - No symbol conversion (user provides standard symbols)
   - User-specified commission per trade

3. **Documentation**
   - CSV format specification
   - Example files
   - FAQ for common issues

**Deliverables:**
- Generic CSV support
- User documentation
- Template CSV downloads

**Estimated Effort:** 8-10 hours

---

## Part 5: File Organization (Final State)

```
AWS/lambdas/tiltedtrades-dev-trades-data/
├── tradesData.py                    # Main handler (router only)
├── brokers/
│   ├── __init__.py
│   ├── base_handler.py              # Abstract base class
│   ├── registry.py                  # Handler factory
│   │
│   ├── amp_cqg/                     # AMP Futures + CQG Data Feed
│   │   ├── __init__.py
│   │   ├── handler.py               # AmpCqgHandler class (file upload only)
│   │   ├── schema.py                # Excel schema definition
│   │   ├── symbols.py               # CQG → Standard symbol conversion
│   │   ├── commissions.py           # AMP commission tiers
│   │   └── data/
│   │       ├── symbol_conversion.json
│   │       ├── commissions.json
│   │       └── tick-values.json
│   │
│   ├── ninjatrader/                 # NinjaTrader + Tradovate (same API)
│   │   ├── __init__.py
│   │   ├── handler.py               # API sync + file fallback
│   │   ├── api_client.py            # API connection
│   │   ├── schema.py                # Fallback file schema
│   │   ├── symbols.py
│   │   ├── commissions.py
│   │   └── data/
│   │       ├── symbol_conversion.json
│   │       └── commissions.json
│   │
│   ├── rithmic/                     # Rithmic (prop firms)
│   │   ├── __init__.py
│   │   ├── handler.py               # API sync + file fallback
│   │   ├── api_client.py            # Rithmic API connection
│   │   ├── schema.py                # Fallback file schema
│   │   ├── symbols.py
│   │   └── data/
│   │       └── symbol_conversion.json
│   │
│   └── generic/                     # Generic CSV (manual upload only)
│       ├── __init__.py
│       ├── handler.py
│       ├── schema.py
│       └── templates/
│           └── sample.csv
│
├── handlers/                        # Shared handlers (non-broker-specific)
│   ├── s3_archive.py
│   ├── dynamodb.py
│   └── monitoring.py
│
├── models/                          # Shared models
│   ├── normalized_execution.py      # Common output format
│   └── validation_result.py
│
└── utils/                           # Shared utilities
    ├── config.py
    └── json_helpers.py
```

---

## Part 6: Frontend Changes Summary

### Settings Page

```
┌─────────────────────────────────────────────────────────────┐
│  Settings                                                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Broker & Data Feed                                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  ● AMP Futures (CQG Data)           ✓ Active        │    │
│  │  ○ NinjaTrader / Tradovate          ⏳ Coming Soon  │    │
│  │  ○ Rithmic                          ⏳ Coming Soon  │    │
│  │  ○ Generic CSV                      🏷️ Beta         │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Commission Tier                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  [Dropdown: Tier 1 / 2 / 3 / 4 / Fixed]             │    │
│  └─────────────────────────────────────────────────────┘    │
│  ⓘ Commission tiers are broker-specific. View rates →       │
│                                                              │
│  Calculation Method                                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  ● FIFO    ○ Per Position                           │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Upload Modal

```
┌─────────────────────────────────────────────────────────────┐
│  Upload Trading Data                                    [X]  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Your broker: AMP Futures (CQG)                              │
│  Expected format: Excel (.xlsx)                              │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                                                       │    │
│  │     📂 Drop your AMP Orders export here              │    │
│  │        or click to browse                            │    │
│  │                                                       │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  📄 Download sample file  |  📖 Export instructions          │
│                                                              │
│  ⚠️ Using a different broker?                                │
│     Change your broker in Settings before uploading.         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Part 7: Testing Strategy

### Unit Tests (Per Broker Handler)

```python
# tests/brokers/test_amp_cqg.py
class TestAmpCqgHandler:
    def test_validate_file_valid(self):
        """Valid AMP Excel file passes validation"""
        
    def test_validate_file_missing_columns(self):
        """File missing required columns fails validation"""
        
    def test_convert_symbol_mes(self):
        """CQG 'MEH5' converts to 'MES'"""
        
    def test_convert_symbol_unknown(self):
        """Unknown symbol returns original"""
        
    def test_calculate_commission_tier3(self):
        """Tier 3 MES commission is $0.60/side"""
        
    def test_parse_execution_complete(self):
        """Full execution record parses correctly"""
```

### Integration Tests

```python
# tests/integration/test_multi_broker.py
class TestMultiBrokerRouting:
    def test_amp_user_routes_to_amp_handler(self):
        """User with amp_cqg preference uses AMP handler"""
        
    def test_ninjatrader_user_routes_to_ninjatrader_handler(self):
        """User with ninjatrader preference uses NinjaTrader handler"""
        
    def test_unknown_broker_returns_error(self):
        """Invalid broker preference returns helpful error"""
```

---

## Part 8: Migration Plan

### Existing Users

1. **Add default broker to all existing users**
   ```python
   # One-time migration script
   for user in get_all_users():
       if 'brokerId' not in user.preferences:
           update_preference(user.id, brokerId='amp_cqg')
   ```

2. **Tag existing executions** (optional, for analytics)
   ```python
   # Backfill brokerId on existing records
   for execution in get_all_executions():
       if 'brokerId' not in execution:
           update_execution(execution.id, brokerId='amp_cqg')
   ```

### Data File Migration

1. Move data files to broker subdirectories:
   ```bash
   # Current
   data/symbol_conversion.json
   data/commissions.json
   data/tick-values.json
   
   # After migration
   brokers/amp_cqg/data/symbol_conversion.json
   brokers/amp_cqg/data/commissions.json
   brokers/amp_cqg/data/tick-values.json  # Or keep shared
   ```

---

## Part 9: Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing AMP uploads | Medium | High | Extensive testing, feature flag rollout |
| Performance degradation from routing | Low | Low | Handler lookup is O(1) |
| User confusion about broker selection | Medium | Medium | Clear UI, helpful error messages |
| Commission calculation errors | Medium | High | Unit tests, side-by-side validation |
| Symbol conversion edge cases | High | Medium | Comprehensive symbol mapping, fallback to raw |

---

## Part 10: Success Criteria

### Phase 1 (Refactor)
- [ ] All existing functionality works unchanged
- [ ] Code organized into broker handler structure
- [ ] No user-facing changes

### Phase 2 (UI)
- [ ] Users can view their broker selection
- [ ] Settings page shows broker options
- [ ] Upload modal shows expected format

### Phase 3 (Routing)
- [ ] Uploads route to correct handler
- [ ] Unsupported brokers show helpful message
- [ ] Executions tagged with brokerId

### Phase 4 (NinjaTrader/Tradovate)
- [ ] API sync fetches executions correctly
- [ ] File fallback parses correctly
- [ ] Symbols convert accurately
- [ ] Commissions calculate correctly

### Phase 5 (Rithmic)
- [ ] API sync fetches executions correctly
- [ ] File fallback parses correctly
- [ ] Symbols convert accurately

### Phase 6 (Generic CSV)
- [ ] Generic CSV parses correctly
- [ ] Documentation is clear
- [ ] Template file available

---

## Appendix A: Broker Data Sources

| Broker | Primary Source | Fallback | Notes |
|--------|---------------|----------|-------|
| AMP Futures (CQG) | Excel upload | — | Current implementation |
| NinjaTrader / Tradovate | API | CSV/Excel | Same backend API |
| Rithmic | API | CSV/Excel | Used by prop firms |
| Generic | — | CSV | Manual upload only |

### AMP Futures (CQG) - Current
- **Format:** Excel (.xlsx)
- **Sheet:** "Orders"
- **Key columns:** Orders_OrderFills_*, Orders_Transactions_*
- **Symbols:** CQG format (MEH5, EPH5, NQZH5)

### NinjaTrader / Tradovate
- **Primary:** API connection
- **Fallback:** CSV/Excel export
- **Symbols:** Native format
- **Note:** NinjaTrader acquired Tradovate; same backend

### Rithmic
- **Primary:** API connection
- **Fallback:** CSV/Excel export
- **Symbols:** Exchange native
- **Note:** Common backend for prop firms (Apex, TopStep, etc.)

---

## Appendix B: Commission Structures by Broker

### AMP Futures
- Tiered based on monthly volume
- Per-side pricing
- Data in `commissions.json`

### NinjaTrader / Tradovate
- Per-contract pricing
- Research needed for exact rates

### Rithmic
- Varies by prop firm / broker
- May require user-configured rates

---

*Implementation plan generated for Claude Code reference*
