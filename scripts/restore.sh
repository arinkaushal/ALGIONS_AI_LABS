#!/usr/bin/env bash
# ==============================================================================
# Automated Database Restore Script with Checksum Verification
# ==============================================================================
set -euo pipefail

BACKUP_FILE="${1:-}"

if [[ -z "${BACKUP_FILE}" ]]; then
    echo "Usage: ./scripts/restore.sh <path-to-backup-file>"
    echo "Auto-detecting latest backup file in ./backups/..."
    BACKUP_FILE=$(find ./backups -name "backup_*.db" -o -name "cinema_pg_*.sql.gz" | sort -r | head -n 1)
fi

echo "[$(date -Iseconds)] Initiating restore from: ${BACKUP_FILE}..."

if [[ "${DATABASE_URL:-}" =~ ^postgres ]]; then
    if [[ -f "${BACKUP_FILE}.sha256" ]]; then
        echo "Verifying SHA256 checksum..."
        sha256sum -c "${BACKUP_FILE}.sha256"
    fi
    echo "Restoring PostgreSQL database..."
    gunzip -c "${BACKUP_FILE}" | docker exec -i cinema-postgres-db psql -U "${POSTGRES_USER:-cinema_user}" "${POSTGRES_DB:-cinema_db}"
    echo "PostgreSQL database restore completed successfully."
else
    node scripts/restore.js "${BACKUP_FILE}"
fi

