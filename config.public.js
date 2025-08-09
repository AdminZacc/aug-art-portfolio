// GitHub Pages config - safe for public deployment
// Replace these values with your real Supabase credentials

window.SUPABASE_CONFIG = {
  url: "https://fjndrnjdjluuxebgpiuh.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqbmRybmpkamx1dXhlYmdwaXVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2OTAyMTEsImV4cCI6MjA3MDI2NjIxMX0.24zFSEfGCFTsRTQHhw5yByE3rMjorCeM3784KeK72b0"
};

// Runtime validation
if (!window.SUPABASE_CONFIG.url || !window.SUPABASE_CONFIG.anonKey) {
  console.error('[Supabase] Invalid configuration. Check your config values.');
}
