#!/usr/bin/env node

/**
 * Generate VAPID keys for Web Push notifications.
 * Wraps `npx web-push generate-vapid-keys --json` and prints
 * setup instructions for the Daily Activity Tracker.
 */

import { execSync } from 'node:child_process';

try {
  const output = execSync('npx web-push generate-vapid-keys --json', {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const keys = JSON.parse(output.trim());

  console.log('\n✅ VAPID keys generated successfully!\n');
  console.log('─'.repeat(60));
  console.log('\nPublic Key:');
  console.log(`  ${keys.publicKey}\n`);
  console.log('Private Key:');
  console.log(`  ${keys.privateKey}\n`);
  console.log('─'.repeat(60));
  console.log('\n📋 Setup Instructions:\n');
  console.log('1. Copy the public key to your environment variables:');
  console.log(`   VITE_VAPID_PUBLIC_KEY=${keys.publicKey}`);
  console.log(`   VAPID_PUBLIC_KEY=${keys.publicKey}\n`);
  console.log('2. Set the private key as a Cloudflare Workers secret:');
  console.log(`   wrangler secret put VAPID_PRIVATE_KEY`);
  console.log(`   (paste: ${keys.privateKey})\n`);
  console.log('─'.repeat(60));
  console.log('');
} catch (error) {
  console.error('❌ Failed to generate VAPID keys.');
  console.error('   Make sure "web-push" is available (npx will fetch it automatically).');
  console.error(`   Error: ${error.message}`);
  process.exit(1);
}
