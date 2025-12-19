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
     * Priority: localStorage > database default > first wallet
     */
    async getDefaultWalletId(wallets, userId) {
        try {
            // 1. Check localStorage first
            const storedWalletId = this.getStoredWalletId();
            if (storedWalletId && wallets.some(w => w.id === storedWalletId)) {
                console.log('Using wallet from localStorage:', storedWalletId);
                return storedWalletId;
            }

            // 2. Check database for default wallet
            if (userId) {
                const dbDefaultId = await this.getDatabaseDefaultWallet(userId);
                if (dbDefaultId && wallets.some(w => w.id === dbDefaultId)) {
                    console.log('Using wallet from database:', dbDefaultId);
                    // Sync to localStorage
                    this.saveWalletId(dbDefaultId);
                    return dbDefaultId;
                }
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
     * Get default wallet from database (profiles table)
     */
    async getDatabaseDefaultWallet(userId) {
        try {
            const { data, error } = await this.db.supabase
                .from('profiles')
                .select('default_wallet_id')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('Error fetching database default wallet:', error);
                return null;
            }

            return data?.default_wallet_id || null;
        } catch (error) {
            console.error('Error in getDatabaseDefaultWallet:', error);
            return null;
        }
    }

    /**
     * Set default wallet in database
     */
    async setDatabaseDefaultWallet(userId, walletId) {
        try {
            const { error } = await this.db.supabase
                .from('profiles')
                .update({ default_wallet_id: walletId })
                .eq('id', userId);

            if (error) {
                console.error('Error updating database default wallet:', error);
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
    
    // Optionally save to database
    if (userId) {
        await walletPersistence.setDatabaseDefaultWallet(userId, newWalletId);
    }
    
    // Notify app
    if (onWalletChanged) {
        onWalletChanged(newWalletId);
    }
}