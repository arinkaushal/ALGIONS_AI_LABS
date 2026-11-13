#!/usr/bin/env bash
# ==============================================================================
# Generate Self-Signed TLS Certificates for Nginx Reverse Proxy (POSIX/Linux)
# ==============================================================================
set -euo pipefail

CERT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../docker/nginx/certs" && pwd)"
mkdir -p "${CERT_DIR}"

KEY_FILE="${CERT_DIR}/server.key"
CRT_FILE="${CERT_DIR}/server.crt"

echo "Generating self-signed TLS certificates for localhost..."
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "${KEY_FILE}" \
    -out "${CRT_FILE}" \
    -subj "/C=US/ST=DevOps/L=Cloud/O=CinemaCorp/OU=API/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

chmod 600 "${KEY_FILE}"
chmod 644 "${CRT_FILE}"

echo "Certificates generated successfully:"
echo "  Private Key: ${KEY_FILE}"
echo "  Certificate: ${CRT_FILE}"
