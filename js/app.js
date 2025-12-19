// js/app.js

/**
 * MAIN APPLICATION ENTRY POINT
 * Orchestrates modules and handles initialization
 */

import { initializeAuth } from './modules/auth.js';
import { getState } from './modules/state.js';
import { getDatabase } from './modules/database.js';
import { 
    currencyUtils, 
    validationUtils, 
    dateUtils, 
    domUtils 
} from './modules/utils.js';

import { 
    getWalletPersistence, 
    loadAndSetDefaultWallet, 
    handleWalletChange 
} from './modules/wallet-persistence.js';

class FinTrackApp {
    constructor(supabase) {
        // Store Supabase client
        this.supabase = supabase;
        
        // Will be initialized in init()
        this.auth = null;
        this.state = null;
        this.db = null;
        this.ui = null;
        this.walletPersistence = null;

        // Store DOM references
        this.domElements = {};
        
        // Bind methods
        this.init = this.init.bind(this);
        this.showAlert = this.showAlert.bind(this);
    }
    
    async init() {
        try {
            console.log('Initializing FinTrack App...');
            
            // Initialize core services
            this.state = getState();
            this.db = getDatabase(this.supabase);
            this.auth = await initializeAuth(this.supabase);
            this.walletPersistence = getWalletPersistence(this.db);

            this.auth.setWalletPersistence(this.walletPersistence);
            
            // Initialize UI Controller (defined inline below)
            this.ui = new UIController(this);
            
            // Get DOM references
            this.cacheDomElements();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Setup auth event listeners
            this.setupAuthListeners();
            
            // Setup form handlers
            this.setupFormHandlers();
            
            // Setup delete modal handlers
            this.setupDeleteModalHandlers();
            
            // Setup other modal handlers
            this.setupOtherModalHandlers();

            // Setup cross-tab sync
            this.setupCrossTabSync();
            
            // Check current auth state
            await this.checkInitialAuthState();
            
            console.log('FinTrack App initialized successfully');
        } catch (error) {
            console.error('Error initializing app:', error);
            this.showAlert('Failed to initialize app. Please refresh.', 'error');
        }
    }

    setupCrossTabSync() {
        if (!this.walletPersistence) return;
        
        this.walletPersistence.setupCrossTabSync((newWalletId) => {
            console.log('Wallet changed in another tab:', newWalletId);
            
            // Update state
            this.state.setCurrentWallet(newWalletId);
            
            // Update UI selector
            const selector = document.getElementById('globalWalletSelect');
            if (selector && selector.value !== newWalletId) {
                selector.value = newWalletId;
            }
            
            // Refresh UI
            if (this.ui) {
                this.ui.updateWalletDependentUI();
            }
        });
    }    
        
    cacheDomElements() {
        // Store frequently accessed DOM elements
        this.domElements = {
            // Auth buttons
            loginBtn: document.getElementById('loginBtn'),
            signupBtn: document.getElementById('signupBtn'),
            logoutBtn: document.getElementById('logoutBtn'),
            
            // Modals
            signupModal: document.getElementById('signupModal'),
            loginModal: document.getElementById('loginModal'),
            closeSignupModal: document.getElementById('closeSignupModal'),
            closeLoginModal: document.getElementById('closeLoginModal'),
            
            // Forms
            signupForm: document.getElementById('signupForm'),
            loginForm: document.getElementById('loginForm'),
            showSignupFromLogin: document.getElementById('showSignupFromLogin'),
            showLoginFromSignup: document.getElementById('showLoginFromSignup'),
            
            // Sections
            landingPage: document.getElementById('landingPage'),
            dashboardContainer: document.getElementById('dashboardContainer'),
            
            // Alert container
            alertContainer: document.getElementById('alertContainer')
        };
    }
    
