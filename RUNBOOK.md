# Operations Runbook: Cinema Ticket Reservation Service

This runbook provides actionable procedures for operators and SREs responsible for deploying, maintaining, troubleshooting, and recovering the Cinema Ticket Reservation API.

---

## 1. Quick Reference & Port Map

| Component | Container Name | Host Port | Internal Port | Protocol | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Reverse Proxy** | `cinema-reverse-proxy` | `80` | `80` | HTTP | Redirects to HTTPS (Port 443) |
| **Reverse Proxy** | `cinema-reverse-proxy` | `443` | `443` | HTTPS / TLS 1.3 | Public API Ingress, Rate Limiting, SSL Termination |
| **Cinema API** | `cinema-api-service` | Unexposed | `3000` | HTTP | Internal Microservice API |
| **Database** | `cinema-postgres-db` | Unexposed | `5432` | TCP | PostgreSQL 16 Alpine Database |

---

## 2. Deployment Procedures

### 2.1 Standard Containerized Deployment (Production)
```bash
# 1. Clone repository & configure environment variables
cp .env.example .env
# Edit .env with production credentials (DO NOT commit .env!)

# 2. Generate or verify TLS certificates
./scripts/generate-certs.sh     # Linux / POSIX
# or in PowerShell: .\scripts\generate-certs.ps1

# 3. Build images and start all services
docker compose up -d --build

# 4. Verify running container health
docker compose ps
```

### 2.2 Local Zero-Dependency Development Mode
For quick local verification without external Docker daemon:
```bash
# Install dependencies
pnpm install

# Run database migrations and seed catalog
pnpm run db:migrate
pnpm run db:seed

# Start the service
pnpm start
# Service listens on http://127.0.0.1:3000
```

---

## 3. Health & Readiness Verification

### 3.1 Probes
- **Liveness Probe**: `GET /healthz`
  - Verifies that the Node.js event loop is operational.
  - Expected Response: `200 OK`
  ```bash
  curl -k -i https://localhost/healthz
  ```
  ```json
  {
    "status": "ok",
    "uptime_seconds": 124,
    "timestamp": "2026-11-13T12:00:00.000Z",
    "service": "cinema-ticket-reservation-service",
    "version": "1.0.0"
  }
  ```

- **Readiness Probe**: `GET /readyz`
  - Actively verifies database query connectivity and transaction readiness.
  - Expected Response: `200 OK` (or `503 Service Unavailable` if database is down)
  ```bash
  curl -k -i https://localhost/readyz
  ```
  ```json
  {
    "status": "ready",
    "database": "connected",
    "engine": "postgresql",
    "timestamp": "2026-11-13T12:00:00.000Z"
  }
  ```

### 3.2 Prometheus Metrics
- **Metrics Endpoint**: `GET /metrics`
  ```bash
  curl -k -s https://localhost/metrics | grep cinema_
  ```
  Key indicators:
  - `cinema_http_requests_total`: Request counters by route and HTTP status code.
  - `cinema_http_request_duration_seconds`: Latency percentiles.
  - `cinema_booking_operations_total`: Holds, bookings, cancellations by status.
  - `cinema_active_seat_holds`: Current gauge of in-flight seat holds.
  - `cinema_database_connected`: `1` = connected, `0` = down.

---

## 4. Log Inspection & Troubleshooting

All logs are emitted as structured JSON lines (`JSONL`) to standard output/standard error for automatic parsing by centralized log forwarders.

### 4.1 Viewing Logs
```bash
# View real-time application logs
docker compose logs -f cinema-api

# View Nginx ingress access logs
docker compose logs -f reverse-proxy

# View Database engine logs
docker compose logs -f postgres-db
```

### 4.2 Querying Logs for Errors with jq
```bash
# Filter errors from application logs
docker compose logs cinema-api --no-log-prefix | jq 'select(.level=="ERROR")'

# Trace a specific transaction via Request ID
docker compose logs cinema-api --no-log-prefix | jq 'select(.requestId=="<REQUEST_UUID>")'
```

---

## 5. Backup & Recovery Operations

### 5.1 Automated Database Backup
Takes an atomic database snapshot, computes SHA256 integrity checksum, and stores in `./backups/`:
```bash
# Linux / macOS / CI:
./scripts/backup.sh

# Windows PowerShell:
.\scripts\backup.ps1
```

### 5.2 Automated Database Restore
Restores the database state from a validated backup snapshot:
```bash
# Linux / macOS / CI:
./scripts/restore.sh ./backups/backup_TIMESTAMP.db

# Windows PowerShell:
.\scripts\restore.ps1 -BackupFile ./backups/backup_TIMESTAMP.db
```

### 5.3 Automated Master Verification Drill
Runs all 5 acceptance criteria (concurrency race condition, clean build, CI pipeline, chaos recovery, backup/restore) and outputs evidence:
```bash
node scripts/verify-all.js
# Output saved to: ./evidence/acceptance-test-report.json
```

---

## 6. Rollback Procedures

### 6.1 Application Version Rollback
If a newly deployed version introduces regressions or critical bugs:
```bash
# Option A: Automated rollback script
node scripts/rollback.js
# or: ./scripts/rollback.sh v1.0.0-stable

# Option B: Manual container rollback
docker compose stop cinema-api
docker tag cinema-api:v1.0.0-stable cinema-api:latest
docker compose up -d cinema-api

# Verify recovery
curl -k https://localhost/readyz
```

### 6.2 Full State & Application Rollback (Disaster Recovery)
If a release corrupted both database state and application code:
1. Stop ingress traffic: `docker compose stop reverse-proxy`
2. Restore previous database snapshot: `./scripts/restore.sh <pre-release-backup>`
3. Roll back application image to previous stable tag: `./scripts/rollback.sh <stable-tag>`
4. Re-enable ingress: `docker compose start reverse-proxy`
5. Verify `/readyz` returns `200 OK`.

---

## 7. Incident Response Playbooks

### Playbook A: Database Outage / 503 Readiness Failures
1. **Symptom**: Load balancer alerts `503 Service Unavailable` on `/readyz`.
2. **Diagnosis**:
   ```bash
   docker compose ps postgres-db
   docker compose logs --tail=50 postgres-db
   ```
3. **Action**:
   - If container stopped: `docker compose restart postgres-db`
   - If storage full: inspect named volume `docker system df -v`
   - Test connectivity: `docker exec -it cinema-api-service wget -qO- http://localhost:3000/readyz`

### Playbook B: Concurrent Booking Storm / High 409 Conflicts
1. **Symptom**: High volume of HTTP 409 responses on `/api/v1/bookings`.
2. **Analysis**: Check Prometheus metric `cinema_booking_operations_total{status="conflict"}`. This indicates multiple customers competing for the same show/seats. This is **expected and correct** behavior: the atomic concurrency lock prevents double-booking.
3. **Verification**: Query database to confirm no double bookings exist:
   ```sql
   SELECT show_id, seat_number, COUNT(*) FROM booking_seats WHERE status = 'ACTIVE' GROUP BY show_id, seat_number HAVING COUNT(*) > 1;
   ```
   Must return 0 rows.
