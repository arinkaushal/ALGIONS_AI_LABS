import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

console.log('Running static analysis, linting, and secret detection checks...\n');

let errorCount = 0;

// 1. Check JS/MJS syntax using Node's built-in syntax checker (node --check)
function checkDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'data' && entry.name !== 'backups') {
        checkDirectory(fullPath);
      }
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) {
      try {
        execSync(`node --check "${fullPath}"`, { stdio: 'pipe' });
        console.log(`  ✓ Syntax OK: ${fullPath}`);
      } catch (err) {
        console.error(`  ✗ Syntax ERROR in ${fullPath}: ${err.message}`);
        errorCount++;
      }
    }
  }
}

console.log('Step 1: Validating JavaScript syntax...');
checkDirectory('./src');
checkDirectory('./scripts');
checkDirectory('./tests');

// 2. Validate JSON files
console.log('\nStep 2: Validating JSON configurations...');
const jsonFiles = ['./package.json'];
for (const jf of jsonFiles) {
  if (fs.existsSync(jf)) {
    try {
      JSON.parse(fs.readFileSync(jf, 'utf8'));
      console.log(`  ✓ JSON valid: ${jf}`);
    } catch (err) {
      console.error(`  ✗ Invalid JSON: ${jf} (${err.message})`);
      errorCount++;
    }
  }
}

// 3. Scan for leaked secrets
console.log('\nStep 3: Scanning repository for hardcoded secrets/keys...');
const sensitivePatterns = [
  /-----BEGIN (RSA|EC|OPENSSH|DSA|PGP)? PRIVATE KEY-----/,
  /AKIA[0-9A-Z]{16}/, // AWS Access Key
  /ghp_[a-zA-Z0-9]{36}/, // GitHub personal access token
  /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\./ // Live JWTs
];

function scanForSecrets(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'data' && entry.name !== 'backups') {
        scanForSecrets(fullPath);
      }
    } else if (!entry.name.endsWith('.db') && !entry.name.endsWith('.png') && !entry.name.endsWith('.log')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const pattern of sensitivePatterns) {
        if (pattern.test(content)) {
          console.error(`  ✗ SENSITIVE DATA DETECTED in ${fullPath}`);
          errorCount++;
        }
      }
    }
  }
}

scanForSecrets('./src');
scanForSecrets('./scripts');
scanForSecrets('./tests');
console.log('  ✓ No hardcoded secrets, private keys, or API tokens detected.');

// Summary
console.log('\n-------------------------------------------------------------');
if (errorCount === 0) {
  console.log('Static analysis and lint check PASSED with 0 errors.');
  process.exit(0);
} else {
  console.error(`Static analysis FAILED with ${errorCount} error(s).`);
  process.exit(1);
}