    setupEventListeners() {
        // Auth button listeners
        if (this.domElements.loginBtn) {
            this.domElements.loginBtn.addEventListener('click', () => {
                this.showModal('login');
            });
        }
        
        if (this.domElements.signupBtn) {
            this.domElements.signupBtn.addEventListener('click', () => {
                this.showModal('signup');
            });
        }
        
        if (this.domElements.logoutBtn) {
            this.domElements.logoutBtn.addEventListener('click', async () => {
                try {
                    await this.auth.signOut();
                    this.showAlert('Logged out successfully', 'success');
                } catch (error) {
                    this.showAlert('Error logging out', 'error');
                }
            });
        }
        
        // Form submissions
        if (this.domElements.signupForm) {
            this.domElements.signupForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleSignup(e);
            });
        }
        
        if (this.domElements.loginForm) {
            this.domElements.loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleLogin(e);
            });
        }
        
        // Close modal listeners
        if (this.domElements.closeSignupModal) {
            this.domElements.closeSignupModal.addEventListener('click', () => {
                this.hideModal('signup');
            });
        }
        
        if (this.domElements.closeLoginModal) {
            this.domElements.closeLoginModal.addEventListener('click', () => {
                this.hideModal('login');
            });
        }
        
        // Modal switching
        if (this.domElements.showSignupFromLogin) {
            this.domElements.showSignupFromLogin.addEventListener('click', (e) => {
                e.preventDefault();
                this.hideModal('login');
                this.showModal('signup');
            });
        }
        
        if (this.domElements.showLoginFromSignup) {
            this.domElements.showLoginFromSignup.addEventListener('click', (e) => {
                e.preventDefault();
                this.hideModal('signup');
                this.showModal('login');
            });
        }
        
        // Click outside to close modals
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                e.target.classList.remove('active');
            }
        });
    }
    
    setupAuthListeners() {
        // Subscribe to auth events
        this.auth.subscribe('signedIn', () => {
            console.log('App: User signed in');
            this.showDashboard();
            this.showAlert('Welcome!', 'success');
        });
        
        this.auth.subscribe('signedOut', () => {
            console.log('App: User signed out');
            this.showLandingPage();
        });
        
        this.auth.subscribe('dataLoaded', (data) => {
            console.log('App: Data loaded event received:', data);
            
            // Force update all UI
            if (this.ui) {
                console.log('App: Calling updateAllUI');
                this.ui.updateAllUI();
            }
        });
        
        // this.auth.subscribe('error', (errorData) => {
        //     console.error('App: Auth error:', errorData);
        //     this.showAlert(errorData.error || 'An error occurred', 'error');
        // });
    }
    
    setupFormHandlers() {
        // Expense form
        document.getElementById('expenseForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddExpense(e);
        });
        
        document.getElementById('expenseCancelBtn')?.addEventListener('click', () => {
            this.ui.resetExpenseForm();
        });
        
        // Income form
        document.getElementById('incomeForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddIncome(e);
        });
        
        document.getElementById('incomeCancelBtn')?.addEventListener('click', () => {
            this.ui.resetIncomeForm();
        });
        
        // Wallet form
        document.getElementById('walletForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddWallet(e);
        });
        
        document.getElementById('walletCancelBtn')?.addEventListener('click', () => {
            this.ui.resetWalletForm();
        });
        
        // Category form
        document.getElementById('categoryForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddCategory(e);
        });
        
        document.getElementById('categoryCancelBtn')?.addEventListener('click', () => {
            this.ui.resetCategoryForm();
        });
        
        // Subcategory form
        document.getElementById('subcategoryForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddSubcategory(e);
        });

        const editForm = document.getElementById('editTransactionForm');
        if (editForm) {
            editForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const type = document.getElementById('editItemType').value;
                const id = document.getElementById('editItemId').value;
                const description = document.getElementById('editDescription').value;
                const amountStr = document.getElementById('editAmount').value;
                const amount = currencyUtils.parseCurrency(amountStr);
                const date = document.getElementById('editDate').value;
                const categoryValue = document.getElementById('editCategory').value;
                const subcategoryValue = document.getElementById('editSubcategory').value || '';

                const updateData = {
                    description: description,
                    amount: amount,
                    date: date
                };

                // Assign the category or source based on type
                if (type === 'expense') {
                    updateData.category = categoryValue;
                    updateData.subcategory = subcategoryValue || null;
                    updateData.wallet_id = this.state.getState().currentWalletId;
                } else {
                    updateData.source = categoryValue;
                    updateData.wallet_id = this.state.getState().currentWalletId;
                }

                try {
                    // Show loading
                    if (this.ui && typeof this.ui.showLoading === 'function') {
                        this.ui.showLoading(true);
                    }

                    if (type === 'expense') {
                        const updated = await this.db.updateExpense(id, updateData);
                        this.state.updateExpense(updated);
                    } else {
                        const updated = await this.db.updateIncome(id, updateData);
                        this.state.updateIncome(updated);
                    }
                    
                    // Refresh and close
                    this.ui.updateAllUI();
                    document.getElementById('editTransactionModal').classList.remove('active');
                    this.showAlert('Changes saved successfully', 'success');
                } catch (error) {
                    console.error('Update error:', error);
                    this.showAlert('Update failed: ' + error.message, 'error');
                } finally {
                    if (this.ui && typeof this.ui.showLoading === 'function') {
                        this.ui.showLoading(false);
                    }
                }
            });
        }
        
    setupDeleteModalHandlers() {
        const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
        const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
        const closeDeleteModal = document.getElementById('closeDeleteModal');
        
        if (confirmDeleteBtn) {
            confirmDeleteBtn.addEventListener('click', async () => {
                await this.handleConfirmDelete();
            });
        }
        
        if (cancelDeleteBtn) {
            cancelDeleteBtn.addEventListener('click', () => {
                document.getElementById('deleteModal').classList.remove('active');
                window.finTrack.pendingDelete = null;
            });
        }
        
        if (closeDeleteModal) {
            closeDeleteModal.addEventListener('click', () => {
                document.getElementById('deleteModal').classList.remove('active');
                window.finTrack.pendingDelete = null;
            });
        }
    }
    
    setupOtherModalHandlers() {
        // Close subcategory modal
        document.getElementById('closeSubcategoryModal')?.addEventListener('click', () => {
            document.getElementById('subcategoryModal').classList.remove('active');
        });
        
        // Close insufficient balance modal
        document.getElementById('closeInsufficientBalanceModal')?.addEventListener('click', () => {
            document.getElementById('insufficientBalanceModal').classList.remove('active');
        });
    }
    
