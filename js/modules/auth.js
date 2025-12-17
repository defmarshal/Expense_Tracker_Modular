// js/modules/auth.js

/**
 * AUTHENTICATION MODULE
 * User authentication and session management
 */

import { getState } from './state.js';
import { getDatabase } from './database.js';

class AuthService {
    constructor(supabase) {
        this.supabase = supabase;
        this.state = getState();
        this.database = getDatabase(supabase);
        this.initialized = false;
    }

    // Initialize auth state listener
    async initialize() {
        if (this.initialized) return;
        
        // First, check for existing session
        await this.checkExistingSession();
        
        // Then set up listener for future changes
        this.supabase.auth.onAuthStateChange((event, session) => {
            console.log('Auth state changed:', event);
            
            switch (event) {
                case 'SIGNED_IN':
                    this.handleSignedIn(session);
                    break;
                case 'SIGNED_OUT':
                    this.handleSignedOut();
                    break;
                case 'USER_UPDATED':
                    this.handleUserUpdated(session);
                    break;
                case 'TOKEN_REFRESHED':
                    this.handleTokenRefreshed(session);
                    break;
                case 'INITIAL_SESSION':
                    // This is normal - just ignore or handle gracefully
                    console.log('Initial session check complete');
                    break;
            }
        });
        
        this.initialized = true;
    }

    // Check for existing session on page load
    async checkExistingSession() {
        try {
            const { data: { session }, error } = await this.supabase.auth.getSession();
            
            if (error) {
                console.warn('Error getting session:', error.message);
                return null;
            }
            
            if (session) {
                await this.handleSignedIn(session);
                return session;
            }
            
            return null;
        } catch (error) {
            console.error('Error checking existing session:', error);
            return null;
        }
    }

    // Auth event handlers
    async handleSignedIn(session) {
        try {
            if (!session?.user) return;
            
            console.log('User signed in:', session.user.email);
            this.state.setUser(session.user);
            this.database.setUser(session.user);
            
            // Load user data
            await this.loadUserData();
            
            // Emit custom event
            this.emitAuthEvent('signedIn', { user: session.user });
        } catch (error) {
            console.error('Error handling sign in:', error);
            this.emitAuthEvent('error', { error: error.message });
        }
    }

    handleSignedOut() {
        console.log('User signed out');
        this.state.reset();
        this.emitAuthEvent('signedOut', {});
    }

    handleUserUpdated(session) {
        if (session?.user) {
            this.state.setUser(session.user);
            this.emitAuthEvent('userUpdated', { user: session.user });
        }
    }

    handleTokenRefreshed() {
        console.log('Token refreshed');
    }

