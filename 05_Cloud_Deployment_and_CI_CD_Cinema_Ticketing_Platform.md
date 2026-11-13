
Cloud Deployment & CI/CD – Cinema Ticketing Platform

DevOps & Cloud Engineering | Advanced individual project assessment                                                                         |
| Internship role     | DevOps & Cloud Engineering                                                                                                                                 |
| Assigned project    | Cloud Deployment & CI/CD – Cinema Ticketing Platform                                                                                                       |
| Submission deadline | 15 calendar days from the assignment issue date/time stated in the individualized invitation. The invitation will specify the exact deadline and timezone. |

**Your mission** Make a small domain-specific service reproducibly buildable, deployable, observable and recoverable using production-style engineering practices. Your assigned domain is Cinema Hall Ticket Booking. Complete this one project only; do not build the other domains.

# 1. Business problem and required scope

Deploy a small cinema show/seat reservation API; do not build the complete cinema booking portal. Your assessment is primarily about build, release, deployment, reliability and operations—not the breadth of the business application.

**Allocated service:** Show and seat reservation API.

- Expose health/readiness endpoints and APIs for shows, seat maps and reservation creation.
- Implement temporary seat hold/expiry or an equivalent safe reservation mechanism.
- Enforce one confirmed booking per seat per show, including concurrent requests.
- Generate a unique booking/ticket identifier and support simulated cancellation.
- Include seed shows/seats and API tests.

# 2. Technical implementation expectations

- Build or adapt a small domain service implementing the specific API workflow in this brief; do not build the entire business application.
- Containerize the service using a secure, reproducible Dockerfile. Run as a non-root user where practical and avoid unnecessary image layers/dependencies.
- Provide Docker Compose or equivalent orchestration for the app and database, with persistent storage and health checks.
- Create CI that runs formatting/lint/static checks, tests and an image build on pull request or push. Use clear version tags and avoid committing secrets.
- Demonstrate a deployment target (local VM/container is acceptable) with a reverse proxy and HTTPS configuration; actual paid cloud hosting is not required.
- Use environment-based configuration, least privilege, secret management and appropriate network exposure. Include a dependency/container scan where feasible.
- Provide health/readiness checks, structured logs and actionable troubleshooting information; metrics are a stretch goal.
- Demonstrate database backup and restore, restart/recovery and a documented rollback procedure.
- Provide infrastructure/deployment configuration and a concise runbook so another person can reproduce the setup.

# 3. Acceptance tests you must demonstrate

1. Two concurrent attempts for the same show/seat cannot both confirm.
2. A clean environment can build and start the service using documented steps.
3. A CI run executes checks/tests and produces a versioned build artifact/image.
4. Show health/readiness and logs; deliberately stop or break one service and demonstrate detection/recovery.
5. Restore a backup or show a rollback procedure with evidence.

# 4. Required submission package

- Repository with service source, Dockerfile, Compose/orchestration files, CI workflow and infrastructure/deployment configuration.
- README with build/run/deploy instructions, environment variables, port map and rollback procedure.
- Architecture diagram and a concise operations runbook covering deploy, restart, logs, backup/restore and incident response.
- Pipeline run URL/screenshot, image tag/digest and deployment/health evidence.
- Backup/restore evidence and test output for the allocated business API rule.
- 3–5 minute demo showing pipeline, deployed service, health/logs and a failure/recovery or restore scenario.

# 5. What you must enter in the submission form

| **Form section**           | **Required information**                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Candidate identification   | Full name, registration number and university email.                                                       |
| Assignment confirmation    | Internship role and exact assigned project title.                                                          |
| Code and version           | Repository URL, primary branch and final commit ID; provide reviewer access if private.                    |
| Demonstration              | 3–5 minute video link and live demo URL if available; otherwise declare local-only demo.                   |
| Documentation              | Technical report/README link and architecture/schema diagram link where applicable.                        |
| Technology and limitations | Technology stack, setup notes and known incomplete features/assumptions.                                   |
| AI and attribution         | AI tools used, purpose of use, dataset/library/source attribution.                                         |
| Declarations               | Originality, ability to explain the code, no real sensitive data/secrets, and confirmation all links work. |

**Role-specific form fields:** CI/CD pipeline run URL, deployed service URL or local deployment evidence, image tag/digest, architecture diagram and backup/restore/rollback evidence.

# 6. Evaluation rubric (100 marks)

| **Criterion**                        | **Marks** | **Evidence reviewers will assess**                                              |
| ------------------------------------ | --------- | ------------------------------------------------------------------------------- |
| Containerization and reproducibility | 20        | Secure image, deterministic build, Compose/orchestration and persistent data.   |
| CI/CD automation                     | 20        | Automated checks/tests/build, artifact tagging and safe pipeline configuration. |
| Deployment, networking and security  | 15        | Deployment design, proxy/TLS configuration, secrets and least privilege.        |
| Observability and troubleshooting    | 15        | Health/readiness, logs, failure diagnosis and recovery.                         |
| Backup, restore and rollback         | 15        | Working data recovery and documented operational procedures.                    |
| Reliability and documentation        | 10        | Repeatable steps, runbook and maintainability.                                  |
| Domain API correctness               | 5         | Allocated service workflow and tests satisfy domain rules.                      |

# 7. Schedule and submission rules

| **Milestone** | **Suggested plan**                                                                                                                                 |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Day 1         | Read the brief, map the application components and deployment objective, identify operational risks and create the repository.                     |
| Days 2–4      | Design the deployment architecture, environment strategy, networking and secrets approach; create container and local orchestration configuration. |
| Days 5–8      | Implement the CI/CD workflow, automated build/test stages, deployment procedure, reverse proxy and health checks.                                  |
| Days 9–11     | Add logging, monitoring, security checks, backup and restore procedures, environment separation and documented release/rollback steps.             |
| Days 12–13    | Run failure and recovery drills, test backup restoration and rollback, fix pipeline/infrastructure issues and verify reproducible deployment.      |
| Day 14        | Complete the architecture diagram, README, pipeline evidence, runbook, backup/restore evidence and 3–5 minute demo video.                          |
| Day 15        | Perform a clean deployment from documented instructions, verify links and permissions, remove secrets from the repository, and submit the form.    |

- The reviewer must be able to open the repository, report and video. A broken or permission-blocked link may be treated as missing evidence.
- Do not commit .env files, passwords, access tokens, private keys, personal data or live payment credentials. Include only a placeholder .env.example.
- Use your own free-tier/local environment.
- Shortlisted candidates will attend a 15-minute technical walkthrough and a 10-minute live change/debugging task. You must explain your own architecture and modify your own work.
- Build a strong, correct MVP rather than many incomplete screens. State clearly what is unfinished.

**Final reminder** Your submission is evaluated on evidence of engineering ability, problem-solving, correctness and ownership. A visually polished screen, a large codebase or AI-generated output without understanding will not substitute for a working, explainable solution.