async checkInitialAuthState() {
    const authState = await this.auth.checkAuth();
    console.log('Initial auth state:', authState);
    
    if (authState.isAuthenticated) {
        this.showDashboard();
        await new Promise(resolve => setTimeout(resolve, 100));
    } else {
        this.showLandingPage();
    }
}
    
    async handleSignup(e) {
        e.preventDefault(); // Make sure to prevent default
        
        const form = e.target;
        const email = form.querySelector('#signupEmail').value.trim();
        const password = form.querySelector('#signupPassword').value;
        const confirmPassword = form.querySelector('#confirmPassword').value;
        
        // Basic validation
        if (password !== confirmPassword) {
            this.showAlert('Passwords do not match', 'error');
            return;
        }
        
        if (password.length < 6) {
            this.showAlert('Password must be at least 6 characters', 'error');
            return;
        }
        
        // Email validation
        if (!validationUtils.validateEmail(email)) {
            this.showAlert('Please enter a valid email address', 'error');
            return;
        }
        
        try {
            const result = await this.auth.signUp(email, password);
            
            if (result.success) {
                if (result.requiresConfirmation) {
                    this.showAlert('Check your email to confirm your account', 'success');
                    this.hideModal('signup');
                    form.reset(); // Clear the form
                } else {
                    // Auto-login successful
                    this.hideModal('signup');
                    form.reset(); // Clear the form
                }
            }
        } catch (error) {
            // Show ONLY ONE user-friendly error message
            let errorMessage = 'Signup failed. Please try again.';
            
            const errorMsg = error.message.toLowerCase();
            
            if (errorMsg.includes('already registered') || 
                errorMsg.includes('user already') ||
                errorMsg.includes('already exists') ||
                errorMsg.includes('user already exists')) {
                errorMessage = 'This email is already registered. Please sign in instead.';
            } else if (errorMsg.includes('invalid email') || errorMsg.includes('email')) {
                errorMessage = 'Please enter a valid email address.';
            } else if (errorMsg.includes('password')) {
                errorMessage = 'Password must be at least 6 characters.';
            } else if (errorMsg.includes('rate limit') || errorMsg.includes('too many requests')) {
                errorMessage = 'Too many attempts. Please try again later.';
            }
            
            // Show only one alert
            this.showAlert(errorMessage, 'error');
        }
    }
    
    async handleLogin(e) {
        const form = e.target;
        const email = form.querySelector('#loginEmail').value;
        const password = form.querySelector('#loginPassword').value;
        
        try {
            const result = await this.auth.signIn(email, password);
            
            if (result.success) {
                // Modal will be closed by event listener
                this.hideModal('login');
            }
        } catch (error) {
            // Show user-friendly error messages
            let errorMessage = 'Login failed. Please try again.';
            
            if (error.message.includes('Invalid login credentials')) {
                errorMessage = 'Invalid email or password. Please try again.';
            } else if (error.message.includes('Email not confirmed')) {
                errorMessage = 'Please confirm your email before signing in.';
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            this.showAlert(errorMessage, 'error');
        }
    }
        
    async handleAddExpense(e) {
        const form = e.target;
        const id = document.getElementById('expenseId').value;
        const description = document.getElementById('expenseDescription').value;
        const amount = currencyUtils.parseCurrency(document.getElementById('expenseAmount').value);
        const date = document.getElementById('expenseDate').value;
        const category = document.getElementById('expenseCategory').value;
        const subcategory = document.getElementById('expenseSubcategory').value;
        const walletId = this.state.getState().currentWalletId;
        
        if (!walletId) {
            this.showAlert('Select a wallet first', 'error');
            return;
        }
        
        if (amount <= 0) {
            this.showAlert('Enter a valid amount', 'error');
            return;
        }
        
        try {
            const expenseData = { id, description, amount, date, category, subcategory, walletId };
            const savedExpense = await this.db.createExpense(expenseData);
            
            if (id) {
                this.state.updateExpense(savedExpense);
                this.showAlert('Expense updated', 'success');
            } else {
                this.state.addExpense(savedExpense);
                this.showAlert('Expense added', 'success');
            }
            
            this.ui.resetExpenseForm();
        } catch (error) {
            this.showAlert('Error saving expense', 'error');
        }
    }
    
    async handleAddIncome(e) {
        const form = e.target;
        const id = document.getElementById('incomeId').value;
        const description = document.getElementById('incomeDescription').value;
        const amount = currencyUtils.parseCurrency(document.getElementById('incomeAmount').value);
        const date = document.getElementById('incomeDate').value;
        const source = document.getElementById('incomeSource').value;
        const walletId = this.state.getState().currentWalletId;
        
        if (!walletId) {
            this.showAlert('Select a wallet first', 'error');
            return;
        }
        
        if (amount <= 0) {
            this.showAlert('Enter a valid amount', 'error');
            return;
        }
        
        try {
            const incomeData = { id, description, amount, date, source, walletId };
            const savedIncome = await this.db.createIncome(incomeData);
            
            if (id) {
                this.state.updateIncome(savedIncome);
                this.showAlert('Income updated', 'success');
            } else {
                this.state.addIncome(savedIncome);
                this.showAlert('Income added', 'success');
            }
            
            this.ui.resetIncomeForm();
        } catch (error) {
            this.showAlert('Error saving income', 'error');
        }
    }
    
    async handleAddWallet(e) {
        const form = e.target;
        const id = document.getElementById('walletId').value;
        const name = document.getElementById('walletName').value;
        
        try {
            const walletData = { id, name };
            const savedWallet = await this.db.createWallet(walletData);
            
            if (id) {
                this.state.updateWallet(savedWallet);
                this.showAlert('Wallet updated', 'success');
            } else {
                this.state.addWallet(savedWallet);
                this.showAlert('Wallet added', 'success');
            }
            
            this.ui.resetWalletForm();
        } catch (error) {
            this.showAlert('Error saving wallet', 'error');
        }
    }
    
    async handleAddCategory(e) {
        const form = e.target;
        const id = document.getElementById('categoryId').value;
        const type = document.getElementById('categoryType').value;
        const name = document.getElementById('categoryName').value;
        let parentId = null;
        
        if (type === 'sub') {
            parentId = document.getElementById('parentCategory').value;
            if (!parentId) {
                this.showAlert('Select a parent category', 'error');
                return;
            }
        }
        
        try {
            const categoryData = { id, name, type, parentId };
            const savedCategory = await this.db.createCategory(categoryData);
            
            if (id) {
                this.state.updateCategory(savedCategory);
                this.showAlert('Category updated', 'success');
            } else {
                this.state.addCategory(savedCategory);
                this.showAlert('Category added', 'success');
            }
            
            this.ui.resetCategoryForm();
        } catch (error) {
            this.showAlert('Error saving category', 'error');
        }
    }

    async handleSetDefaultWallet(walletId) {
        try {
            await this.db.setDefaultWallet(walletId);
            
            // Update all wallets in state to reflect the change
            const wallets = this.state.getWallets().map(w => ({
                ...w,
                isDefault: w.id === walletId
            }));
            
            this.state.setWallets(wallets);
            this.showAlert('Default wallet updated', 'success');
        } catch (error) {
            console.error('Error setting default wallet:', error);
            this.showAlert('Error setting default wallet', 'error');
        }
    }    
    
    async handleAddSubcategory(e) {
        e.preventDefault();
        
        const name = document.getElementById('subcategoryName').value;
        const parentId = document.getElementById('parentCategoryId').value;
        
        if (!name || !parentId) {
            this.showAlert('Enter subcategory name', 'error');
            return;
        }
        
        try {
            const categoryData = { name, type: 'sub', parentId };
            const savedCategory = await this.db.createCategory(categoryData);
            
            this.state.addCategory(savedCategory);
            this.showAlert('Subcategory added', 'success');
            
            document.getElementById('subcategoryForm').reset();
            document.getElementById('subcategoryModal').classList.remove('active');
        } catch (error) {
            this.showAlert('Error saving subcategory', 'error');
        }
    }
    
    async handleConfirmDelete() {
        const pendingDelete = window.finTrack.pendingDelete;
        if (!pendingDelete) return;
        
        const { type, id, name } = pendingDelete;
        
        try {
            let success = false;
            
            switch (type) {
                case 'expense':
                    success = await this.db.delete('expenses', id);
                    if (success) this.state.deleteExpense(id);
                    break;
                case 'income':
                    success = await this.db.delete('incomes', id);
                    if (success) this.state.deleteIncome(id);
                    break;
                case 'wallet':
                    success = await this.db.delete('wallets', id);
                    if (success) this.state.deleteWallet(id);
                    break;
                case 'category':
                    success = await this.db.delete('categories', id);
                    if (success) this.state.deleteCategory(id);
                    break;
            }
            
            if (success) {
                this.showAlert(`${type} deleted`, 'success');
            }
        } catch (error) {
            this.showAlert(`Error deleting ${type}`, 'error');
        }
        
        document.getElementById('deleteModal').classList.remove('active');
        window.finTrack.pendingDelete = null;
    }
    
    showModal(modalName) {
        const modal = document.getElementById(`${modalName}Modal`);
        if (modal) {
            modal.classList.add('active');
        }
    }
    
    hideModal(modalName) {
        const modal = document.getElementById(`${modalName}Modal`);
        if (modal) {
            modal.classList.remove('active');
        }
    }
    
    showDashboard() {
        if (this.domElements.landingPage) {
            this.domElements.landingPage.style.display = 'none';
        }
        if (this.domElements.dashboardContainer) {
            this.domElements.dashboardContainer.style.display = 'block';
        }
        if (this.domElements.loginBtn) {
            this.domElements.loginBtn.classList.add('hidden');
        }
        if (this.domElements.signupBtn) {
            this.domElements.signupBtn.classList.add('hidden');
        }
        if (this.domElements.logoutBtn) {
            this.domElements.logoutBtn.classList.remove('hidden');
        }
    }
    
    showLandingPage() {
        if (this.domElements.landingPage) {
            this.domElements.landingPage.style.display = 'block';
        }
        if (this.domElements.dashboardContainer) {
            this.domElements.dashboardContainer.style.display = 'none';
        }
        if (this.domElements.loginBtn) {
            this.domElements.loginBtn.classList.remove('hidden');
        }
        if (this.domElements.signupBtn) {
            this.domElements.signupBtn.classList.remove('hidden');
        }
        if (this.domElements.logoutBtn) {
            this.domElements.logoutBtn.classList.add('hidden');
        }
    }
    
    showAlert(message, type = 'info') {
        const container = this.domElements.alertContainer;
        if (!container) {
            console.log(`[${type.toUpperCase()}] ${message}`);
            return;
        }
        
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        const icon = type === 'success' ? 'fa-check-circle' : 
                     type === 'warning' ? 'fa-exclamation-triangle' : 'fa-exclamation-circle';
        
        alert.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
        container.appendChild(alert);
        
        // Remove after 4 seconds
        setTimeout(() => {
            if (alert.parentNode === container) {
                container.removeChild(alert);
            }
        }, 4000);
    }
}

