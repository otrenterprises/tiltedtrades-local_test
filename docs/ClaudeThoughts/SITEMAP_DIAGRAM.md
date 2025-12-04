# TiltedTrades Site Map & Architecture Diagram

**Generated:** November 29, 2025

---

## 1. Application Route Map

```mermaid
flowchart TB
    subgraph PUBLIC["🌐 Public Routes"]
        LANDING["/landing<br/>Landing Page"]
        LOGIN["/login<br/>LoginForm"]
        SIGNUP["/signup<br/>SignupForm"]
        CONFIRM["/confirm-signup<br/>ConfirmSignUp"]
        FORGOT["/forgot-password<br/>ForgotPassword"]
        RESET["/reset-password<br/>ResetPassword"]
    end

    subgraph PROTECTED["🔒 Protected Routes (/app/*)"]
        DASHBOARD["/app<br/>DashboardNew"]
        TRADES["/app/trades<br/>TradeLog"]
        BALANCE["/app/balance<br/>Balance"]
        ANALYTICS["/app/analytics<br/>AnalyticsAPI"]
        CALENDAR["/app/calendar<br/>CalendarNew"]
        JOURNALS["/app/journals<br/>JournalList"]
        JOURNALEDIT["/app/trades/:tradeId/journal<br/>JournalEditor"]
        TRADEDETAIL["/app/journal/:tradeId<br/>TradeDetail"]
        SETTINGS["/app/settings<br/>Settings"]
    end

    subgraph DISABLED["⏸️ Disabled Routes"]
        LEADERBOARD["/app/leaderboard<br/>Leaderboard"]
        PROFILE["/app/profile/:userId<br/>PublicProfile"]
    end

    ROOT["/"] --> |Auth Check| AUTHCHECK{Authenticated?}
    AUTHCHECK -->|Yes| DASHBOARD
    AUTHCHECK -->|No| LANDING
    
    LANDING --> LOGIN
    LANDING --> SIGNUP
    LOGIN --> DASHBOARD
    SIGNUP --> CONFIRM
    CONFIRM --> DASHBOARD
    LOGIN --> FORGOT
    FORGOT --> RESET
    RESET --> LOGIN

    DASHBOARD --> TRADES
    DASHBOARD --> BALANCE
    DASHBOARD --> ANALYTICS
    DASHBOARD --> CALENDAR
    DASHBOARD --> JOURNALS
    TRADES --> JOURNALEDIT
    TRADES --> TRADEDETAIL
    JOURNALS --> TRADEDETAIL

    style PUBLIC fill:#e8f5e9
    style PROTECTED fill:#e3f2fd
    style DISABLED fill:#fafafa,stroke-dasharray: 5 5
```

---

## 2. Component Hierarchy

```mermaid
flowchart TB
    subgraph APP["App.tsx"]
        QCP[QueryClientProvider]
        AP[AuthProvider]
        NP[NavigationProvider]
        BR[BrowserRouter]
    end

    QCP --> AP --> NP --> BR

    subgraph LAYOUT["Layout Components"]
        NAV[Navigation.tsx]
        PL[PageLayout.tsx]
        SM[SessionManager]
    end

    BR --> NAV
    BR --> SM
    NAV --> PL

    subgraph PAGES["Page Components"]
        P1[DashboardNew]
        P2[TradeLog]
        P3[Balance]
        P4[AnalyticsAPI]
        P5[CalendarNew]
        P6[JournalList]
        P7[JournalEditor]
        P8[TradeDetail]
        P9[Settings]
    end

    PL --> P1 & P2 & P3 & P4 & P5 & P6 & P7 & P8 & P9

    subgraph CHARTS["Chart Components"]
        C1[EquityCurve]
        C2[MonthlyPerformance]
        C3[WinLossDistribution]
        C4[SymbolPerformance]
    end

    P1 --> C1 & C2 & C3 & C4
    P4 --> C1 & C2 & C3 & C4
```

