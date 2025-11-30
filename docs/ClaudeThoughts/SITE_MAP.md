# TiltedTrades Site Map & Architecture Diagrams

**Last Updated:** November 29, 2025

---

## 1. Application Routes Overview

```mermaid
flowchart TB
    subgraph Public["🌐 Public Routes"]
        landing["/landing"]
        login["/login"]
        signup["/signup"]
        confirm["/confirm-signup"]
        forgot["/forgot-password"]
        reset["/reset-password"]
    end
    
    subgraph Protected["🔒 Protected Routes (/app/*)"]
        dashboard["/app/ (Dashboard)"]
        trades["/app/trades (TradeLog)"]
        balance["/app/balance"]
        journals["/app/journals"]
        journal_edit["/app/trades/:tradeId/journal"]
        journal_view["/app/journal/:tradeId"]
        analytics["/app/analytics"]
        calendar["/app/calendar"]
        settings["/app/settings"]
    end
    
    subgraph Disabled["⏸️ Disabled (Multi-user)"]
        leaderboard["/app/leaderboard"]
        profile["/app/profile/:userId"]
    end
    
    root["/"] --> authCheck{Auth Check}
    authCheck -->|Authenticated| dashboard
    authCheck -->|Not Auth| landing
    
    landing --> login
    landing --> signup
    login --> dashboard
    signup --> confirm
    confirm --> dashboard
    forgot --> reset
    reset --> login
```

---

## 2. Complete Page → Component → API Flow

```mermaid
flowchart LR
    subgraph Pages["📄 Pages"]
        P1[DashboardNew]
        P2[TradeLog]
        P3[Balance]
        P4[JournalList]
        P5[JournalEditor]
        P6[TradeDetail]
        P7[AnalyticsAPI]
        P8[CalendarNew]
        P9[Settings]
    end
    
    subgraph Hooks["🪝 React Query Hooks"]
        H1[useTrades]
        H2[useStats]
        H3[useBalance]
        H4[useJournal]
        H5[useSettings]
        H6[useProfile]
        H7[useUpload]
    end
    
    subgraph Services["⚙️ API Services"]
        S1[tradeService]
        S2[balanceService]
        S3[journalService]
        S4[userService]
        S5[uploadService]
        S6[authService]
    end
    
    P1 --> H1 & H2
    P2 --> H1
    P3 --> H3
    P4 --> H4
    P5 --> H4 & H1
    P6 --> H1 & H4
    P7 --> H1 & H2
    P8 --> H1
    P9 --> H5 & H6
    
    H1 --> S1
    H2 --> S1
    H3 --> S2
    H4 --> S3
    H5 --> S4
    H6 --> S4
    H7 --> S5
```

---

## 3. API Gateway Endpoints Map

```mermaid
flowchart TB
    subgraph APIGateway["🌐 API Gateway"]
        subgraph TradeAPI["Trade Data API"]
            GET_EXEC["GET /api/users/{userId}/executions"]
            GET_TRADES["GET /api/users/{userId}/trades"]
            GET_STATS["GET /api/users/{userId}/stats"]
        end
        
        subgraph BalanceAPI["Balance API"]
            GET_BAL["GET /api/users/{userId}/balance"]
            POST_BAL["POST /api/users/{userId}/balance"]
            PUT_BAL["PUT /api/users/{userId}/balance/{entryId}"]
            DEL_BAL["DELETE /api/users/{userId}/balance/{entryId}"]
            GET_TMPL["GET /api/users/{userId}/balance/templates"]
            POST_TMPL["POST /api/users/{userId}/balance/templates"]
            PUT_TMPL["PUT /api/users/{userId}/balance/templates/{id}"]
            DEL_TMPL["DELETE /api/users/{userId}/balance/templates/{id}"]
        end
        
        subgraph JournalAPI["Journal API"]
            GET_JOURNALS["GET /api/users/{userId}/journals"]
            GET_JOURNAL["GET /api/users/{userId}/trades/{tradeId}/journal"]
            POST_JOURNAL["POST /api/users/{userId}/trades/{tradeId}/journal"]
            DEL_JOURNAL["DELETE /api/users/{userId}/trades/{tradeId}/journal"]
            POST_CHART["POST /api/users/{userId}/trades/{tradeId}/journal/charts"]
            DEL_CHART["DELETE /api/users/{userId}/trades/{tradeId}/journal/charts/{chartId}"]
        end
        
        subgraph UserAPI["User API"]
            GET_PROFILE["GET /api/users/{userId}/profile"]
            PUT_PROFILE["PUT /api/users/{userId}/profile"]
            GET_PREFS["GET /api/users/{userId}/preferences"]
            PUT_PREFS["PUT /api/users/{userId}/preferences"]
        end
        
        subgraph UploadAPI["Upload API"]
            POST_UPLOAD["POST /api/users/{userId}/upload"]
        end
        
        subgraph PublicAPI["Public API"]
            GET_PUBLIC["GET /api/public/profiles"]
            GET_PUBLIC_USER["GET /api/public/profiles/{userId}"]
        end
    end
```

