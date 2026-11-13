# ==============================================================================
# Automated Application Rollback Procedure (PowerShell / Windows)
# ==============================================================================
param(
    [string]$TargetTag = "v1.0.0-stable"
)

$ErrorActionPreference = "Stop"

Write-Host "[$(Get-Date -Format s)] Initiating application container rollback to target tag: $TargetTag..."

node scripts/rollback.js
