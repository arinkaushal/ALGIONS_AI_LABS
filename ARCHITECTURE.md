# Architecture Specification: Cinema Ticket Reservation Service

## 1. System Overview & Ingress Architecture

The Cinema Ticket Reservation Platform is architected as an observable, highly available microservice running within a segmented container network behind an Nginx reverse proxy providing TLS termination and rate limiting.

```mermaid
flowchart TD
    Client(["Client / Web Browser / Mobile App"]) -->|HTTPS :443 / TLS 1.2+1.3| Nginx["Nginx Reverse Proxy\n(Rate Limiting, HSTS, TLS Termination)"]
    Client -.->|HTTP :80| Redirect["HTTP Redirect (301) to HTTPS"]
    Redirect -.-> Nginx

    subgraph "Frontend Network (Bridge)"
        Nginx
    end

    subgraph "Backend Network (Isolated Bridge)"
        Nginx -->|Reverse Proxy :3000| App["Cinema Reservation Service\n(Node.js 22 Multi-Stage / Non-Root)"]
        App -->|Connection Pool :5432| DB[("PostgreSQL 16 Alpine\n(Persistent Volume: postgres_data)")]
        App -.->|Local/Dev Mode| SQLite[("SQLite Embedded Database\n(WAL Mode + Mutex Serialization)")]
    end

    subgraph "Observability Stack"
        Prometheus["Prometheus Scraper"] -->|GET /metrics| App
        K8s["K8s / Docker Engine Probes"] -->|GET /healthz\nGET /readyz| App
        LogCollector["Log Aggregator\n(Fluentd / CloudWatch / Datadog)"] -->|JSON Stdout/Stderr| App
    end
```

---

## 2. Network Topology & Security Boundaries

- **Principle of Least Privilege**:
  - The PostgreSQL database port (`5432`) is **not exposed** on the host. It resides entirely on the private internal Docker bridge network (`backend-net`).
  - Only the Nginx reverse proxy binds public host ports (`80` and `443`).
  - Application process runs as an unprivileged non-root user (`node`, UID 1000) inside an Alpine-based container.
  - Secret management: No real credentials or `.env` files are committed. All secrets are injected through environment variables.
  - Rate limiting: Nginx enforces a 30 req/sec rate limit with burst allowance to guard against DDoS or reservation scraping bots.

```mermaid
graph LR
    subgraph Host Network
        P80[Port 80 HTTP]
        P443[Port 443 HTTPS]
    end

    subgraph Docker Bridge: frontend-net
        NGINX_SRV[Nginx Proxy Container]
    end

    subgraph Docker Bridge: backend-net
        APP_SRV[Node.js App Container]
        PG_SRV[PostgreSQL Database Container]
    end

    P80 --> NGINX_SRV
    P443 --> NGINX_SRV
    NGINX_SRV -->|proxy_pass:3000| APP_SRV
    APP_SRV -->|tcp:5432| PG_SRV
```

---

## 3. Database Entity Relationship (ER) Diagram

```mermaid
erDiagram
    CINEMAS ||--o{ HALLS : contains
    HALLS ||--o{ SEATS : has
    MOVIES ||--o{ SHOWS : features
    HALLS ||--o{ SHOWS : hosts
    SHOWS ||--o{ SEAT_HOLDS : holds
    SHOWS ||--o{ BOOKINGS : books
    BOOKINGS ||--|{ BOOKING_SEATS : contains
    SHOWS ||--o{ BOOKING_SEATS : reserves

    CINEMAS {
        string id PK
        string name
        string location
        datetime created_at
    }

    HALLS {
        string id PK
        string cinema_id FK
        string name
        int total_capacity
        datetime created_at
    }

    SEATS {
        string id PK
        string hall_id FK
        string seat_number
        string tier
        datetime created_at
    }

    MOVIES {
        string id PK
        string title
        int duration_minutes
        string rating
        string genre
        datetime created_at
    }

    SHOWS {
        string id PK
        string movie_id FK
        string hall_id FK
        datetime start_time
        datetime end_time
        numeric base_price
        string status
        datetime created_at
    }

    SEAT_HOLDS {
        string id PK
        string show_id FK
        string seat_number
        string hold_token
        string customer_email
        datetime expires_at
        datetime created_at
    }

    BOOKINGS {
        string id PK
        string booking_reference UK
        string show_id FK
        string customer_name
        string customer_email
        numeric total_amount
        string status
        string qr_payload
        datetime created_at
        datetime updated_at
    }

    BOOKING_SEATS {
        string id PK
        string booking_id FK
        string show_id FK
        string seat_number
        numeric price
        string status
        datetime created_at
    }
```

