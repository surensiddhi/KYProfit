#!/usr/bin/env node
// Run locally to hash your admin password before storing it in KV.
// Usage: node scripts/hash-password.js "your-password-here"
//
// The plaintext password is never saved anywhere — it only exists in your
// terminal history for this one command. The output hash is what actually
// gets stored (see DEPLOY.md for the full seeding steps).

import bcrypt from 'bcryptjs';

const password = process.argv[2];

if (!password) {
  console.error('Usage: node scripts/hash-password.js "your-password-here"');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
console.log('\nBcrypt hash (copy this for the next step):\n');
console.log(hash);
console.log('');
