// js/config.js - NO KEYS AT ALL
// For production deployment only

const CONFIG = {
    // These MUST be set as environment variables in Vercel
    SUPABASE_URL: '',
    SUPABASE_ANON_KEY: ''
};

// Validation
if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
    console.error('❌ Configuration error: Missing Supabase credentials');
    console.error('   This deployment requires environment variables:');
    console.error('   1. SUPABASE_URL');
    console.error('   2. SUPABASE_ANON_KEY');
    console.error('   Set them in Vercel Project Settings → Environment Variables');
}

window.FINTRACK_CONFIG = CONFIG;