---

## 3. Frontend → API Gateway → Lambda Flow

```mermaid
flowchart LR
    subgraph FRONTEND["🖥️ React Frontend"]
        direction TB
        TS[tradeService]
        JS[journalService]
        BS[balanceService]
        US[userService]
        UPS[uploadService]
        AUTH[authService]
    end

    subgraph COGNITO["🔐 AWS Cognito"]
        CUP[User Pool]
        CID[Identity Pool]
    end

    subgraph APIGW["🌉 API Gateway"]
        direction TB
        E1["/api/users/{'{userId}'}/trades"]
        E2["/api/users/{'{userId}'}/executions"]
        E3["/api/users/{'{userId}'}/stats"]
        E4["/api/users/{'{userId}'}/journals"]
        E5["/api/users/{'{userId}'}/trades/{'{tradeId}'}/journal"]
        E6["/api/users/{'{userId}'}/balance"]
        E7["/api/users/{'{userId}'}/profile"]
        E8["/api/users/{'{userId}'}/preferences"]
        E9["/api/users/{'{userId}'}/upload"]
        E10["/api/public/profiles"]
    end

    subgraph LAMBDA["⚡ Lambda Functions"]
        direction TB
        L1[user-profile-api]
        L2[trade-journal-api]
        L3[file-upload-handler]
        L4[public-profiles-api]
    end

    subgraph DYNAMO["🗄️ DynamoDB Tables"]
        direction TB
        D1[TradingExecutions]
        D2[MatchedTrades]
        D3[TradingStats]
        D4[TradeJournals]
        D5[UserProfiles]
        D6[UserPreferences]
        D7[UserBalance]
        D8[CommissionOverrides]
    end

    AUTH <--> CUP
    AUTH <--> CID

    TS --> E1 & E2 & E3
    JS --> E4 & E5
    BS --> E6
    US --> E7 & E8 & E10
    UPS --> E9

    E1 & E2 & E3 --> L1
    E4 & E5 --> L2
    E6 & E7 & E8 --> L1
    E9 --> L3
    E10 --> L4

    L1 --> D1 & D2 & D3 & D5 & D6 & D7
    L2 --> D4 & D8
    L3 --> S3[(S3 Bucket)]
    L4 --> D5

    style FRONTEND fill:#e3f2fd
    style COGNITO fill:#fff3e0
    style APIGW fill:#f3e5f5
    style LAMBDA fill:#e8f5e9
    style DYNAMO fill:#fce4ec
```

---

## 4. Data Upload & Processing Pipeline

```mermaid
flowchart TB
    subgraph USER["👤 User Action"]
        U1[Select Excel File]
    end

    subgraph FRONTEND["🖥️ Frontend"]
        F1[FileUploadModal.tsx]
        F2[uploadService.ts]
    end

    subgraph LAMBDA1["⚡ file-upload-handler"]
        L1A[Validate Request]
        L1B[Generate Presigned URL]
    end

    subgraph S3["📦 S3 Bucket"]
        S3A["users/{'{userId}'}/uploads/{'{filename}'}"]
    end

    subgraph LAMBDA2["⚡ trades-data (Python)"]
        L2A[Validate Excel]
        L2B[Archive Original to S3]
        L2C[Transform Data]
        L2D[Convert to JSON]
        L2E[Write to DynamoDB]
        L2F[Invoke trading-data-processor]
    end

    subgraph LAMBDA3["⚡ trading-data-processor"]
        L3A[Fetch All Executions]
        L3B[Sort Chronologically]
        L3C[Match FIFO Trades]
        L3D[Match Per-Position Trades]
        L3E[Delete Old Trades]
        L3F[Write Both Methods]
        L3G[Apply Commission Overrides]
        L3H[Calculate Statistics]
        L3I[Update TradingStats]
    end

    subgraph DYNAMO["🗄️ DynamoDB"]
        DT1[TradingExecutions]
        DT2[MatchedTrades]
        DT3[TradingStats]
    end

    U1 --> F1 --> F2
    F2 -->|POST /upload| L1A
    L1A --> L1B
    L1B -->|Return presignedUrl| F2
    F2 -->|PUT file| S3A

    S3A -->|S3 Event Trigger| L2A
    L2A --> L2B --> L2C --> L2D --> L2E
    L2E --> DT1
    L2E --> L2F

    L2F -->|Async Invoke| L3A
    L3A --> L3B --> L3C --> L3D --> L3E --> L3F
    L3F --> DT2
    L3F --> L3G --> L3H --> L3I
    L3I --> DT3

    style USER fill:#fff9c4
    style FRONTEND fill:#e3f2fd
    style LAMBDA1 fill:#e8f5e9
    style LAMBDA2 fill:#c8e6c9
    style LAMBDA3 fill:#a5d6a7
    style S3 fill:#ffecb3
    style DYNAMO fill:#fce4ec
```

