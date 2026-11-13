#!/usr/bin/env bash
# ==============================================================================
# Automated Database Backup Script (PostgreSQL / SQLite)
# ==============================================================================
set -euo pipefail

BACKUP_DIR="${1:-./backups}"
mkdir -p "${BACKUP_DIR}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

if [[ "${DATABASE_URL:-}" =~ ^postgres ]]; then
    BACKUP_FILE="${BACKUP_DIR}/cinema_pg_${TIMESTAMP}.sql.gz"
    echo "[$(date -Iseconds)] Initiating PostgreSQL database backup to ${BACKUP_FILE}..."
    docker exec -t cinema-postgres-db pg_dump -U "${POSTGRES_USER:-cinema_user}" "${POSTGRES_DB:-cinema_db}" | gzip > "${BACKUP_FILE}"
    sha256sum "${BACKUP_FILE}" > "${BACKUP_FILE}.sha256"
    echo "[$(date -Iseconds)] PostgreSQL backup completed successfully with SHA256 checksum."
else
    echo "[$(date -Iseconds)] Executing Node/SQLite database snapshot backup..."
    node scripts/backup.js "${BACKUP_DIR}"
fi
