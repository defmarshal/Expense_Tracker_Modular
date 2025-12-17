// js/config.js - SAFE VERSION (NO KEYS)
// ====================================================
// THIS FILE IS SAFE TO COMMIT TO GIT
// ALL SECRETS COME FROM ENVIRONMENT VARIABLES
// ====================================================

console.log('🔧 FinTrack Config Initializing...');

// ====================
// ENVIRONMENT DETECTION
// ====================
const getEnvironment = () => {
    const hostname = window.location.hostname;
    
    // Development environments
    if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.includes('.local') ||
        window.location.protocol === 'file:' ||
        hostname.includes('192.168.') ||
        hostname.includes('10.')
    ) {
        return 'development';
    }
    
    // Production on Vercel
    if (
        hostname.includes('vercel.app') ||
        hostname.includes('.now.sh') ||
        !hostname.includes('.') // No dots in production custom domain
    ) {
        return 'production';
    }
    
    return 'production'; // Default to production
};

const environment = getEnvironment();
console.log(`🌍 Detected environment: ${environment}`);

// ====================
// GET CONFIGURATION
// ====================
const getConfiguration = () => {
    // For PRODUCTION (Vercel) - Get from environment variables
    if (environment === 'production') {
        console.log('🔐 Fetching production configuration...');
        
        // Method 1: From global variable (set by build process)
        if (window.ENV) {
            console.log('✅ Found config in window.ENV');
            return window.ENV;
        }
        
        // Method 2: From data attribute
        const configScript = document.getElementById('__CONFIG__');
        if (configScript) {
            try {
                const config = JSON.parse(configScript.textContent);
                console.log('✅ Found config in data attribute');
                return config;
            } catch (e) {
                console.warn('⚠️ Failed to parse config from data attribute');
            }
        }
        
        // Method 3: From meta tags
        const metaUrl = document.querySelector('meta[name="supabase-url"]');
        const metaKey = document.querySelector('meta[name="supabase-key"]');
        if (metaUrl && metaKey) {
            console.log('✅ Found config in meta tags');
            return {
                SUPABASE_URL: metaUrl.getAttribute('content'),
                SUPABASE_ANON_KEY: metaKey.getAttribute('content')
            };
        }
        
        console.error('❌ No production configuration found!');
        console.error('   Set environment variables in Vercel:');
        console.error('   - SUPABASE_URL');
        console.error('   - SUPABASE_ANON_KEY');
        
        return {
            SUPABASE_URL: '',
            SUPABASE_ANON_KEY: ''
        };
    }
    
    // For DEVELOPMENT
    console.log('💻 Using development configuration');
    console.log('⚠️ IMPORTANT: Create a `.env.local` file with:');
    console.log('   SUPABASE_URL=your_url_here');
    console.log('   SUPABASE_ANON_KEY=your_key_here');
    
    return {
        SUPABASE_URL: '', // Will be loaded from .env.local
        SUPABASE_ANON_KEY: '' // Will be loaded from .env.local
    };
};

// ====================
// EXPORT CONFIGURATION
// ====================
const CONFIG = getConfiguration();
window.FINTRACK_CONFIG = CONFIG;

// ====================
// VALIDATION
// ====================
if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
    const errorMessage = environment === 'production' 
        ? 'Production configuration missing. Set environment variables in Vercel dashboard.'
        : 'Development configuration missing. Create a .env.local file.';
    
    console.error(`❌ ${errorMessage}`);
    
    // Show user-friendly error
    setTimeout(() => {
        const errorDiv = document.createElement('div');
        errorDiv.id = 'config-error';
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #dc2626;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: 14px;
            max-width: 90%;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        errorDiv.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 5px;">Configuration Required</div>
            <div style="font-size: 13px; opacity: 0.9;">
                ${environment === 'production' 
                    ? 'Please check Vercel environment variables.' 
                    : 'Please set up local configuration.'}
            </div>
        `;
        document.body.appendChild(errorDiv);
    }, 1000);
} else {
    console.log('✅ Configuration loaded successfully');
    console.log('   Environment:', environment);
    console.log('   URL present:', CONFIG.SUPABASE_URL ? 'Yes' : 'No');
    console.log('   Key present:', CONFIG.SUPABASE_ANON_KEY ? 'Yes' : 'No');
    
    // Remove any existing error message
    setTimeout(() => {
        const errorDiv = document.getElementById('config-error');
        if (errorDiv) errorDiv.remove();
    }, 3000);
}