---

## 4. Concurrency & Race Condition Sequence Diagram

Enforcing that **two concurrent booking attempts for the same show and seat cannot both confirm** is achieved through database-level transactional locks and partial unique indices.

```mermaid
sequenceDiagram
    autonumber
    actor Alice as Customer Alice
    actor Bob as Customer Bob
    participant API as Reservation Service API
    participant DB as Database Engine (PostgreSQL / SQLite)

    Note over Alice,Bob: Simultaneous attempts to book Show #1, Seat A5
    Alice->>+API: POST /api/v1/bookings (show_id: 1, seat: A5)
    Bob->>+API: POST /api/v1/bookings (show_id: 1, seat: A5)

    Note over API,DB: Transaction A (Alice) & Transaction B (Bob) Start Concurrently
    API->>DB: BEGIN TRANSACTION (Immediate Write Lock / Advisory Lock)
    DB-->>API: Lock Granted to Alice's Transaction

    API->>DB: Check if Seat A5 is Booked (status = ACTIVE)
    DB-->>API: Seat A5 is AVAILABLE

    API->>DB: INSERT INTO bookings & INSERT INTO booking_seats (Seat A5, status=ACTIVE)
    DB-->>API: Insert Successful (Unique Index idx_unique_active_seat Satisfied)

    API->>DB: COMMIT TRANSACTION
    DB-->>API: Transaction Committed
    API-->>Alice: HTTP 201 Created (Booking Reference: TKT-20261113-ABC123XY)

    Note over DB: Bob's Transaction Acquires Next Turn
    API->>DB: Check if Seat A5 is Booked (status = ACTIVE)
    DB-->>API: Seat A5 is ALREADY BOOKED (by Alice)
    API->>DB: ROLLBACK TRANSACTION
    API-->>Bob: HTTP 409 Conflict (Error: SEAT_ALREADY_BOOKED)

    Note over Alice,Bob: Exactly 1 confirmed, 1 rejected. Zero double-booking.
```

---

## 5. Automated Backup, Restore & Rollback Lifecycle

```mermaid
flowchart TD
    Cron["Scheduled Backup Job\n(scripts/backup.sh / .ps1)"] --> Snapshot["1. Snapshot DB\n(pg_dump / SQLite Checkpoint)"]
    Snapshot --> Checksum["2. Compute SHA256 Checksum\n(backup_timestamp.sha256)"]
    Checksum --> Storage[("Backup Storage / Volume")]

    Incident["Incident / Corruption / Bad Deployment"] --> RestoreTrigger["Trigger Restore Script\n(scripts/restore.sh / .ps1)"]
    RestoreTrigger --> VerifySum{"3. Checksum Match?"}
    VerifySum -- No --> Abort["Halt & Alert Operations"]
    VerifySum -- Yes --> Apply["4. Apply Snapshot Atomically"]
    Apply --> VerifyRows["5. Validate Row Counts & Integrity"]
    VerifyRows --> Probe["6. Health & Readiness Probe\n(/healthz & /readyz)"]
    Probe --> Operational["Service Restored Healthy (200 OK)"]
```