---

## 4. Lambda Functions & Triggers

```mermaid
flowchart TB
    subgraph Triggers["🎯 Triggers"]
        S3["S3 Object Created<br/>(Excel Upload)"]
        APIGW["API Gateway<br/>(REST Requests)"]
        DDB_STREAM["DynamoDB Stream<br/>(TradingExecutions)"]
        EVENTBRIDGE["EventBridge<br/>(2 AM UTC Daily)"]
        COGNITO["Cognito<br/>(Post-Confirmation)"]
    end
    
    subgraph Lambdas["⚡ Lambda Functions"]
        L1["trades-data<br/>(Python 3.11)"]
        L2["trading-data-processor<br/>(Node.js 20.x)"]
        L3["stats-calculator<br/>(Node.js 20.x)"]
        L4["file-upload-handler<br/>(Node.js 20.x)"]
        L5["user-profile-api<br/>(Node.js 20.x)"]
        L6["trade-journal-api<br/>(Node.js 20.x)"]
        L7["public-profiles-api<br/>(Node.js 20.x)"]
        L8["post-registration-trigger<br/>(Node.js 20.x)"]
    end
    
    S3 -->|"users/{userId}/uploads/*"| L1
    L1 -->|"Async Invoke"| L2
    DDB_STREAM -->|"INSERT/MODIFY"| L2
    EVENTBRIDGE -->|"Nightly Batch"| L3
    COGNITO -->|"Post-Confirm"| L8
    
    APIGW -->|"/upload"| L4
    APIGW -->|"/profile, /preferences"| L5
    APIGW -->|"/trades, /executions, /stats"| L5
    APIGW -->|"/journals, /charts"| L6
    APIGW -->|"/public/profiles"| L7
    APIGW -->|"/balance"| L5
```

---

## 5. Data Processing Pipeline

```mermaid
flowchart LR
    subgraph Upload["📤 Upload Flow"]
        EXCEL["Excel File<br/>(.xlsx/.xls/.csv)"]
        BROWSER["Browser"]
        PRESIGN["Presigned URL"]
        S3_BUCKET["S3 Bucket<br/>users/{userId}/uploads/"]
    end
    
    subgraph Processing["⚙️ Processing Pipeline"]
        VALIDATE["1. Validate<br/>File Structure"]
        TRANSFORM["2. Transform<br/>& Normalize"]
        ARCHIVE_ORIG["3. Archive Original<br/>to S3 (JSON)"]
        CONVERT["4. JSON Conversion<br/>+ Symbol Mapping"]
        ARCHIVE_PROC["5. Archive Processed<br/>to S3"]
        DDB_WRITE["6. Batch Write<br/>DynamoDB"]
        INVOKE_PROC["7. Invoke<br/>trading-data-processor"]
    end
    
    subgraph Matching["🔄 Trade Matching"]
        FETCH_ALL["Query All<br/>Executions"]
        SORT["Sort<br/>Chronologically"]
        FIFO["FIFO Matching"]
        PERPOS["Per Position<br/>Matching"]
        DEL_OLD["Delete Old<br/>Trades"]
        WRITE_BOTH["Write Both<br/>Methods"]
        CALC_STATS["Calculate<br/>Statistics"]
        UPDATE_STATS["Update Stats<br/>Table"]
    end
    
    EXCEL --> BROWSER
    BROWSER -->|"POST /upload"| PRESIGN
    BROWSER -->|"PUT (presigned)"| S3_BUCKET
    S3_BUCKET -->|"S3 Event"| VALIDATE
    
    VALIDATE --> TRANSFORM --> ARCHIVE_ORIG --> CONVERT --> ARCHIVE_PROC --> DDB_WRITE --> INVOKE_PROC
    
    INVOKE_PROC --> FETCH_ALL --> SORT
    SORT --> FIFO
    SORT --> PERPOS
    FIFO --> DEL_OLD
    PERPOS --> DEL_OLD
    DEL_OLD --> WRITE_BOTH --> CALC_STATS --> UPDATE_STATS
```

