#!/usr/bin/env node
// Script to generate config.js from .env file
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    console.error('.env file not found. Copy .env.example to .env and fill in your values.');
    process.exit(1);
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#\s][^=]*?)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      env[key.trim()] = value.trim();
    }
  });
  
  return env;
}

function generateConfig() {
  const env = loadEnv();
  
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env file');
    process.exit(1);
  }
  
  const configContent = `// Auto-generated from .env file. Do not edit manually.
// To update, modify .env and run: npm run build:config

window.SUPABASE_CONFIG = {
  url: "${env.SUPABASE_URL}",
  anonKey: "${env.SUPABASE_ANON_KEY}"
};

// Runtime validation
if (!window.SUPABASE_CONFIG.url || !window.SUPABASE_CONFIG.anonKey) {
  console.error('[Supabase] Invalid configuration. Check your .env file.');
}
`;
  
  fs.writeFileSync(path.join(__dirname, 'config.js'), configContent);
  console.log('✓ Generated config.js from .env');
}

if (require.main === module) {
  generateConfig();
}

module.exports = { generateConfig };
