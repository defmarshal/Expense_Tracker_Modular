// js/config.js - Simple version
console.log('🔧 Loading FinTrack configuration...');

// Default empty config
window.FINTRACK_CONFIG = window.FINTRACK_CONFIG || {
    SUPABASE_URL: '',
    SUPABASE_ANON_KEY: ''
};

// Check if production config loaded
if (window.FINTRACK_CONFIG.SUPABASE_URL && window.FINTRACK_CONFIG.SUPABASE_ANON_KEY) {
    console.log('✅ Using production configuration from Vercel');
} else {
    console.warn('⚠️ No production config found. Using local fallback.');
    
    // For local development only
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        window.FINTRACK_CONFIG = {
            SUPABASE_URL: '',
            SUPABASE_ANON_KEY: ''
        };
        console.log('✅ Using local development configuration');
    }
}

console.log('Configuration ready:', 
    window.FINTRACK_CONFIG.SUPABASE_URL ? 'URL set' : 'URL missing',
    window.FINTRACK_CONFIG.SUPABASE_ANON_KEY ? 'Key set' : 'Key missing'
);