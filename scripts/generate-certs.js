import fs from 'fs';
import path from 'path';
import selfsigned from 'selfsigned';

async function generateCerts() {
  console.log('Generating self-signed TLS certificates for reverse proxy...');

  const certDir = path.resolve('./docker/nginx/certs');
  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir, { recursive: true });
  }

  const attrs = [
    { name: 'commonName', value: 'localhost' },
    { name: 'countryName', value: 'US' },
    { shortName: 'ST', value: 'Cloud' },
    { name: 'localityName', value: 'Metro' },
    { name: 'organizationName', value: 'Cinema Ticket Platform' },
    { shortName: 'OU', value: 'DevOps & Reliability' }
  ];

  const pems = await selfsigned.generate(attrs, {
    days: 365,
    keySize: 2048,
    algorithm: 'sha256',
    extensions: [
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'localhost' },
          { type: 7, ip: '127.0.0.1' }
        ]
      }
    ]
  });

  const keyPath = path.join(certDir, 'server.key');
  const crtPath = path.join(certDir, 'server.crt');

  fs.writeFileSync(keyPath, pems.private, 'utf8');
  fs.writeFileSync(crtPath, pems.cert, 'utf8');

  console.log('TLS certificates generated successfully:');
  console.log(`  Private Key: ${keyPath}`);
  console.log(`  Certificate: ${crtPath}`);
}

generateCerts().catch((err) => {
  console.error('Failed generating certificates:', err);
  process.exit(1);
});