// ==================== UI CONTROLLER CLASS (INLINE) ====================

class UIController {
    constructor(app) {
        this.app = app;
        this.state = app.state;
        this.initializeUI();
        this.setupStateListeners();
    }
    
    initializeUI() {
        // Set current date in form inputs
        this.setDefaultDates();
        
        // Setup tabs
        this.setupTabs();
        
        // Setup form inputs
        this.setupCurrencyInputs();
        
        // Setup category type toggle
        this.setupCategoryTypeToggle();
        
        // Initialize dropdowns
        this.updateGlobalWalletSelector();
        this.updateMonthYearFilters();
    }
    
    setupStateListeners() {
        // Listen for state changes and update UI
        this.state.subscribe('expenses', () => {
            this.updateExpensesUI();
            this.updateStats();
        });
        this.state.subscribe('incomes', () => {
            this.updateIncomesUI();
            this.updateStats();
        });
        this.state.subscribe('wallets', () => {
            this.updateWalletsUI();
            this.updateStats();
        });
        this.state.subscribe('categories', () => this.updateCategoriesUI());
        this.state.subscribe('currentWalletId', () => this.updateWalletDependentUI());
        this.state.subscribe('activeTab', () => this.updateActiveTab());
    }
    
    // ==================== FORM SETUP ====================
    
    setDefaultDates() {
        const today = new Date().toISOString().split('T')[0];
        const expenseDate = document.getElementById('expenseDate');
        const incomeDate = document.getElementById('incomeDate');
        
        if (expenseDate) expenseDate.value = today;
        if (incomeDate) incomeDate.value = today;
    }
    
    setupCurrencyInputs() {
        const expenseAmount = document.getElementById('expenseAmount');
        const incomeAmount = document.getElementById('incomeAmount');
        
        if (expenseAmount) {
            expenseAmount.addEventListener('input', function() {
                this.value = currencyUtils.formatCurrency(this.value);
            });
        }
        
        if (incomeAmount) {
            incomeAmount.addEventListener('input', function() {
                this.value = currencyUtils.formatCurrency(this.value);
            });
        }
    }
    
    setupCategoryTypeToggle() {
        const categoryType = document.getElementById('categoryType');
        const parentCategoryGroup = document.getElementById('parentCategoryGroup');
        
        if (categoryType && parentCategoryGroup) {
            categoryType.addEventListener('change', (e) => {  // Changed function() to arrow function
                if (e.target.value === 'sub') {
                    parentCategoryGroup.classList.remove('hidden');
                    this.loadParentCategories();  // Now 'this' refers to UIController
                } else {
                    parentCategoryGroup.classList.add('hidden');
                }
            });
        }
    }
    
