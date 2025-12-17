// js/config.js - Vercel Version
const isProduction = window.location.hostname !== 'localhost' && 
                     window.location.hostname !== '127.0.0.1';

const CONFIG = isProduction ? {
    // Vercel will inject these as environment variables
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || ''
} : {
    // Local development keys (optional, for testing)
    SUPABASE_URL: 'https://slgzgaojmgzjhtuaptod.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsZ3pnYW9qbWd6amh0dWFwdG9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyNzQyMzMsImV4cCI6MjA3ODg1MDIzM30.aD9cjbekiufRaatuNaAEP2uD2uU7ggpPor6jtSGM-F4'
};

// Export for use
window.FINTRACK_CONFIG = CONFIG;

// Debug
console.log('FinTrack Config:', {
    environment: isProduction ? 'Production (Vercel)' : 'Development (Local)',
    hasUrl: !!CONFIG.SUPABASE_URL,
    hasKey: !!CONFIG.SUPABASE_ANON_KEY
});