---

## 5. Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant R as React App
    participant AC as AuthContext
    participant AS as authService
    participant COG as AWS Cognito
    participant API as API Gateway

    Note over U,API: Sign Up Flow
    U->>R: Enter email/password
    R->>AC: signUp()
    AC->>AS: signUp()
    AS->>COG: amplifySignUp()
    COG-->>AS: confirmationRequired
    AS-->>AC: redirect to confirm
    AC-->>R: navigate(/confirm-signup)
    
    U->>R: Enter confirmation code
    R->>AC: confirmSignUp()
    AC->>AS: confirmSignUp()
    AS->>COG: amplifyConfirmSignUp()
    COG-->>AS: autoSignIn
    AS-->>AC: User object
    AC-->>R: navigate(/app)

    Note over U,API: Sign In Flow
    U->>R: Enter credentials
    R->>AC: signIn()
    AC->>AS: signIn()
    AS->>COG: amplifySignIn()
    COG-->>AS: JWT tokens
    AS-->>AC: User object
    AC-->>R: isAuthenticated=true

    Note over U,API: API Call with Auth
    R->>API: GET /api/users/{userId}/trades
    Note right of R: Axios interceptor adds<br/>Authorization: Bearer {JWT}
    API->>COG: Validate JWT
    COG-->>API: Valid
    API-->>R: Trade data
```

---

## 6. Trade Matching Engine Logic

```mermaid
flowchart TB
    subgraph INPUT["📥 Input"]
        EX[Executions Array]
    end

    subgraph GROUP["📊 Group by Symbol"]
        G1[ES Executions]
        G2[MES Executions]
        G3[NQ Executions]
    end

    subgraph FIFO["🔢 FIFO Matching"]
        F1[Sort by DBKey]
        F2{PositionEffect > 0?}
        F3[Opening Long OR<br/>Closing Short]
        F4[Opening Short OR<br/>Closing Long]
        F5[Match with Queue]
        F6[Create Trade Record]
        F7[Calculate Commission<br/>per Contract]
    end

    subgraph PERPOS["📋 Per-Position Matching"]
        P1[Look for 'To Open' Status]
        P2[Accumulate Executions]
        P3{PositionQty = 0?}
        P4[Position Closed]
        P5[Sum All Fees]
        P6[Use PnLPerPosition]
        P7[Create Single Trade]
    end

    subgraph OUTPUT["📤 Output"]
        O1[FIFO Trades Array]
        O2[Per-Position Trades Array]
    end

    EX --> G1 & G2 & G3

    G1 --> F1
    F1 --> F2
    F2 -->|Yes| F3
    F2 -->|No| F4
    F3 & F4 --> F5 --> F6 --> F7
    F7 --> O1

    G1 --> P1
    P1 --> P2 --> P3
    P3 -->|No| P2
    P3 -->|Yes| P4 --> P5 --> P6 --> P7
    P7 --> O2

    style INPUT fill:#e3f2fd
    style FIFO fill:#e8f5e9
    style PERPOS fill:#fff3e0
    style OUTPUT fill:#f3e5f5
