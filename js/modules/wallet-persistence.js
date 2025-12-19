// js/modules/wallet-persistence.js

/**
 * WALLET PERSISTENCE MODULE
 * Manages wallet selection across pages using localStorage and database defaults
 */

class WalletPersistence {
    constructor(db) {
        this.db = db;
        this.STORAGE_KEY = 'fintrack_selected_wallet_id';
    }

    /**
     * Get the wallet ID that should be selected
     * Priority: localStorage > database default (is_default in wallets) > first wallet
     */
    async getDefaultWalletId(wallets, userId) {
        try {
            // 1. Check localStorage first
            const storedWalletId = this.getStoredWalletId();
            if (storedWalletId && wallets.some(w => w.id === storedWalletId)) {
                console.log('Using wallet from localStorage:', storedWalletId);
                return storedWalletId;
            }

            // 2. Check for default wallet in the wallets array (is_default field)
            const defaultWallet = wallets.find(w => w.isDefault === true);
            if (defaultWallet) {
                console.log('Using default wallet from database:', defaultWallet.id);
                // Sync to localStorage
                this.saveWalletId(defaultWallet.id);
                return defaultWallet.id;
            }

            // 3. Fallback to first wallet
            if (wallets.length > 0) {
                const firstWalletId = wallets[0].id;
                console.log('Using first wallet as fallback:', firstWalletId);
                this.saveWalletId(firstWalletId);
                return firstWalletId;
            }

            // 4. No wallets available
            return null;
        } catch (error) {
            console.error('Error getting default wallet:', error);
            // Fallback to first wallet on error
            return wallets.length > 0 ? wallets[0].id : null;
        }
    }

    /**
     * Get wallet ID from localStorage
     */
    getStoredWalletId() {
        try {
            return localStorage.getItem(this.STORAGE_KEY);
        } catch (error) {
            console.error('Error reading from localStorage:', error);
            return null;
        }
    }

    /**
     * Save wallet ID to localStorage
     */
    saveWalletId(walletId) {
        try {
            if (walletId) {
                localStorage.setItem(this.STORAGE_KEY, walletId);
                console.log('Saved wallet to localStorage:', walletId);
            } else {
                localStorage.removeItem(this.STORAGE_KEY);
            }
        } catch (error) {
            console.error('Error saving to localStorage:', error);
        }
    }

    /**
     * Set a wallet as default in the database
     * This updates the is_default field in the wallets table
     */
    async setDatabaseDefaultWallet(userId, walletId) {
        try {
            if (!userId || !walletId) {
                console.warn('Missing userId or walletId for setDatabaseDefaultWallet');
                return false;
            }

            // First, unset all wallets as default for this user
            const { error: unsetError } = await this.db.supabase
                .from('wallets')
                .update({ is_default: false })
                .eq('user_id', userId);

            if (unsetError) {
                console.error('Error unsetting default wallets:', unsetError);
                // Continue anyway - not critical
            }

            // Then set the selected wallet as default
            const { error: setError } = await this.db.supabase
                .from('wallets')
                .update({ is_default: true })
                .eq('id', walletId)
                .eq('user_id', userId);

            if (setError) {
                console.error('Error setting default wallet:', setError);
                return false;
            }

            // Also update localStorage
            this.saveWalletId(walletId);
            console.log('Updated default wallet in database and localStorage:', walletId);
            return true;
        } catch (error) {
            console.error('Error in setDatabaseDefaultWallet:', error);
            return false;
        }
    }

    /**
     * Clear stored wallet (useful on logout)
     */
    clearStoredWallet() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            console.log('Cleared stored wallet from localStorage');
        } catch (error) {
            console.error('Error clearing localStorage:', error);
        }
    }

    /**
     * Sync wallet selection across tabs (optional)
     */
    setupCrossTabSync(callback) {
        window.addEventListener('storage', (e) => {
            if (e.key === this.STORAGE_KEY && e.newValue !== e.oldValue) {
                console.log('Wallet changed in another tab:', e.newValue);
                callback(e.newValue);
            }
        });
    }
}

// Create singleton instance
let walletPersistenceInstance = null;

export const getWalletPersistence = (db) => {
    if (!walletPersistenceInstance && db) {
        walletPersistenceInstance = new WalletPersistence(db);
    }
    return walletPersistenceInstance;
};

export const initializeWalletPersistence = (db) => {
    return getWalletPersistence(db);
};

/**
 * INTEGRATION HELPER FUNCTIONS
 * Use these in your app.js and analytics-app.js
 */

/**
 * Load and set the default wallet for a user
 * @param {WalletPersistence} walletPersistence - Wallet persistence instance
 * @param {Array} wallets - Available wallets
 * @param {string} userId - Current user ID
 * @param {Function} onWalletSelected - Callback when wallet is selected
 */
export async function loadAndSetDefaultWallet(walletPersistence, wallets, userId, onWalletSelected) {
    const defaultWalletId = await walletPersistence.getDefaultWalletId(wallets, userId);
    
    if (defaultWalletId) {
        onWalletSelected(defaultWalletId);
    }
    
    return defaultWalletId;
}

/**
 * Handle wallet change event (from dropdown)
 * @param {WalletPersistence} walletPersistence - Wallet persistence instance
 * @param {string} newWalletId - New wallet ID
 * @param {string} userId - Current user ID
 * @param {Function} onWalletChanged - Callback when wallet changes
 */
export async function handleWalletChange(walletPersistence, newWalletId, userId, onWalletChanged) {
    // Save to localStorage
    walletPersistence.saveWalletId(newWalletId);
    
    // Optionally save to database (set as default)
    if (userId && newWalletId) {
        await walletPersistence.setDatabaseDefaultWallet(userId, newWalletId);
    }
    
    // Notify app
    if (onWalletChanged) {
        onWalletChanged(newWalletId);
    }
}