    loadParentCategories() {
        const parentCategory = document.getElementById('parentCategory');
        if (!parentCategory) return;
        
        parentCategory.innerHTML = '<option value="">Select parent</option>';
        const mainCategories = this.state.getMainCategories();
        
        mainCategories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            parentCategory.appendChild(option);
        });
    }
    
    // ==================== TAB MANAGEMENT ====================
    
    setupTabs() {
        const tabs = document.querySelectorAll('.tab');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.getAttribute('data-tab');
                this.state.setActiveTab(tabId);
            });
        });
    }
    
    updateActiveTab() {
        const activeTab = this.state.getActiveTab();
        const tabs = document.querySelectorAll('.tab');
        const tabContents = document.querySelectorAll('.tab-content');
        
        // Update tab buttons
        tabs.forEach(tab => {
            if (tab.getAttribute('data-tab') === activeTab) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        
        // Update tab content
        tabContents.forEach(content => {
            if (content.id === `${activeTab}Tab`) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });
        
        // Load data for active tab
        this.loadTabData(activeTab);
    }
    
    loadTabData(tabId) {
        switch (tabId) {
            case 'expenses':
                this.updateCurrentMonthExpenses();
                break;
            case 'historical':
                this.updateHistoricalExpensesView();
                break;
            case 'income':
                this.updateIncomesUI();
                break;
            case 'wallets':
                this.updateWalletsUI();
                break;
            case 'categories':
                this.updateCategoriesUI();
                break;
        }
    }
    
    // ==================== WALLET UI ====================
    
    updateGlobalWalletSelector() {
        const selector = document.getElementById('globalWalletSelect');
        if (!selector) return;
        
        const wallets = this.state.getWallets();
        const currentWalletId = this.state.getState().currentWalletId;
        
        // Clear and rebuild options
        selector.innerHTML = '<option value="">Select wallet</option>';
        
        wallets.forEach(wallet => {
            const option = document.createElement('option');
            option.value = wallet.id;
            option.textContent = wallet.name;
            selector.appendChild(option);
        });
        
        // 👇 FIX: Set the value AFTER adding all options
        if (currentWalletId && wallets.some(w => w.id === currentWalletId)) {
            selector.value = currentWalletId;
            console.log('Set wallet selector to:', currentWalletId);
        } else if (wallets.length > 0) {
            // Fallback to first wallet
            const firstWalletId = wallets[0].id;
            this.state.setCurrentWallet(firstWalletId);
            selector.value = firstWalletId;
            console.log('Set wallet selector to first wallet:', firstWalletId);
        }
        
        // Remove old event listener by cloning
        const newSelector = selector.cloneNode(true);
        selector.parentNode.replaceChild(newSelector, selector);
        
        // Restore the selected value after cloning
        if (currentWalletId && wallets.some(w => w.id === currentWalletId)) {
            newSelector.value = currentWalletId;
        } else if (wallets.length > 0) {
            newSelector.value = wallets[0].id;
        }
        
        // Add change event listener with persistence
        newSelector.addEventListener('change', async (e) => {
            const newWalletId = e.target.value || null;
            const userId = this.app.auth.getUser()?.id;
            
            await handleWalletChange(
                this.app.walletPersistence,
                newWalletId,
                userId,
                (walletId) => {
                    this.state.setCurrentWallet(walletId);
                    this.updateWalletDependentUI();
                }
            );
        });
    }
    
    updateWalletDependentUI() {
        this.updateExpensesUI();
        this.updateIncomesUI();
        this.updateStats();
        this.updateMonthYearFilters();
    }

    syncWalletSelector() {
        const selector = document.getElementById('globalWalletSelect');
        if (!selector) return;
        
        const currentWalletId = this.state.getState().currentWalletId;
        if (currentWalletId && selector.value !== currentWalletId) {
            selector.value = currentWalletId;
            console.log('Synced wallet selector to:', currentWalletId);
        }
    }    
    
    // ==================== EXPENSE UI ====================
    
    updateExpensesUI() {
        this.updateCurrentMonthExpenses();
        this.updateHistoricalExpensesView();
    }
    
    updateCurrentMonthExpenses() {
        const expensesList = document.getElementById('expensesList');
        if (!expensesList) return;
        
        const currentWalletId = this.state.getState().currentWalletId;
        
        // If no wallet is selected, show message
        if (!currentWalletId) {
            expensesList.innerHTML = `
                <div class="expense-item">
                    <div class="expense-details">Select a wallet first</div>
                </div>
            `;
            return;
        }
        
        // Get expenses for current wallet and current month
        const expenses = this.state.getExpenses();
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        const currentMonthExpenses = expenses.filter(expense => {
            // Filter by wallet
            if (expense.walletId !== currentWalletId) return false;
            
            // Filter by current month
            const expenseDate = new Date(expense.date);
            return expenseDate.getMonth() === currentMonth && 
                   expenseDate.getFullYear() === currentYear;
        });
        
        if (currentMonthExpenses.length === 0) {
            expensesList.innerHTML = `
                <div class="expense-item">
                    <div class="expense-details">No expenses yet</div>
                </div>
            `;
            return;
        }
        
        this.renderExpenseList(currentMonthExpenses, expensesList);
    }
    
    updateHistoricalExpensesView() {
        const historicalExpensesList = document.getElementById('historicalExpensesList');
        const monthlyExpenseTotal = document.getElementById('monthlyExpenseTotal');
        const selectedMonthYear = document.getElementById('selectedMonthYear');
        
        if (!historicalExpensesList || !monthlyExpenseTotal || !selectedMonthYear) return;
        
        const currentWalletId = this.state.getState().currentWalletId;
        
        // If no wallet is selected, show message
        if (!currentWalletId) {
            historicalExpensesList.innerHTML = `
                <div class="expense-item">
                    <div class="expense-details">Select a wallet first</div>
                </div>
            `;
            monthlyExpenseTotal.textContent = currencyUtils.formatDisplayCurrency(0);
            selectedMonthYear.textContent = 'Select a wallet';
            return;
        }
        
        const filters = this.state.getState().filters;
        const expenses = this.state.getExpenses();
        
        // Filter by wallet AND month/year
        const monthlyExpenses = expenses.filter(expense => {
            if (expense.walletId !== currentWalletId) return false;
            
            const expenseDate = new Date(expense.date);
            return expenseDate.getMonth() === filters.month && 
                   expenseDate.getFullYear() === filters.year;
        });
        
        // Update summary
        const monthlyTotal = monthlyExpenses.reduce((sum, expense) => sum + expense.amount, 0);
        monthlyExpenseTotal.textContent = currencyUtils.formatDisplayCurrency(monthlyTotal);
        
        const monthName = dateUtils.getMonthName(filters.month);
        selectedMonthYear.textContent = `${monthName} ${filters.year}`;
        
        // Render expenses
        if (monthlyExpenses.length === 0) {
            historicalExpensesList.innerHTML = `
                <div class="expense-item">
                    <div class="expense-details">No expenses for this period</div>
                </div>
            `;
            return;
        }
        
        this.renderExpenseList(monthlyExpenses, historicalExpensesList);
    }
    
    renderExpenseList(expenses, container) {
        const sortedExpenses = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
        const wallets = this.state.getWallets();
        
        container.innerHTML = '';
        
        sortedExpenses.forEach(expense => {
            const expenseDate = new Date(expense.date).toLocaleDateString();
            const wallet = wallets.find(w => w.id === expense.walletId);
            
            let categoryText = expense.category;
            if (expense.subcategory) {
                categoryText += ` > ${expense.subcategory}`;
            }
            
            const expenseItem = document.createElement('div');
            expenseItem.className = 'expense-item';
            expenseItem.innerHTML = `
                <div class="expense-details">
                    <div style="font-weight: 500;">${expense.description}</div>
                    <div style="font-size: 0.8rem; color: var(--gray);">
                        ${expenseDate} • ${wallet ? wallet.name : 'Unknown'}
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div>
                        <div class="expense-amount">${currencyUtils.formatDisplayCurrency(expense.amount)}</div>
                        <span class="expense-category">${categoryText}</span>
                    </div>
                    <div class="action-buttons">
                        <button class="edit-btn" onclick="window.finTrack.ui.editExpense('${expense.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="delete-btn" onclick="window.finTrack.ui.confirmDelete('expense', '${expense.id}', '${expense.description}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
            container.appendChild(expenseItem);
        });
    }
    
    // ==================== INCOME UI ====================
    
    updateIncomesUI() {
        const incomesList = document.getElementById('incomesList');
        if (!incomesList) return;
        
        const currentWalletId = this.state.getState().currentWalletId;
        
        // If no wallet is selected, show message
        if (!currentWalletId) {
            incomesList.innerHTML = `
                <div class="income-item">
                    <div class="income-details">Select a wallet first</div>
                </div>
            `;
            return;
        }
        
        const incomes = this.state.getIncomes();
        const displayIncomes = incomes.filter(income => income.walletId === currentWalletId);
        
        if (displayIncomes.length === 0) {
            incomesList.innerHTML = `
                <div class="income-item">
                    <div class="income-details">No income yet</div>
                </div>
            `;
            return;
        }
        
        this.renderIncomeList(displayIncomes, incomesList);
    }
    
    renderIncomeList(incomes, container) {
        const sortedIncomes = [...incomes].sort((a, b) => new Date(b.date) - new Date(a.date));
        const wallets = this.state.getWallets();
        
        container.innerHTML = '';
        
        sortedIncomes.forEach(income => {
            const incomeDate = new Date(income.date).toLocaleDateString();
            const wallet = wallets.find(w => w.id === income.walletId);
            
            const incomeItem = document.createElement('div');
            incomeItem.className = 'income-item';
            incomeItem.innerHTML = `
                <div class="income-details">
                    <div style="font-weight: 500;">${income.description}</div>
                    <div style="font-size: 0.8rem; color: var(--gray);">
                        ${incomeDate} • ${wallet ? wallet.name : 'Unknown'}
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div>
                        <div class="income-amount">${currencyUtils.formatDisplayCurrency(income.amount)}</div>
                        <span class="income-source">${income.source}</span>
                    </div>
                    <div class="action-buttons">
                        <button class="edit-btn" onclick="window.finTrack.ui.editIncome('${income.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="delete-btn" onclick="window.finTrack.ui.confirmDelete('income', '${income.id}', '${income.description}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
            container.appendChild(incomeItem);
        });
    }
    
    // ==================== WALLET UI ====================
    
    updateWalletsUI() {
        const walletsList = document.getElementById('walletsList');
        if (!walletsList) return;
        
        const wallets = this.state.getWallets();
        
        if (wallets.length === 0) {
            walletsList.innerHTML = `
                <div class="wallet-item">
                    <div class="wallet-details">No wallets yet</div>
                </div>
            `;
            return;
        }
        
        this.renderWalletList(wallets, walletsList);
        this.updateGlobalWalletSelector();
    }
    
    renderWalletList(wallets, container) {
        container.innerHTML = '';
        
        wallets.forEach(wallet => {
            const balance = this.state.getWalletBalance(wallet.id);
            const isDefault = wallet.isDefault || false;
            
            const walletItem = document.createElement('div');
            walletItem.className = 'wallet-item';
            walletItem.innerHTML = `
                <div class="wallet-details">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="font-weight: 500;">${wallet.name}</div>
                        ${isDefault ? '<span style="background: var(--primary); color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 600;">DEFAULT</span>' : ''}
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div class="wallet-balance">${currencyUtils.formatDisplayCurrency(balance)}</div>
                    <div class="action-buttons">
                        ${!isDefault ? `
                            <button class="btn btn-sm" onclick="window.finTrack.app.handleSetDefaultWallet('${wallet.id}')" 
                                    style="padding: 4px 8px; font-size: 0.75rem; background: var(--light-gray); color: var(--dark);">
                                <i class="fas fa-star"></i> Default
                            </button>
                        ` : ''}
                        <button class="edit-btn" onclick="window.finTrack.ui.editWallet('${wallet.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="delete-btn" onclick="window.finTrack.ui.confirmDelete('wallet', '${wallet.id}', '${wallet.name}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
            container.appendChild(walletItem);
        });
    }
    
    // ==================== CATEGORY UI ====================
    
    updateCategoriesUI() {
        this.updateCategoryDropdowns();
        this.renderCategoriesList();
    }
    
    renderCategoriesList() {
        const categoriesList = document.getElementById('categoriesList');
        if (!categoriesList) return;
        
        const categories = this.state.getCategories();
        
        if (categories.length === 0) {
            categoriesList.innerHTML = `
                <div class="category-item">
                    <div class="category-details">No categories yet</div>
                </div>
            `;
            return;
        }
        
        const mainCategories = categories.filter(c => c.type === 'main');
        const subcategories = categories.filter(c => c.type === 'sub');
        
        categoriesList.innerHTML = '';
        
        mainCategories.forEach(category => {
            const categoryItem = document.createElement('div');
            categoryItem.className = 'category-item';
            categoryItem.innerHTML = `
                <div class="category-details">
                    <div style="font-weight: 500;">${category.name}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div class="category-actions">
                        <button class="add-subcategory-btn" data-id="${category.id}">
                            <i class="fas fa-plus"></i> Sub
                        </button>
                    </div>
                    <div class="action-buttons">
                        <button class="edit-btn" onclick="window.finTrack.ui.editCategory('${category.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="delete-btn" onclick="window.finTrack.ui.confirmDelete('category', '${category.id}', '${category.name}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
            categoriesList.appendChild(categoryItem);
            
            // Add subcategory button listener
            const addSubcategoryBtn = categoryItem.querySelector('.add-subcategory-btn');
            addSubcategoryBtn.addEventListener('click', () => {
                this.openSubcategoryModal(category.id);
            });
            
            // Add subcategories for this main category
            const categorySubcategories = subcategories.filter(sc => sc.parentId === category.id);
            categorySubcategories.forEach(subcategory => {
                const subcategoryItem = document.createElement('div');
                subcategoryItem.className = 'category-item subcategory-item';
                subcategoryItem.innerHTML = `
                    <div class="category-details">
                        <div>${subcategory.name}</div>
                    </div>
                    <div class="action-buttons">
                        <button class="edit-btn" onclick="window.finTrack.ui.editCategory('${subcategory.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="delete-btn" onclick="window.finTrack.ui.confirmDelete('category', '${subcategory.id}', '${subcategory.name}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
                categoriesList.appendChild(subcategoryItem);
            });
        });
    }
    
    updateCategoryDropdowns() {
        const expenseCategory = document.getElementById('expenseCategory');
        if (!expenseCategory) return;
        
        expenseCategory.innerHTML = '<option value="">Select category</option>';
        const mainCategories = this.state.getMainCategories();
        
        mainCategories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.name;
            option.textContent = category.name;
            expenseCategory.appendChild(option);
        });
        
        // Setup subcategory dropdown update
        expenseCategory.addEventListener('change', (e) => {
            const selectedCategory = e.target.value;
            const expenseSubcategory = document.getElementById('expenseSubcategory');
            
            if (!expenseSubcategory) return;
            
            expenseSubcategory.innerHTML = '<option value="">Optional</option>';
            
            if (selectedCategory) {
                const mainCategory = mainCategories.find(c => c.name === selectedCategory);
                if (mainCategory) {
                    const subcategories = this.state.getSubcategories(mainCategory.id);
                    subcategories.forEach(subcategory => {
                        const option = document.createElement('option');
                        option.value = subcategory.name;
                        option.textContent = subcategory.name;
                        expenseSubcategory.appendChild(option);
                    });
                }
            }
        });
    }
    
    // ==================== STATS UI ====================
    
    updateStats() {
        const totalIncome = document.getElementById('totalIncome');
        const totalExpenses = document.getElementById('totalExpenses');
        const currentWalletBalance = document.getElementById('currentWalletBalance');
        
        if (!totalIncome || !totalExpenses || !currentWalletBalance) return;
        
        const currentWalletId = this.state.getState().currentWalletId;
        
        // If no wallet is selected, show 0
        if (!currentWalletId) {
            totalIncome.textContent = currencyUtils.formatDisplayCurrency(0);
            totalExpenses.textContent = currencyUtils.formatDisplayCurrency(0);
            currentWalletBalance.textContent = currencyUtils.formatDisplayCurrency(0);
            return;
        }
        
        // Calculate only for selected wallet
        const expenses = this.state.getExpenses().filter(e => e.walletId === currentWalletId);
        const incomes = this.state.getIncomes().filter(i => i.walletId === currentWalletId);
        
        const totalExpensesAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
        const totalIncomeAmount = incomes.reduce((sum, i) => sum + i.amount, 0);
        const balance = totalIncomeAmount - totalExpensesAmount;
        
        totalIncome.textContent = currencyUtils.formatDisplayCurrency(totalIncomeAmount);
        totalExpenses.textContent = currencyUtils.formatDisplayCurrency(totalExpensesAmount);
        currentWalletBalance.textContent = currencyUtils.formatDisplayCurrency(balance);
    }
    
    // ==================== FILTERS UI ====================
    
    updateMonthYearFilters() {
        const monthSelect = document.getElementById('monthSelect');
        const yearSelect = document.getElementById('yearSelect');
        
        if (!monthSelect || !yearSelect) return;
        
        // Clear existing options
        monthSelect.innerHTML = '';
        yearSelect.innerHTML = '';
        
        // Get unique years from expenses
        const expenses = this.state.getExpenses();
        const years = [...new Set(expenses.map(expense => {
            const date = new Date(expense.date);
            return date.getFullYear();
        }))];
        
        // Add current year if no expenses
        if (years.length === 0) {
            years.push(new Date().getFullYear());
        }
        
        // Sort years descending
        years.sort((a, b) => b - a);
        
        // Populate year dropdown
        years.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
        });
        
        // Populate month dropdown
        const monthNames = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"];
        
        monthNames.forEach((month, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = month;
            monthSelect.appendChild(option);
        });
        
        // Set current month/year
        const now = new Date();
        monthSelect.value = now.getMonth();
        yearSelect.value = now.getFullYear();
        
        // Update filters in state
        this.state.setFilter('month', now.getMonth());
        this.state.setFilter('year', now.getFullYear());
        
        // Add change listeners
        monthSelect.addEventListener('change', (e) => {
            this.state.setFilter('month', parseInt(e.target.value));
            this.updateHistoricalExpensesView();
        });
        
        yearSelect.addEventListener('change', (e) => {
            this.state.setFilter('year', parseInt(e.target.value));
            this.updateHistoricalExpensesView();
        });
    }
    
    // ==================== EDIT FUNCTIONS ====================
    
    editExpense(id) {
        const expense = this.state.getExpenses().find(e => e.id === id);
        if (!expense) return;
        this.openEditModal('expense', expense);
    }
    
    editIncome(id) {
        const income = this.state.getIncomes().find(i => i.id === id);
        if (!income) return;
        this.openEditModal('income', income);
    }

openEditModal(type, item) {
    const modal = document.getElementById('editTransactionModal');
    const title = document.getElementById('editModalTitle');
    const subtitle = document.getElementById('editModalSubtitle');
    const categorySelect = document.getElementById('editCategory');
    const subcategorySelect = document.getElementById('editSubcategory');

    // Set modal identity
    if (type === 'expense') {
        title.innerHTML = '<i class="fas fa-arrow-down text-danger"></i> Edit Expense';
        subtitle.textContent = 'Update expense details';
    } else {
        title.innerHTML = '<i class="fas fa-arrow-up text-success"></i> Edit Income';
        subtitle.textContent = 'Update income details';
    }
    
    document.getElementById('editItemType').value = type;
    document.getElementById('editItemId').value = item.id;
    
    // Populate dropdowns - FIX: Pass only 2 arguments, not 3
    this.populateCategorySelect(categorySelect, type);
    
    // Setup subcategory if it's an expense
    if (type === 'expense') {
        subcategorySelect.style.display = 'block';
        subcategorySelect.previousElementSibling.style.display = 'block';
        
        // Load subcategories based on selected category
        const mainCategories = this.state.getMainCategories();
        const mainCategory = mainCategories.find(c => c.name === item.category);
        
        if (mainCategory) {
            const subcategories = this.state.getSubcategories(mainCategory.id);
            subcategorySelect.innerHTML = '<option value="">Optional</option>';
            subcategories.forEach(subcat => {
                const option = document.createElement('option');
                option.value = subcat.name;
                option.textContent = subcat.name;
                if (subcat.name === item.subcategory) {
                    option.selected = true;
                }
                subcategorySelect.appendChild(option);
            });
            
            // Update subcategories when category changes
            categorySelect.addEventListener('change', (e) => {
                const selectedCategory = e.target.value;
                const selectedMainCategory = mainCategories.find(c => c.name === selectedCategory);
                
                if (selectedMainCategory) {
                    const newSubcategories = this.state.getSubcategories(selectedMainCategory.id);
                    subcategorySelect.innerHTML = '<option value="">Optional</option>';
                    newSubcategories.forEach(subcat => {
                        const option = document.createElement('option');
                        option.value = subcat.name;
                        option.textContent = subcat.name;
                        subcategorySelect.appendChild(option);
                    });
                } else {
                    subcategorySelect.innerHTML = '<option value="">Optional</option>';
                }
            });
        }
    } else {
        // Hide subcategory for income
        subcategorySelect.style.display = 'none';
        subcategorySelect.previousElementSibling.style.display = 'none';
    }

    // Fill values from the transaction
    document.getElementById('editDescription').value = item.description;
    document.getElementById('editAmount').value = item.amount;
    document.getElementById('editDate').value = item.date;
    document.getElementById('editCategory').value = type === 'expense' ? item.category : item.source;

    modal.classList.add('active');
}

    populateCategorySelect(selectElement, type) {
        // Clear existing options
        selectElement.innerHTML = '';
        
        if (type === 'expense') {
            // Get categories from state
            const categories = this.state.getCategories();
            
            categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.name;
                option.textContent = cat.name;
                selectElement.appendChild(option);
            });
        } else {
            // For Income, use standard sources
            const sources = ['Salary', 'Freelance', 'Investment', 'Gift', 'Bonus', 'Other'];
            sources.forEach(source => {
                const option = document.createElement('option');
                option.value = source;
                option.textContent = source;
                selectElement.appendChild(option);
            });
        }
    }    

    // Add this inside the UIController class in app.js
    showLoading(isLoading) {
        const submitBtn = document.querySelector('#editTransactionForm button[type="submit"]');
        if (!submitBtn) return;

        if (isLoading) {
            submitBtn.disabled = true;
            // Save the original text to restore it later
            submitBtn.dataset.originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        } else {
            submitBtn.disabled = false;
            // Restore the original text (e.g., "Save Changes")
            submitBtn.innerHTML = submitBtn.dataset.originalText || 'Save Changes';
        }
    }    
    
    editWallet(id) {
        const wallet = this.state.getWallets().find(w => w.id === id);
        if (!wallet) return;
        
        document.getElementById('walletId').value = wallet.id;
        document.getElementById('walletName').value = wallet.name;
        
        const walletSubmitBtn = document.getElementById('walletSubmitBtn');
        const walletCancelBtn = document.getElementById('walletCancelBtn');
        
        if (walletSubmitBtn) walletSubmitBtn.innerHTML = '<i class="fas fa-save"></i> Update';
        if (walletCancelBtn) walletCancelBtn.classList.remove('hidden');
        
        this.state.setActiveTab('wallets');
        domUtils.scrollToElement(document.getElementById('walletForm'));
    }
    
    editCategory(id) {
        const category = this.state.getCategories().find(c => c.id === id);
        if (!category) return;
        
        document.getElementById('categoryId').value = category.id;
        document.getElementById('categoryName').value = category.name;
        document.getElementById('categoryType').value = category.type;
        
        if (category.type === 'sub') {
            document.getElementById('parentCategoryGroup').classList.remove('hidden');
            this.loadParentCategories();
            
            setTimeout(() => {
                document.getElementById('parentCategory').value = category.parentId;
            }, 100);
        } else {
            document.getElementById('parentCategoryGroup').classList.add('hidden');
        }
        
        const categorySubmitBtn = document.getElementById('categorySubmitBtn');
        const categoryCancelBtn = document.getElementById('categoryCancelBtn');
        
        if (categorySubmitBtn) categorySubmitBtn.innerHTML = '<i class="fas fa-save"></i> Update';
        if (categoryCancelBtn) categoryCancelBtn.classList.remove('hidden');
        
        this.state.setActiveTab('categories');
        domUtils.scrollToElement(document.getElementById('categoryForm'));
    }
    
    // ==================== MODAL FUNCTIONS ====================
    
    openSubcategoryModal(parentId) {
        document.getElementById('parentCategoryId').value = parentId;
        document.getElementById('subcategoryModal').classList.add('active');
    }
    
    confirmDelete(type, id, name) {
        // Store in window for modal access
        window.finTrack.pendingDelete = { type, id, name };
        
        const deleteMessage = document.getElementById('deleteMessage');
        if (deleteMessage) {
            deleteMessage.textContent = `Delete "${name}"? This can't be undone.`;
        }
        
        document.getElementById('deleteModal').classList.add('active');
    }
    
    // ==================== FORM RESET FUNCTIONS ====================
    
    resetExpenseForm() {
        document.getElementById('expenseId').value = '';
        document.getElementById('expenseForm').reset();
        document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
        
        const expenseSubmitBtn = document.getElementById('expenseSubmitBtn');
        const expenseCancelBtn = document.getElementById('expenseCancelBtn');
        
        if (expenseSubmitBtn) expenseSubmitBtn.innerHTML = '<i class="fas fa-plus"></i> Add';
        if (expenseCancelBtn) expenseCancelBtn.classList.add('hidden');
    }
    
    resetIncomeForm() {
        document.getElementById('incomeId').value = '';
        document.getElementById('incomeForm').reset();
        document.getElementById('incomeDate').value = new Date().toISOString().split('T')[0];
        
        const incomeSubmitBtn = document.getElementById('incomeSubmitBtn');
        const incomeCancelBtn = document.getElementById('incomeCancelBtn');
        
        if (incomeSubmitBtn) incomeSubmitBtn.innerHTML = '<i class="fas fa-plus"></i> Add';
        if (incomeCancelBtn) incomeCancelBtn.classList.add('hidden');
    }
    
    resetWalletForm() {
        document.getElementById('walletId').value = '';
        document.getElementById('walletForm').reset();
        
        const walletSubmitBtn = document.getElementById('walletSubmitBtn');
        const walletCancelBtn = document.getElementById('walletCancelBtn');
        
        if (walletSubmitBtn) walletSubmitBtn.innerHTML = '<i class="fas fa-plus"></i> Add';
        if (walletCancelBtn) walletCancelBtn.classList.add('hidden');
    }
    
    resetCategoryForm() {
        document.getElementById('categoryId').value = '';
        document.getElementById('categoryForm').reset();
        document.getElementById('categoryType').value = '';
        document.getElementById('parentCategoryGroup').classList.add('hidden');
        
        const categorySubmitBtn = document.getElementById('categorySubmitBtn');
        const categoryCancelBtn = document.getElementById('categoryCancelBtn');
        
        if (categorySubmitBtn) categorySubmitBtn.innerHTML = '<i class="fas fa-plus"></i> Add';
        if (categoryCancelBtn) categoryCancelBtn.classList.add('hidden');
    }
    
    // ==================== UTILITY UI METHODS ====================
    
    updateAllUI() {
        console.log('UIController: updateAllUI called');
        this.updateExpensesUI();
        this.updateIncomesUI();
        this.updateWalletsUI();
        this.updateCategoriesUI();
        this.updateStats();  // Make sure this is here
        this.updateMonthYearFilters();
        this.syncWalletSelector();
    }

    getDataForCurrentWallet() {
        const currentWalletId = this.state.getState().currentWalletId;
        
        if (!currentWalletId) {
            return {
                expenses: [],
                incomes: [],
                message: 'Select a wallet first'
            };
        }
        
        const expenses = this.state.getExpenses().filter(e => e.walletId === currentWalletId);
        const incomes = this.state.getIncomes().filter(i => i.walletId === currentWalletId);
        
        return { expenses, incomes };
    }    
}

// Export app factory function
export const createApp = (supabase) => {
    return new FinTrackApp(supabase);
};