```

---

## 7. Nightly Stats Calculation

```mermaid
flowchart LR
    subgraph TRIGGER["⏰ EventBridge"]
        EB[Scheduled Rule<br/>2 AM UTC Daily]
    end

    subgraph LAMBDA["⚡ stats-calculator"]
        L1[Scan All Users]
        L2[For Each User:]
        L3[Get Preferences]
        L4[Query MatchedTrades]
        L5[Calculate Metrics]
        L6[Update TradingStats]
        L7[Update UserProfile<br/>Summary Stats]
    end

    subgraph DYNAMO["🗄️ DynamoDB"]
        D1[UserProfiles]
        D2[UserPreferences]
        D3[MatchedTrades]
        D4[TradingStats]
    end

    EB --> L1
    L1 --> D1
    D1 --> L2
    L2 --> L3 --> D2
    D2 --> L4 --> D3
    D3 --> L5 --> L6 --> D4
    L6 --> L7 --> D1

    style TRIGGER fill:#fff9c4
    style LAMBDA fill:#e8f5e9
    style DYNAMO fill:#fce4ec
```

---

## 8. Complete API Endpoint Reference

```mermaid
flowchart TB
    subgraph TRADES["Trade Endpoints"]
        T1["GET /api/users/{'{userId}'}/trades<br/>?method=fifo|perPosition"]
        T2["GET /api/users/{'{userId}'}/executions"]
        T3["GET /api/users/{'{userId}'}/stats<br/>?period=ALL|DAILY|WEEKLY|MONTHLY"]
    end

    subgraph JOURNAL["Journal Endpoints"]
        J1["GET /api/users/{'{userId}'}/journals"]
        J2["GET /api/users/{'{userId}'}/trades/{'{tradeId}'}/journal"]
        J3["POST /api/users/{'{userId}'}/trades/{'{tradeId}'}/journal"]
        J4["DELETE /api/users/{'{userId}'}/trades/{'{tradeId}'}/journal"]
        J5["POST /api/users/{'{userId}'}/trades/{'{tradeId}'}/journal/charts"]
        J6["DELETE .../journal/charts/{'{chartId}'}"]
    end

    subgraph BALANCE["Balance Endpoints"]
        B1["GET /api/users/{'{userId}'}/balance"]
        B2["POST /api/users/{'{userId}'}/balance"]
        B3["PUT /api/users/{'{userId}'}/balance/{'{entryId}'}"]
        B4["DELETE /api/users/{'{userId}'}/balance/{'{entryId}'}"]
        B5["GET /api/users/{'{userId}'}/balance/templates"]
        B6["POST /api/users/{'{userId}'}/balance/templates"]
    end

    subgraph USER["User Endpoints"]
        U1["GET /api/users/{'{userId}'}/profile"]
        U2["PUT /api/users/{'{userId}'}/profile"]
        U3["GET /api/users/{'{userId}'}/preferences"]
        U4["PUT /api/users/{'{userId}'}/preferences"]
    end

    subgraph UPLOAD["Upload Endpoints"]
        UP1["POST /api/users/{'{userId}'}/upload<br/>Returns presigned S3 URL"]
    end

    subgraph PUBLIC["Public Endpoints"]
        P1["GET /api/public/profiles<br/>Leaderboard"]
        P2["GET /api/public/profiles/{'{userId}'}"]
    end

    T1 --> TDATA[user-profile-api Lambda]
    T2 --> TDATA
    T3 --> TDATA
    
    J1 --> JDATA[trade-journal-api Lambda]
    J2 --> JDATA
    J3 --> JDATA
    J4 --> JDATA
    J5 --> JDATA
    J6 --> JDATA

    B1 --> BDATA[user-profile-api Lambda]
    B2 --> BDATA
    B3 --> BDATA
    B4 --> BDATA
    B5 --> BDATA
    B6 --> BDATA

    U1 --> UDATA[user-profile-api Lambda]
    U2 --> UDATA
    U3 --> UDATA
    U4 --> UDATA

    UP1 --> UPDATA[file-upload-handler Lambda]

    P1 --> PDATA[public-profiles-api Lambda]
    P2 --> PDATA

    style TRADES fill:#e3f2fd
    style JOURNAL fill:#e8f5e9
    style BALANCE fill:#fff3e0
    style USER fill:#f3e5f5
    style UPLOAD fill:#fce4ec
    style PUBLIC fill:#e0f7fa
