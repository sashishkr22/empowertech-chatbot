# PlagPro Project Diagram Codes (Mermaid.js)

Copy the code blocks below into the [Mermaid Live Editor](https://mermaid.live/) to generate your project diagrams.

---

## 1. DFD Level 0 (Context Diagram)
**Placement:** Chapter 3, Section 3.8

```mermaid
graph LR
    User((User))
    Admin((Administrator))
    System[("PlagPro AI Support System")]

    User -- "Sends Message / Queries" --> System
    User -- "Submits Ticket Form" --> System
    System -- "AI Responses / Ticket ID" --> User
    
    Admin -- "Logs in / Views Tickets" --> System
    Admin -- "Sends Handoff Replies" --> System
    System -- "Handoff Alerts / Analytics" --> Admin
```

---

## 2. DFD Level 1 (Process Breakdown)
**Placement:** Chapter 3, Section 3.8

```mermaid
graph TD
    User((User))
    Admin((Administrator))
    
    P1[1.0 Chat Interaction]
    P2[2.0 Ticket Management]
    P3[3.0 Admin Dashboard]
    
    DB[(MongoDB Atlas)]
    DF[Dialogflow Engine]

    User -- "Chat Query" --> P1
    P1 <--> DF
    P1 -- "Fullfillment" --> User

    User -- "Form Data" --> P2
    P2 -- "Store Ticket" --> DB
    P2 -- "Return ID" --> User

    P3 -- "Fetch Data" --> DB
    DB -- "Ticket/Handoff List" --> P3
    P3 -- "Replies" --> DB
    Admin -- "Manage Tickets" --> P3
```

---

## 3. Sequence Diagram (Human Handoff Flow)
**Placement:** Chapter 4, Section 4.2

```mermaid
sequenceDiagram
    participant U as User (Frontend)
    participant S as Node.js Backend
    participant DB as MongoDB
    participant A as Flask Dashboard

    U->>S: Request Human Handoff
    S->>DB: Create Handoff Token (status: pending)
    Note over S,DB: Token stored with User ID
    loop Every 3 Seconds
        A->>DB: Poll for pending handoffs
        DB-->>A: Return new Handoff Token
    end
    A->>A: Trigger Admin Alert
    A->>S: Accept Handoff
    S->>U: Notify: "Agent is now online"
    A->>U: Send real-time message
```

---

## 4. Class Diagram (System Structure)
**Placement:** Chapter 4, Section 4.2

```mermaid
classDiagram
    class Server {
        +app: Express
        +port: Number
        +initRoutes()
        +listen()
    }
    class TicketManager {
        +createTicket(data)
        +getTicketStatus(id)
        +updateStatus(id, status)
    }
    class DialogflowClient {
        +projectId: String
        +sessionClient: Object
        +detectIntent(text)
    }
    class Database {
        +connectionString: String
        +connect()
        +saveRecord(collection, data)
        +findRecord(query)
    }

    Server --> DialogflowClient : Uses
    Server --> TicketManager : Delegates
    TicketManager --> Database : Persists
    Server --> Database : Syncs
```

---

## 5. Activity Diagram (User Ticket Creation)
**Placement:** Chapter 4, Section 4.2

```mermaid
stateDiagram-v2
    [*] --> UserClicksSupport
    UserClicksSupport --> ShowForm: Display Inline Form
    ShowForm --> ValidateInput: User Submits
    ValidateInput --> Error: Missing Fields
    Error --> ShowForm
    ValidateInput --> SendToAPI: Valid
    SendToAPI --> GenerateID: Node.js Processing
    GenerateID --> SaveToMongo: Write to DB
    SaveToMongo --> Success: Notify User
    Success --> [*]
```

---

## 6. Activity Diagram (Admin Dashboard Flow)
**Placement:** Chapter 4, Section 4.2

```mermaid
stateDiagram-v2
    [*] --> AdminLogin
    AdminLogin --> VerifyCredentials: Submit Login
    VerifyCredentials --> LoginFailed: Invalid
    LoginFailed --> AdminLogin
    VerifyCredentials --> DashboardHome: Valid
    
    state DashboardHome {
        [*] --> ViewStats
        ViewStats --> ViewTickets
        ViewTickets --> CheckHandoffs
    }
    
    DashboardHome --> SelectAction: Admin Action
    
    SelectAction --> UpdateTicket: Action = Manage Ticket
    UpdateTicket --> ChangeStatus: e.g., "In Progress" -> "Resolved"
    ChangeStatus --> SaveToMongo: Update DB
    
    SelectAction --> HandleHandoff: Action = Accept Handoff
    HandleHandoff --> OpenLiveChat: Initiate Real-time Sync
    OpenLiveChat --> SendMessage: Admin Replies
    SendMessage --> SaveToMongo: Update DB & Sync to User
    
    SaveToMongo --> DashboardHome
```
