# Submission Package: Cloud Deployment & CI/CD – Cinema Ticketing Platform

| Assessment Item | Details |
| :--- | :--- |
| **Internship Role** | DevOps & Cloud Engineering |
| **Assigned Project Title** | Cloud Deployment & CI/CD – Cinema Ticketing Platform |
| **Allocated Service Scope** | Show and Seat Reservation API (Domain: Cinema Hall Ticket Booking) |
| **Candidate Name** | Arin Kaushal |
| **Registration Number** | [Enter Registration Number] |
| **University Email** | arinkaushal06@gmail.com |
| **Repository URL** | `https://github.com/arinkaushal/ALGIONS_AI_LABS` |
| **Primary Branch** | `main` |
| **Final Commit ID** | `eca5923` |

---

## 1. Submission Form Entry Information

### Candidate Identification & Assignment Confirmation
- **Full Name**: Arin Kaushal
- **Registration Number**: [Enter Registration Number]
- **Email**: arinkaushal06@gmail.com
- **Role**: DevOps & Cloud Engineering
- **Project**: Cloud Deployment & CI/CD – Cinema Ticketing Platform

### Code & Version
- **Repository URL**: `https://github.com/arinkaushal/ALGIONS_AI_LABS`
- **Primary Branch**: `main`
- **Final Commit ID**: `eca5923` (or latest commit on `main`)
- **Container Image Reference**: `cinema-api:v1.0.0` / `cinema-api:latest`

### Demonstration
- **Demonstration Video**: `https://youtu.be/cinema-ticketing-devops-demo` *(Placeholder: 3–5 min technical walkthrough covering CI pipeline, deployment, observability, and chaos recovery)*
- **Deployment Mode**: Local VM / Docker Compose with HTTPS reverse proxy (`https://localhost:443`).

### Technology Stack & Architecture
- **Service Layer**: Node.js 22 LTS, Express, ES Modules, native `node:test` runner.
- **Database Engine**: Dual-engine architecture:
  - **Production/Orchestration**: PostgreSQL 16 Alpine with connection pooling and atomic row-level locks.
  - **Development/Local**: SQLite 3 with Write-Ahead Logging (WAL) and mutex-serialized transactions.
- **Reverse Proxy & Ingress**: Nginx 1.27 Alpine with TLS 1.3 termination, HTTP-to-HTTPS redirect, HSTS, rate limiting (30 req/s), security headers.
- **Containerization**: Multi-stage, minimal layer Dockerfile running as non-root user (`node`, UID 1000).
- **CI/CD Pipeline**: GitHub Actions (`.github/workflows/ci.yml` & `cd.yml`) with automated static analysis, secret detection, unit/integration/concurrency tests, Trivy container vulnerability scanning, and SemVer tagging.
- **Observability**: Structured JSON logging with request tracing (`X-Request-ID`), Prometheus `/metrics` exposition, decoupled `/healthz` (liveness) and `/readyz` (readiness) probes.

---

## 2. Evaluation Rubric Evidence Mapping (100 Marks)

| Evaluation Criterion | Marks | Evidence Provided in Repository | Verification Method |
| :--- | :---: | :--- | :--- |
| **Containerization & Reproducibility** | 20 | Multi-stage `Dockerfile` (non-root `USER node`), `docker-compose.yml`, persistent volume `postgres_data`, healthchecks. | `docker compose up -d` |
| **CI/CD Automation** | 20 | `.github/workflows/ci.yml`, automated lint, secret scan, vulnerability audit, container build, SemVer tagging. | `pnpm run lint` & `pnpm test` |
| **Deployment, Networking & Security** | 15 | Nginx reverse proxy with TLS 1.2/1.3, HTTP 301 redirect, rate limiting, dual-bridge network isolation (`backend-net`), non-root execution. | Inspect `docker/nginx/nginx.conf` |
| **Observability & Troubleshooting** | 15 | Structured JSON logs (`src/logger.js`), correlation ID `X-Request-ID`, `/healthz`, `/readyz`, `/metrics` Prometheus counters, chaos drill. | `node --test tests/chaos-recovery.test.mjs` |
| **Backup, Restore & Rollback** | 15 | Automated backup script (`scripts/backup.*`), restore with SHA256 verification (`scripts/restore.*`), documented rollback (`scripts/rollback.*`). | `node --test tests/backup-restore.test.mjs` |
| **Reliability & Documentation** | 10 | Comprehensive `README.md`, `ARCHITECTURE.md` with Mermaid diagrams, `RUNBOOK.md` incident playbooks. | Verified across repository |
| **Domain API Correctness** | 5 | Concurrency race condition prevention (Test 1: 1 confirmed, 1 rejected 409), seat hold expiry, ticket ID generation, cancellation API. | `node --test tests/concurrency.test.mjs` |
| **Total Marks** | **100** | **Complete production-style engineering solution** | `node scripts/verify-all.js` |

---

## 3. Five Acceptance Criteria Verification Status

```
========================================================================
CINEMA TICKET RESERVATION SERVICE: FULL ACCEPTANCE TEST SUITE
========================================================================
[1/5] Concurrency Race Condition Control  : PASSED (1 Confirmed, 1 Rejected with HTTP 409)
[2/5] Clean Environment Reproducibility   : PASSED (Seeded Shows, Halls & Seats)
[3/5] CI Test Execution & Version Tagging : PASSED (Lint, Tests, Workflows Verified)
[4/5] Health, Logs & Chaos Recovery Drill : PASSED (Outage detected 503 -> Recovered 200)
[5/5] Backup, Restore & Rollback Drill    : PASSED (Verified Data Integrity & Rollback)
========================================================================
FINAL RESULT: ALL_5_ACCEPTANCE_TESTS_PASSED
Detailed evidence: ./evidence/acceptance-test-report.json
========================================================================
```

---

## 4. Declarations & Attribution
- **Originality**: The architecture, design, and implementation were engineered to satisfy all technical rubrics.
- **Explainability**: All code, container configurations, transactional locks, and operational scripts can be explained in depth during the technical walkthrough.
- **Zero Secrets**: No real passwords, API tokens, or private keys have been committed. Configuration templates use `.env.example`.
- **AI Tool Attribution**: Antigravity AI Assistant was utilized for scaffolding boilerplate, test automation scripts, and documentation structure.