```

---

## 9. State Management Flow

```mermaid
flowchart TB
    subgraph REACT_QUERY["📦 React Query (Server State)"]
        RQ1["trades<br/>staleTime: 5min"]
        RQ2["stats<br/>staleTime: 5min"]
        RQ3["journals<br/>staleTime: 5min"]
        RQ4["balance<br/>staleTime: 5min"]
        RQ5["profile<br/>staleTime: 5min"]
    end

    subgraph AUTH_CONTEXT["🔐 AuthContext (useReducer)"]
        AC1["user: User or null"]
        AC2[isAuthenticated: boolean]
        AC3[isLoading: boolean]
        AC4["error: string or null"]
    end

    subgraph NAV_CONTEXT["📍 NavigationContext (Zustand)"]
        NC1[sidebarOpen: boolean]
        NC2[modalState: object]
    end

    subgraph LOCAL_STATE["🔄 Component State (useState)"]
        LS1["calculationMethod: fifo or perPosition"]
        LS2[showGrossPL: boolean]
        LS3[filters: object]
        LS4[selectedTrade: Trade]
    end

    subgraph LOCAL_STORAGE["💾 localStorage"]
        LST1[balance-data]
        LST2[preferences-cache]
    end

    RQ1 & RQ2 & RQ3 & RQ4 & RQ5 --> REFETCH[Refetch on Mutation]
    AC1 --> RQ1 & RQ2 & RQ3 & RQ4

    LS1 --> RQ1
    LS2 --> CALC[StatisticsCalculator]

    style REACT_QUERY fill:#e3f2fd
    style AUTH_CONTEXT fill:#fff3e0
    style NAV_CONTEXT fill:#e8f5e9
    style LOCAL_STATE fill:#f3e5f5
    style LOCAL_STORAGE fill:#fce4ec
```

---

## 10. Lambda Function Dependencies

```mermaid
flowchart TB
    subgraph LAYER["📚 @tiltedtrades/calculations Layer"]
        L1[TradeMatchingEngine]
        L2[StatisticsCalculator]
        L3[CommissionCalculator]
        L4[ContractSpecsCalculator]
        L5[data/commissions.json]
        L6[data/tick-values.json]
    end

    subgraph LAMBDAS["⚡ Lambda Functions"]
        F1[trades-data<br/>Python 3.11]
        F2[trading-data-processor<br/>Node.js 20.x]
        F3[stats-calculator<br/>Node.js 20.x]
        F4[file-upload-handler<br/>Node.js 20.x]
        F5[user-profile-api<br/>Node.js 20.x]
        F6[trade-journal-api<br/>Node.js 20.x]
        F7[public-profiles-api<br/>Node.js 20.x]
        F8[post-registration-trigger<br/>Node.js 20.x]
    end

    F2 --> LAYER
    F3 --> LAYER
    
    F1 -->|Async Invoke| F2
    F2 -->|Updates| D1[(MatchedTrades)]
    F3 -->|EventBridge| D2[(TradingStats)]

    F4 -->|Generates| S3[(S3 Presigned URL)]
    S3 -->|Triggers| F1

    F8 -->|Cognito Post-Confirm| D3[(UserProfiles)]

    style LAYER fill:#fff9c4
    style LAMBDAS fill:#e8f5e9
```

---

*Diagrams generated using Mermaid syntax*
