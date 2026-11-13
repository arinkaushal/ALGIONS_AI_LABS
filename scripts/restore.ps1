# ==============================================================================
# Automated Database Restore Script (PowerShell / Windows)
# ==============================================================================
param(
    [string]$BackupFile = ""
)

$ErrorActionPreference = "Stop"

if (-not $BackupFile) {
    Write-Host "Auto-detecting latest backup file in ./backups/..."
    $latest = Get-ChildItem -Path "./backups" -Filter "backup_*.db" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $latest) {
        throw "No backup files found in ./backups/"
    }
    $BackupFile = $latest.FullName
}

Write-Host "[$(Get-Date -Format s)] Initiating database restore from $BackupFile..."

if ($env:DATABASE_URL -match "^postgres") {
    $checksumFile = "$BackupFile.sha256"
    if (Test-Path $checksumFile) {
        $expected = (Get-Content -Path $checksumFile).Trim().Split()[0]
        $calculated = (Get-FileHash -Path $BackupFile -Algorithm SHA256).Hash
        if ($expected -ne $calculated) {
            throw "Checksum mismatch! Expected: $expected, Calculated: $calculated"
        }
        Write-Host "Checksum verified: $calculated"
    }
    Get-Content $BackupFile | docker exec -i cinema-postgres-db psql -U ($env:POSTGRES_USER ?? "cinema_user") ($env:POSTGRES_DB ?? "cinema_db")
    Write-Host "PostgreSQL database restore completed."
} else {
    node scripts/restore.js $BackupFile
}
