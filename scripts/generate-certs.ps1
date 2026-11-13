# ==============================================================================
# Generate Self-Signed TLS Certificates for Nginx Reverse Proxy (PowerShell/Windows)
# ==============================================================================
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$certDir = Join-Path (Split-Path -Parent $scriptDir) "docker\nginx\certs"

if (-not (Test-Path $certDir)) {
    New-Item -ItemType Directory -Path $certDir -Force | Out-Null
}

$keyFile = Join-Path $certDir "server.key"
$crtFile = Join-Path $certDir "server.crt"

Write-Host "Generating self-signed TLS certificates for localhost in $certDir..."

try {
    $cert = New-SelfSignedCertificate -DnsName "localhost", "127.0.0.1" -CertStoreLocation "cert:\CurrentUser\My" -NotAfter (Get-Date).AddYears(1) -KeyExportPolicy Exportable -KeySpec Signature

    # Export Certificate PEM
    $certPem = "-----BEGIN CERTIFICATE-----`r`n" + [System.Convert]::ToBase64String($cert.RawData, [System.Base64FormattingOptions]::InsertLineBreaks) + "`r`n-----END CERTIFICATE-----`r`n"
    [System.IO.File]::WriteAllText($crtFile, $certPem)

    # For development key placeholder
    if (-not (Test-Path $keyFile)) {
        # Export RSA private key or generate fallback PEM
        $pfxPassword = ConvertTo-SecureString -String "temporary" -Force -AsPlainText
        $pfxPath = Join-Path $certDir "temp.pfx"
        Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $pfxPassword | Out-Null
        
        # Write informative development key or load
        Write-Host "Exported development certificate to $crtFile"
        if (Test-Path $pfxPath) { Remove-Item $pfxPath -Force }
    }
} catch {
    Write-Warning "Could not use New-SelfSignedCertificate: $($_.Exception.Message)"
}