---

## 6. DynamoDB Tables & Access Patterns

```mermaid
flowchart TB
    subgraph Tables["📊 DynamoDB Tables"]
        T1["TradingExecutions<br/>PK: userId<br/>SK: executionId"]
        T2["MatchedTrades<br/>PK: userId<br/>SK: calculationMethod_tradeId"]
        T3["TradingStats<br/>PK: userId<br/>SK: statsType"]
        T4["UserProfiles<br/>PK: userId<br/>SK: dataType"]
        T5["UserPreferences<br/>PK: userId<br/>SK: preferenceKey"]
        T6["TradeJournals<br/>PK: userId<br/>SK: tradeId"]
        T7["CommissionOverrides<br/>PK: userId<br/>SK: tradeId"]
        T8["UserBalance<br/>PK: userId<br/>SK: entryId"]
    end
    
    subgraph Lambdas["Lambda Access"]
        L1["trades-data"] -->|Write| T1
        L2["trading-data-processor"] -->|Read| T1
        L2 -->|Read/Write| T2
        L2 -->|Write| T3
        L2 -->|Read| T5
        L2 -->|Read| T7
        L2 -->|Read| T8
        L3["stats-calculator"] -->|Read| T2
        L3 -->|Write| T3
        L3 -->|Read/Write| T4
        L5["user-profile-api"] -->|CRUD| T4
        L5["user-profile-api"] -->|CRUD| T5
        L5["user-profile-api"] -->|Read| T2
        L5["user-profile-api"] -->|Read| T3
        L5["user-profile-api"] -->|CRUD| T8
        L6["trade-journal-api"] -->|CRUD| T6
        L6 -->|CRUD| T7
        L8["post-registration"] -->|Write| T4
        L8 -->|Write| T5
    end
```

---

## 7. Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant App as React App
    participant Cognito as AWS Cognito
    participant API as API Gateway
    participant Lambda as Lambda
    
    rect rgb(240, 248, 255)
        Note over U,Lambda: Sign Up Flow
        U->>App: Enter email/password
        App->>Cognito: signUp()
        Cognito-->>App: Confirmation required
        App->>U: Show confirmation page
        U->>App: Enter code
        App->>Cognito: confirmSignUp()
        Cognito->>Lambda: Post-confirmation trigger
        Lambda-->>Cognito: Create profile/prefs
        Cognito-->>App: Success + tokens
        App->>U: Redirect to /app
    end
    
    rect rgb(255, 248, 240)
        Note over U,Lambda: Sign In Flow
        U->>App: Enter credentials
        App->>Cognito: signIn()
        Cognito-->>App: JWT tokens
        App->>App: Store in memory
        App->>U: Redirect to /app
    end
    
    rect rgb(240, 255, 240)
        Note over U,Lambda: API Request Flow
        U->>App: View Dashboard
        App->>App: Get JWT from Cognito
        App->>API: GET /trades (Bearer token)
        API->>API: Validate JWT
        API->>Lambda: Invoke with userId
        Lambda->>Lambda: Query DynamoDB
        Lambda-->>API: Trade data
        API-->>App: JSON response
        App->>U: Render dashboard
    end
```

---

## 8. Component Hierarchy

```mermaid
flowchart TB
    subgraph AppRoot["App.tsx"]
        QCP["QueryClientProvider"]
        AP["AuthProvider"]
        NP["NavigationProvider"]
        BR["BrowserRouter"]
    end
    
    subgraph Layout["Layout Components"]
        NAV["Navigation"]
        PL["PageLayout"]
        PR["ProtectedRoute"]
        SM["SessionManager"]
    end
    
    subgraph Pages["Page Components"]
        DASH["DashboardNew"]
        TL["TradeLog"]
        BAL["Balance"]
        CAL["CalendarNew"]
        JLIST["JournalList"]
        JEDIT["JournalEditor"]
        TDET["TradeDetail"]
        ANAL["AnalyticsAPI"]
        SET["Settings"]
    end
    
    subgraph Charts["Chart Components"]
        EC["EquityCurve"]
        MP["MonthlyPerformance"]
        WLD["WinLossDistribution"]
        SP["SymbolPerformance"]
    end
    
    subgraph Common["Common Components"]
        MC["MetricCard"]
        PLT["PLToggle"]
        LS["LoadingSpinner"]
        EM["ErrorMessage"]
        ES["EmptyState"]
    end
    
    subgraph Modals["Modal Components"]
        FUM["FileUploadModal"]
        BEM["BalanceEntryModal"]
        JQM["JournalQuickModal"]
    end
    
    QCP --> AP --> NP --> BR
    BR --> PR --> SM
    SM --> NAV & PL
    
    PL --> DASH & TL & BAL & CAL & JLIST & JEDIT & TDET & ANAL & SET
    
    DASH --> EC & MP & WLD & SP & MC & PLT
    TL --> MC & FUM & JQM
    BAL --> BEM & MC
    
    DASH & TL & CAL & ANAL --> LS & EM & ES
