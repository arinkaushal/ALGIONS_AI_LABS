# ==============================================================================
# Master Verification Script - Executes all 5 Acceptance Criteria End-to-End
# ==============================================================================
$ErrorActionPreference = "Stop"

Write-Host "Executing Master Verification Test Suite..."
node scripts/verify-all.js
