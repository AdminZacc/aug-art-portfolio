#!/usr/bin/env node
// Script to generate config.js from .env file (robust parsing with dotenv)
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    console.error('.env file not found. Copy .env.example to .env and fill in your values.');
    process.exit(1);
  }

  // Use dotenv to handle BOM, CRLF, quotes, etc.
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    console.error('Failed to parse .env:', result.error);
    process.exit(1);
  }
  return process.env;
}

function generateConfig() {
  const env = loadEnv();

  const SUPABASE_URL = (env.SUPABASE_URL || '').trim();
  const SUPABASE_ANON_KEY = (env.SUPABASE_ANON_KEY || '').trim();

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env file');
    console.error({ SUPABASE_URL, hasKey: !!SUPABASE_ANON_KEY });
    process.exit(1);
  }

  if (!/^https?:\/\//i.test(SUPABASE_URL)) {
    console.error('SUPABASE_URL must start with https:// (got: ' + SUPABASE_URL + ')');
    process.exit(1);
  }

  const configContent = `// Auto-generated from .env file. Do not edit manually.
// To update, modify .env and run: npm run build:config

window.SUPABASE_CONFIG = {
  url: "${SUPABASE_URL}",
  anonKey: "${SUPABASE_ANON_KEY}"
};

// Runtime validation
if (!window.SUPABASE_CONFIG.url || !window.SUPABASE_CONFIG.anonKey) {
  console.error('[Supabase] Invalid configuration. Check your .env file.');
}
`;

  fs.writeFileSync(path.join(__dirname, 'config.js'), configContent);
  console.log('✓ Generated config.js from .env with URL:', SUPABASE_URL);
}

if (require.main === module) {
  generateConfig();
}

module.exports = { generateConfig };
