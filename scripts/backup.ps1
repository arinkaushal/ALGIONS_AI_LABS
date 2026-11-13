# ==============================================================================
# Automated Database Backup Script (PowerShell / Windows)
# ==============================================================================
param(
    [string]$BackupDir = "./backups"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"

if ($env:DATABASE_URL -match "^postgres") {
    $backupFile = Join-Path $BackupDir "cinema_pg_$timestamp.sql"
    Write-Host "[$(Get-Date -Format s)] Initiating PostgreSQL database backup via Docker to $backupFile..."
    docker exec -t cinema-postgres-db pg_dump -U ($env:POSTGRES_USER ?? "cinema_user") ($env:POSTGRES_DB ?? "cinema_db") > $backupFile
    $hash = (Get-FileHash -Path $backupFile -Algorithm SHA256).Hash
    Set-Content -Path "$backupFile.sha256" -Value "$hash  cinema_pg_$timestamp.sql"
    Write-Host "[$(Get-Date -Format s)] PostgreSQL backup completed successfully with SHA256 checksum: $hash"
} else {
    Write-Host "[$(Get-Date -Format s)] Executing database snapshot backup..."
    node scripts/backup.js $BackupDir
}