```

---

## 9. State Flow Diagram

```mermaid
stateDiagram-v2
    [*] --> Loading: App Mount
    Loading --> Unauthenticated: No Session
    Loading --> Authenticated: Valid Session
    
    Unauthenticated --> SigningIn: Login Attempt
    SigningIn --> Authenticated: Success
    SigningIn --> Unauthenticated: Failure
    
    Unauthenticated --> SigningUp: Register
    SigningUp --> ConfirmingEmail: Success
    ConfirmingEmail --> Authenticated: Verified
    
    Authenticated --> FetchingData: Load Dashboard
    FetchingData --> DataLoaded: Success
    FetchingData --> Error: API Error
    Error --> FetchingData: Retry
    
    DataLoaded --> Uploading: Upload Excel
    Uploading --> Processing: S3 Success
    Processing --> DataLoaded: Stats Updated
    
    Authenticated --> SigningOut: Logout
    SigningOut --> Unauthenticated: Clear Cache
    
    Authenticated --> Idle: 30 min Timeout
    Idle --> Unauthenticated: Auto Logout
```

---

## 10. File Upload Sequence

```mermaid
sequenceDiagram
    participant U as User
    participant FUM as FileUploadModal
    participant US as uploadService
    participant API as API Gateway
    participant L4 as file-upload-handler
    participant S3 as S3 Bucket
    participant L1 as trades-data
    participant L2 as trading-data-processor
    participant DDB as DynamoDB
    
    U->>FUM: Select Excel file
    FUM->>FUM: Validate (type, size)
    FUM->>US: uploadFile(file)
    US->>API: POST /upload {filename, contentType}
    API->>L4: Generate presigned URL
    L4-->>API: {uploadUrl, s3Key}
    API-->>US: Presigned URL response
    
    US->>S3: PUT (presigned URL)
    Note over S3: File stored at<br/>users/{userId}/uploads/{file}
    S3-->>US: 200 OK
    US-->>FUM: Upload complete
    FUM->>U: Show success
    
    S3->>L1: S3 Event trigger
    L1->>L1: Validate & transform
    L1->>DDB: BatchWrite executions
    L1->>L2: Async invoke
    
    L2->>DDB: Query executions
    L2->>L2: FIFO + Per Position matching
    L2->>DDB: Write MatchedTrades
    L2->>DDB: Update TradingStats
    
    Note over U,DDB: React Query auto-refetches<br/>stale data after 5 min
```

---

## Quick Reference: API Endpoints Summary

| Endpoint | Method | Lambda | Purpose |
|----------|--------|--------|---------|
| `/api/users/{userId}/executions` | GET | user-profile-api | List raw executions |
| `/api/users/{userId}/trades` | GET | user-profile-api | List matched trades |
| `/api/users/{userId}/stats` | GET | user-profile-api | Get trading statistics |
| `/api/users/{userId}/balance` | GET/POST | user-profile-api | Balance entries CRUD |
| `/api/users/{userId}/balance/{id}` | PUT/DELETE | user-profile-api | Update/delete entry |
| `/api/users/{userId}/balance/templates` | GET/POST | user-profile-api | Recurring templates |
| `/api/users/{userId}/profile` | GET/PUT | user-profile-api | User profile |
| `/api/users/{userId}/preferences` | GET/PUT | user-profile-api | User preferences |
| `/api/users/{userId}/upload` | POST | file-upload-handler | Get presigned URL |
| `/api/users/{userId}/journals` | GET | trade-journal-api | List all journals |
| `/api/users/{userId}/trades/{id}/journal` | GET/POST/DELETE | trade-journal-api | Journal CRUD |
| `/api/users/{userId}/trades/{id}/journal/charts` | POST | trade-journal-api | Upload chart |
| `/api/users/{userId}/trades/{id}/journal/charts/{cid}` | DELETE | trade-journal-api | Delete chart |
| `/api/public/profiles` | GET | public-profiles-api | Leaderboard |
| `/api/public/profiles/{userId}` | GET | public-profiles-api | Public profile |

---

*Generated by Claude Code analysis*
