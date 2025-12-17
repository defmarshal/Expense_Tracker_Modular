// js/config.js - Vercel-Compatible Configuration
// This file should NOT contain any real API keys
// Vercel will inject environment variables during build

// Detect environment
const isLocal = window.location.hostname === 'localhost' || 
                window.location.hostname === '127.0.0.1' ||
                window.location.hostname.startsWith('192.168.') ||
                window.location.hostname.startsWith('10.') ||
                window.location.hostname === '';

// Debug information
console.log('FinTrack Environment Detection:', {
    hostname: window.location.hostname,
    isLocal: isLocal,
    href: window.location.href
});

// ===========================================
// CONFIGURATION - NO REAL KEYS HERE!
// ===========================================

// For Local Development (optional - you can remove these)
const LOCAL_CONFIG = {
    SUPABASE_URL: '',  // ⚠️ Remove this in production!
    SUPABASE_ANON_KEY: ''  // ⚠️ Remove this in production!
};

// For Production (Vercel will inject these)
const PRODUCTION_CONFIG = {
    // These come from Vercel environment variables
    SUPABASE_URL: '',
    SUPABASE_ANON_KEY: ''
};

// ===========================================
// EXPORT THE CORRECT CONFIG
// ===========================================
const CONFIG = isLocal ? LOCAL_CONFIG : PRODUCTION_CONFIG;

// Make it globally available
window.FINTRACK_CONFIG = CONFIG;

// Validation check
if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
    if (isLocal) {
        console.warn('⚠️ Using development Supabase keys');
    } else {
        console.error('❌ Production: Missing Supabase configuration');
        console.error('   Make sure you set these in Vercel:');
        console.error('   1. SUPABASE_URL');
        console.error('   2. SUPABASE_ANON_KEY');
        
        // Create a visible error for users
        setTimeout(() => {
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: #dc2626;
                color: white;
                padding: 15px;
                text-align: center;
                font-family: sans-serif;
                z-index: 9999;
                font-size: 14px;
            `;
            errorDiv.innerHTML = `
                <strong>Configuration Error</strong><br>
                The app is not properly configured. Please contact support.
            `;
            document.body.appendChild(errorDiv);
        }, 1000);
    }
} else {
    console.log('✅ Configuration loaded successfully');
    console.log('   Environment:', isLocal ? 'Development' : 'Production');
    console.log('   Supabase URL present:', CONFIG.SUPABASE_URL ? 'Yes' : 'No');
}