    // Auth methods
    async signUp(email, password, options = {}) {
        try {
            this.state.setLoading(true);
            
            const { data, error } = await this.supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: window.location.origin,
                    ...options
                }
            });
            
            if (error) {
                // DON'T emit error event here - let the calling code handle it
                throw new Error(error.message);
            }
            
            // Check if user already exists (Supabase returns user but no session)
            if (data.user && !data.session && !data.user.identities?.length) {
                // This means user already exists
                throw new Error('User already registered');
            }
            
            if (data.user && data.session) {
                // Auto-login if email confirmation not required
                this.state.setUser(data.user);
                this.database.setUser(data.user);
                await this.loadUserData();
                
                this.emitAuthEvent('signUpSuccess', { user: data.user });
                return { success: true, requiresConfirmation: false, user: data.user };
            } else if (data.user && !data.session) {
                // Email confirmation required
                this.emitAuthEvent('signUpConfirmationRequired', { email });
                return { success: true, requiresConfirmation: true, email };
            }
            
            throw new Error('Signup failed. Please try again.');
        } catch (error) {
            console.error('Signup error:', error);
            // Don't emit error event here either
            throw error;
        } finally {
            this.state.setLoading(false);
        }
    }

    async signIn(email, password) {
        try {
            this.state.setLoading(true);
            
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) {
                throw new Error(error.message);
            }
            
            if (data.user) {
                this.state.setUser(data.user);
                this.database.setUser(data.user);
                await this.loadUserData();
                
                this.emitAuthEvent('signInSuccess', { user: data.user });
                return { success: true, user: data.user };
            }
            
            throw new Error('No user data returned');
        } catch (error) {
            this.emitAuthEvent('error', { error: error.message });
            throw error;
        } finally {
            this.state.setLoading(false);
        }
    }

    async signOut() {
        try {
            this.state.setLoading(true);
            
            const { error } = await this.supabase.auth.signOut();
            
            if (error) {
                throw new Error(error.message);
            }
            
            this.state.reset();
            this.emitAuthEvent('signOutSuccess', {});
            return { success: true };
        } catch (error) {
            this.emitAuthEvent('error', { error: error.message });
            throw error;
        } finally {
            this.state.setLoading(false);
        }
    }

    async getCurrentSession() {
        try {
            const { data: { session }, error } = await this.supabase.auth.getSession();
            
            if (error) {
                console.warn('Error getting session:', error.message);
                return null;
            }
            
            return session;
        } catch (error) {
            console.error('Error getting current session:', error);
            return null;
        }
    }

    async checkAuth() {
        try {
            const session = await this.getCurrentSession();
            
            if (session?.user) {
                await this.handleSignedIn(session);
                return { isAuthenticated: true, user: session.user };
            }
            
            return { isAuthenticated: false, user: null };
        } catch (error) {
            console.error('Error checking auth:', error);
            return { isAuthenticated: false, user: null, error: error.message };
        }
    }

    // Helper methods
    async loadUserData() {
        try {
            console.log('Auth: Starting to load user data...');
            
            if (!this.state.getUser()) {
                console.log('Auth: No user found, skipping data load');
                return;
            }
            
            console.log('Auth: Loading data for user:', this.state.getUser().email);
            
            // Load all user data in parallel
            const [wallets, categories, expenses, incomes] = await Promise.all([
                this.database.getWallets(),
                this.database.getCategories(),
                this.database.getExpenses(),
                this.database.getIncomes()
            ]);
            
            console.log('Auth: Data loaded:', {
                wallets: wallets.length,
                categories: categories.length,
                expenses: expenses.length,
                incomes: incomes.length
            });
            
            // Update state
            this.state.setWallets(wallets);
            this.state.setCategories(categories);
            this.state.setExpenses(expenses);
            this.state.setIncomes(incomes);
            
            // Set default wallet if one exists
            const defaultWallet = wallets.find(w => w.isDefault);
            if (defaultWallet) {
                this.state.setCurrentWallet(defaultWallet.id);
            } else if (wallets.length > 0) {
                // If no default, use first wallet
                this.state.setCurrentWallet(wallets[0].id);
            }
            
            console.log('Auth: State updated, emitting dataLoaded event');
            this.emitAuthEvent('dataLoaded', { wallets, categories, expenses, incomes });
            
        } catch (error) {
            console.error('Auth: Error loading user data:', error);
            this.emitAuthEvent('error', { error: error.message });
        }
    }

    // Event system
    emitAuthEvent(eventName, data) {
        const event = new CustomEvent(`auth:${eventName}`, {
            detail: data,
            bubbles: true
        });
        document.dispatchEvent(event);
    }

    subscribe(eventName, callback) {
        const handler = (event) => callback(event.detail);
        document.addEventListener(`auth:${eventName}`, handler);
        
        // Return unsubscribe function
        return () => {
            document.removeEventListener(`auth:${eventName}`, handler);
        };
    }

    // Getters
    isAuthenticated() {
        return !!this.state.getUser();
    }

    getUserEmail() {
        return this.state.getUser()?.email || null;
    }

    getUserId() {
        return this.state.getUser()?.id || null;
    }
}

// Create singleton instance
let authInstance = null;

export const getAuth = (supabaseClient) => {
    if (!authInstance) {
        authInstance = new AuthService(supabaseClient);
    }
    return authInstance;
};

export const initializeAuth = async (supabaseClient) => {
    const auth = getAuth(supabaseClient);
    await auth.initialize();
    return auth;
};