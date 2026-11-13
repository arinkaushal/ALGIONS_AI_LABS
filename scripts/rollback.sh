#!/usr/bin/env bash
# ==============================================================================
# Automated Application Rollback Procedure
# ==============================================================================
set -euo pipefail

TARGET_TAG="${1:-v1.0.0-stable}"
echo "[$(date -Iseconds)] Initiating application container rollback to target tag: ${TARGET_TAG}..."

node scripts/rollback.js
