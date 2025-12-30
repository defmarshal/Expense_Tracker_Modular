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

import { initFAB } from './fab.js';

import { 
    getWalletPersistence, 
    loadAndSetDefaultWallet, 
    handleWalletChange 
} from './modules/wallet-persistence.js';
import { initializeSidebar } from './modules/sidebar.js';

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

        this.selectedExpensesForReimbursement = [];
        
        // Bind methods
        this.init = this.init.bind(this);
        this.showAlert = this.showAlert.bind(this);
    }
    
    async init() {
        try {
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

            // Setup FAB form handlers
            this.setupFABFormHandlers();            

            // Setup cross-tab sync
            this.setupCrossTabSync();
            
            this.setupReimbursementListeners();
            this.selectedExpensesForReimbursement = [];
            this.selectedExpensesForEditReimbursement = [];
            
            // Initialize FAB
            initFAB();

            // Check current auth state
            await this.checkInitialAuthState();
            
        } catch (error) {
            console.error('Error initializing app:', error);
            this.showAlert('Failed to initialize app. Please refresh.', 'error');
        }
    }

    setupCrossTabSync() {
        if (!this.walletPersistence) return;
        
        this.walletPersistence.setupCrossTabSync((newWalletId) => {
            
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
            this.showDashboard();
            this.showAlert('Welcome!', 'success');
        });
        
        this.auth.subscribe('signedOut', () => {
            this.showLandingPage();
        });
        
        this.auth.subscribe('dataLoaded', (data) => {
            
            // Force update all UI
            if (this.ui) {
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

                if (type === 'income') {
                    const isReimbursement = document.getElementById('editIncomeIsReimbursement')?.checked || false;
                    
                    if (isReimbursement && this.selectedExpensesForEditReimbursement && this.selectedExpensesForEditReimbursement.length === 0) {
                        const existingLinked = this.state.getLinkedExpensesForIncome(id);
                        if (existingLinked.length === 0) {
                            this.showAlert('Please select expenses to reimburse', 'error');
                            return;
                        }
                    }
                }

                const description = document.getElementById('editDescription').value;
                const amountStr = document.getElementById('editAmount').value;
                const amount = currencyUtils.parseCurrency(amountStr);
                const date = document.getElementById('editDate').value;
                const categoryValue = document.getElementById('editCategory').value;
                const subcategoryValue = document.getElementById('editSubcategory').value || '';
                
                const isReimbursable = document.getElementById('editIsReimbursable')?.checked || false;

                const updateData = {
                    description: description,
                    amount: amount,
                    date: date
                };

                if (type === 'expense') {
                    updateData.category = categoryValue;
                    updateData.subcategory = subcategoryValue || null;
                    updateData.wallet_id = this.state.getState().currentWalletId;
                    updateData.is_reimbursable = isReimbursable;
                    
                    console.log('💾 Updating expense with isReimbursable:', isReimbursable);
                    const receiptUpload = document.getElementById('editReceiptUpload');
                    const newReceiptFile = receiptUpload?.files[0];
                    const deleteExisting = receiptUpload?.dataset.deleteExisting === 'true';
                    
                    if (deleteExisting) {
                        const oldExpense = this.state.getExpenses().find(e => e.id === id);
                        if (oldExpense?.receiptUrl) {
                            await this.db.deleteReceipt(oldExpense.receiptUrl);
                        }
                        updateData.receipt_url = null;
                    } else if (newReceiptFile) {
                        if (this.ui && typeof this.ui.showLoading === 'function') {
                            this.ui.showLoading(true);
                        }
                        
                        const oldExpense = this.state.getExpenses().find(e => e.id === id);
                        if (oldExpense?.receiptUrl) {
                            await this.db.deleteReceipt(oldExpense.receiptUrl);
                        }
                        
                        const receiptUrl = await this.db.uploadReceipt(newReceiptFile, id);
                        updateData.receipt_url = receiptUrl;
                    }
                } else {
                    updateData.source = categoryValue;
                    updateData.wallet_id = this.state.getState().currentWalletId;
                }

                if (type === 'expense') {
                    const originalExpense = this.state.getExpenses().find(e => e.id === id);
                    const wasReimbursable = originalExpense?.isReimbursable || false;
                    const isNowReimbursable = isReimbursable;
                    
                    if (wasReimbursable && !isNowReimbursable) {
                        const budgetStatus = this.checkBudgetBeforeExpense(categoryValue, amount);
                        
                        if (budgetStatus && budgetStatus.willExceed) {
                            const confirmed = await this.showBudgetWarning(categoryValue, {
                                budget: budgetStatus.budget,
                                spent: budgetStatus.spent,
                                newExpense: amount
                            });
                            
                            if (!confirmed) {
                                return;
                            }
                        }
                    }
                }

                try {
                    if (this.ui && typeof this.ui.showLoading === 'function') {
                        this.ui.showLoading(true);
                    }

                    if (type === 'expense') {
                        const updated = await this.db.updateExpense(id, updateData);
                        this.state.updateExpense(updated);
                    } else {
                        const isReimbursement = document.getElementById('editIncomeIsReimbursement')?.checked || false;
                        updateData.isReimbursement = isReimbursement;
                        
                        const updated = await this.db.updateIncome(id, updateData);
                        
                        if (isReimbursement && this.selectedExpensesForEditReimbursement && this.selectedExpensesForEditReimbursement.length > 0) {
                            await this.db.unlinkReimbursement(id);
                            await this.db.linkReimbursement(id, this.selectedExpensesForEditReimbursement);
                            this.state.linkReimbursement(id, this.selectedExpensesForEditReimbursement);
                        } else if (!isReimbursement) {
                            await this.db.unlinkReimbursement(id);
                            this.state.unlinkReimbursement(id);
                        } else {
                            this.state.updateIncome(updated);
                        }
                    }
                    
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

        // Edit Income Reimbursement Toggle
        const editReimbursementToggle = document.getElementById('editIncomeIsReimbursement');
        const editExpenseSelector = document.getElementById('editIncomeExpenseSelector');

        if (editReimbursementToggle && editExpenseSelector) {
            editReimbursementToggle.addEventListener('change', (e) => {
                if (e.target.checked) {
                    editExpenseSelector.classList.remove('hidden');
                } else {
                    editExpenseSelector.classList.add('hidden');
                    this.selectedExpensesForEditReimbursement = [];
                    const textElement = document.getElementById('editSelectedExpensesText');
                    if (textElement) {
                        textElement.innerHTML = 'Select Expenses to Reimburse';
                    }
                }
            });
        }

        // Edit Income Expense Selection Button
        const editSelectExpensesBtn = document.getElementById('editSelectExpensesBtn');
        if (editSelectExpensesBtn) {
            editSelectExpensesBtn.addEventListener('click', () => {
                this.openEditExpenseSelectorModal();
            });
        }

        // Edit Wallet form
        document.getElementById('editWalletForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const id = document.getElementById('editWalletId').value;
            const name = document.getElementById('editWalletName').value;
            
            try {
                const walletData = { id, name };
                const savedWallet = await this.db.createWallet(walletData);
                
                this.state.updateWallet(savedWallet);
                this.showAlert('Wallet updated', 'success');
                
                document.getElementById('editWalletModal').classList.remove('active');
                this.ui.updateAllUI();
            } catch (error) {
                this.showAlert('Error updating wallet', 'error');
            }
        });

        // Edit Category form
        document.getElementById('editCategoryForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const id = document.getElementById('editCategoryId').value;
            const type = document.getElementById('editCategoryType').value;
            const name = document.getElementById('editCategoryName').value;
            let parentId = null;
            
            if (type === 'sub') {
                parentId = document.getElementById('editParentCategory').value;
                if (!parentId) {
                    this.showAlert('Select a parent category', 'error');
                    return;
                }
            }
            
            try {
                const categoryData = { id, name, type, parentId };
                const savedCategory = await this.db.createCategory(categoryData);
                
                this.state.updateCategory(savedCategory);
                this.showAlert('Category updated', 'success');
                
                document.getElementById('editCategoryModal').classList.remove('active');
                this.ui.updateAllUI();
            } catch (error) {
                this.showAlert('Error updating category', 'error');
            }
        });

        // Category type toggle for edit modal
        const editCategoryType = document.getElementById('editCategoryType');
        const editParentCategoryGroup = document.getElementById('editParentCategoryGroup');

        if (editCategoryType && editParentCategoryGroup) {
            editCategoryType.addEventListener('change', (e) => {
                if (e.target.value === 'sub') {
                    editParentCategoryGroup.classList.remove('hidden');
                    this.ui.loadEditParentCategories();
                } else {
                    editParentCategoryGroup.classList.add('hidden');
                }
            });
        }

        //v5.2
        document.getElementById('budgetForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddBudget(e);
        });        
    }   

    //v5.2
    async handleAddBudget(e) {
        const categoryId = document.getElementById('budgetCategory').value;
        const amount = currencyUtils.parseCurrency(document.getElementById('budgetAmount').value);
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
            const budgetData = { 
                categoryId: categoryId, 
                amount: amount, 
                walletId: walletId 
            };
            const savedBudget = await this.db.createBudget(budgetData);
            // ✅ Check if it's an update or new budget
            const existingBudgetIndex = this.state.getBudgets().findIndex(
                b => b.id === savedBudget.id
            );
            
            if (existingBudgetIndex >= 0) {
                this.state.updateBudget(savedBudget);
            } else {
                this.state.addBudget(savedBudget);
            }
            
            this.showAlert('Budget saved', 'success');
            
            document.getElementById('budgetModal').classList.remove('active');
            document.getElementById('budgetForm').reset();
        } catch (error) {
            console.error('=== handleAddBudget ERROR ===');
            console.error('Error object:', error);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            this.showAlert('Error saving budget: ' + error.message, 'error');
        }
    }

    //v5.2
    showBudgetWarning(category, budgetData) {
        return new Promise((resolve) => {
            // Populate modal data
            document.getElementById('budgetWarningCategory').textContent = category;
            document.getElementById('budgetWarningBudget').textContent = 
                currencyUtils.formatDisplayCurrency(budgetData.budget);
            document.getElementById('budgetWarningSpent').textContent = 
                currencyUtils.formatDisplayCurrency(budgetData.spent);
            document.getElementById('budgetWarningNew').textContent = 
                currencyUtils.formatDisplayCurrency(budgetData.newExpense);
            document.getElementById('budgetWarningTotal').textContent = 
                currencyUtils.formatDisplayCurrency(budgetData.spent + budgetData.newExpense);
            document.getElementById('budgetWarningOver').textContent = 
                currencyUtils.formatDisplayCurrency(budgetData.spent + budgetData.newExpense - budgetData.budget);
            
            // Store callback
            window.finTrack.budgetWarningCallback = resolve;
            
            // Show modal
            document.getElementById('budgetWarningModal').classList.add('active');
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

        // Close budget modal
        document.getElementById('closeBudgetModal')?.addEventListener('click', () => {
            document.getElementById('budgetModal').classList.remove('active');
        });   
        
        document.getElementById('closeBudgetWarning')?.addEventListener('click', () => {
            document.getElementById('budgetWarningModal').classList.remove('active');
            if (window.finTrack.budgetWarningCallback) {
                window.finTrack.budgetWarningCallback(false);
            }
        });

        document.getElementById('cancelBudgetWarning')?.addEventListener('click', () => {
            document.getElementById('budgetWarningModal').classList.remove('active');
            if (window.finTrack.budgetWarningCallback) {
                window.finTrack.budgetWarningCallback(false);
            }
        });

        document.getElementById('confirmBudgetWarning')?.addEventListener('click', () => {
            document.getElementById('budgetWarningModal').classList.remove('active');
            if (window.finTrack.budgetWarningCallback) {
                window.finTrack.budgetWarningCallback(true);
            }
        });       
        
        document.getElementById('closeReceiptViewer')?.addEventListener('click', () => {
            document.getElementById('receiptViewerModal').classList.remove('active');
        });
        
        document.getElementById('receiptViewerModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'receiptViewerModal') {
                e.target.classList.remove('active');
            }
        });        
    }

    // Add this method inside the FinTrackApp class in app.js
    // Add it after setupOtherModalHandlers() method

    setupFABFormHandlers() {
        // FAB Expense form
        document.getElementById('fabExpenseForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleFABAddExpense(e);
        });

        // FAB Income form
        document.getElementById('fabIncomeForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleFABAddIncome(e);
        });

        // FAB Wallet form
        document.getElementById('fabWalletForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleFABAddWallet(e);
        });

        // FAB Category form
        document.getElementById('fabCategoryForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleFABAddCategory(e);
        });

        // FAB Category type toggle
        const fabCategoryType = document.getElementById('fabCategoryType');
        const fabParentCategoryGroup = document.getElementById('fabParentCategoryGroup');
        
        if (fabCategoryType && fabParentCategoryGroup) {
            fabCategoryType.addEventListener('change', (e) => {
                if (e.target.value === 'sub') {
                    fabParentCategoryGroup.classList.remove('hidden');
                    this.loadFABParentCategories();
                } else {
                    fabParentCategoryGroup.classList.add('hidden');
                }
            });
        }

        // Setup currency formatting for FAB forms
        const fabExpenseAmount = document.getElementById('fabExpenseAmount');
        const fabIncomeAmount = document.getElementById('fabIncomeAmount');
        
        if (fabExpenseAmount) {
            fabExpenseAmount.addEventListener('input', function() {
                this.value = currencyUtils.formatCurrency(this.value);
            });
        }
        
        if (fabIncomeAmount) {
            fabIncomeAmount.addEventListener('input', function() {
                this.value = currencyUtils.formatCurrency(this.value);
            });
        }
    }

    loadFABParentCategories() {
        const parentCategory = document.getElementById('fabParentCategory');
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

    //v5.2
    async handleFABAddExpense(e) {
        // Prevent duplicate submissions
        const submitBtn = e.target.querySelector('button[type="submit"]');
        if (submitBtn.disabled) return;
        
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
        
        try {
            const description = document.getElementById('fabExpenseDescription').value;
            const amount = currencyUtils.parseCurrency(document.getElementById('fabExpenseAmount').value);
            const date = document.getElementById('fabExpenseDate').value;
            const category = document.getElementById('fabExpenseCategory').value;
            const subcategory = document.getElementById('fabExpenseSubcategory').value;
            
            const checkboxElement = document.getElementById('fabExpenseIsReimbursable');
            const isReimbursable = checkboxElement?.checked || false;
            
            const walletId = this.state.getState().currentWalletId;
            
            if (!walletId) {
                this.showAlert('Select a wallet first', 'error');
                return;
            }
            
            if (amount <= 0) {
                this.showAlert('Enter a valid amount', 'error');
                return;
            }
            
            // Check budget only if NOT reimbursable
            if (!isReimbursable) {
                const budgetStatus = this.checkBudgetBeforeExpense(category, amount);
                
                if (budgetStatus && budgetStatus.willExceed) {
                    const confirmed = await this.showBudgetWarning(category, {
                        budget: budgetStatus.budget,
                        spent: budgetStatus.spent,
                        newExpense: amount
                    });
                    
                    if (!confirmed) {
                        return;
                    }
                }
            }
            
            const expenseData = { 
                description, amount, date, category, subcategory, 
                walletId, isReimbursable 
            };
            
            // Handle receipt upload
            const receiptFile = document.getElementById('fabReceiptUpload')?.files[0];
            if (receiptFile) {
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading receipt...';
                
                // Create expense first to get ID
                const savedExpense = await this.db.createExpense(expenseData);
                
                // Upload receipt
                const receiptUrl = await this.db.uploadReceipt(receiptFile, savedExpense.id);
                
                // Update expense with receipt URL
                await this.db.updateExpense(savedExpense.id, { receipt_url: receiptUrl });
                savedExpense.receiptUrl = receiptUrl;
                
                this.state.addExpense(savedExpense);
            } else {
                const savedExpense = await this.db.createExpense(expenseData);
                this.state.addExpense(savedExpense);
            }
            
            this.showAlert('Expense added', 'success');

            this.ui.updateAllUI();
            
            document.getElementById('fabQuickAddModal').classList.remove('active');
            document.getElementById('fabExpenseForm').reset();
        } catch (error) {
            console.error('Error saving expense:', error);
            this.showAlert('Error saving expense: ' + error.message, 'error');
        } finally {
            // Re-enable button
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-plus"></i> Add Expense';
        }
    }

    async handleFABAddIncome(e) {
        const description = document.getElementById('fabIncomeDescription').value;
        const amount = currencyUtils.parseCurrency(document.getElementById('fabIncomeAmount').value);
        const date = document.getElementById('fabIncomeDate').value;
        const source = document.getElementById('fabIncomeSource').value;
        const walletId = this.state.getState().currentWalletId;
        const isReimbursement = document.getElementById('fabIncomeIsReimbursement')?.checked || false;
        
        if (!walletId) {
            this.showAlert('Select a wallet first', 'error');
            return;
        }
        
        if (amount <= 0) {
            this.showAlert('Enter a valid amount', 'error');
            return;
        }
        
        if (isReimbursement && this.selectedExpensesForReimbursement.length === 0) {
            this.showAlert('Please select expenses to reimburse', 'error');
            return;
        }
        
        try {
            const incomeData = { 
                description, 
                amount, 
                date, 
                source, 
                walletId,
                isReimbursement: isReimbursement,
                linkedExpenseIds: isReimbursement ? this.selectedExpensesForReimbursement : []
            };
            
            const savedIncome = await this.db.createIncome(incomeData);
            
            if (isReimbursement && this.selectedExpensesForReimbursement.length > 0) {
                await this.db.linkReimbursement(savedIncome.id, this.selectedExpensesForReimbursement);
                this.state.linkReimbursement(savedIncome.id, this.selectedExpensesForReimbursement);
            } else {
                this.state.addIncome(savedIncome);
            }
            
            this.showAlert('Income added successfully', 'success');

            this.ui.updateAllUI();
            
            document.getElementById('fabQuickAddModal').classList.remove('active');
            document.getElementById('fabIncomeForm').reset();
            document.getElementById('fabIncomeExpenseSelector').classList.add('hidden');
            this.selectedExpensesForReimbursement = [];
            this.updateSelectedExpensesDisplay();
            
        } catch (error) {
            console.error('Error saving income:', error);
            this.showAlert('Error saving income: ' + error.message, 'error');
        }
    }

    async handleFABAddWallet(e) {
        const name = document.getElementById('fabWalletName').value;
        
        try {
            const walletData = { name };
            const savedWallet = await this.db.createWallet(walletData);
            
            this.state.addWallet(savedWallet);
            this.showAlert('Wallet added', 'success');

            this.ui.updateAllUI();
            
            // Close modal and reset form
            document.getElementById('fabQuickAddModal').classList.remove('active');
            document.getElementById('fabWalletForm').reset();
        } catch (error) {
            this.showAlert('Error saving wallet', 'error');
        }
    }

    async handleFABAddCategory(e) {
        const type = document.getElementById('fabCategoryType').value;
        const name = document.getElementById('fabCategoryName').value;
        let parentId = null;
        
        if (type === 'sub') {
            parentId = document.getElementById('fabParentCategory').value;
            if (!parentId) {
                this.showAlert('Select a parent category', 'error');
                return;
            }
        }
        
        try {
            const categoryData = { name, type, parentId };
            const savedCategory = await this.db.createCategory(categoryData);
            
            this.state.addCategory(savedCategory);
            this.showAlert('Category added', 'success');

            this.ui.updateAllUI();
            
            // Close modal and reset form
            document.getElementById('fabQuickAddModal').classList.remove('active');
            document.getElementById('fabCategoryForm').reset();
            document.getElementById('fabParentCategoryGroup').classList.add('hidden');
        } catch (error) {
            this.showAlert('Error saving category', 'error');
        }
    }    

    setupReimbursementListeners() {
        const fabReimbursementToggle = document.getElementById('fabIncomeIsReimbursement');
        const fabExpenseSelector = document.getElementById('fabIncomeExpenseSelector');
        const fabSelectExpensesBtn = document.getElementById('fabSelectExpensesBtn');
        
        if (fabReimbursementToggle && fabExpenseSelector) {
            fabReimbursementToggle.addEventListener('change', (e) => {
                if (e.target.checked) {
                    fabExpenseSelector.classList.remove('hidden');
                    const sourceSelect = document.getElementById('fabIncomeSource');
                    if (sourceSelect) sourceSelect.value = 'Reimbursement';
                } else {
                    fabExpenseSelector.classList.add('hidden');
                    this.selectedExpensesForReimbursement = [];
                    this.updateSelectedExpensesDisplay();
                }
            });
        }
        
        if (fabSelectExpensesBtn) {
            fabSelectExpensesBtn.addEventListener('click', () => {
                this.openExpenseSelectorModal();
            });
        }
        
        const closeExpenseSelectorModal = document.getElementById('closeExpenseSelectorModal');
        const cancelExpenseSelector = document.getElementById('cancelExpenseSelector');
        const confirmExpenseSelector = document.getElementById('confirmExpenseSelector');
        
        if (closeExpenseSelectorModal) {
            closeExpenseSelectorModal.addEventListener('click', () => {
                document.getElementById('expenseSelectorModal').classList.remove('active');
            });
        }
        
        if (cancelExpenseSelector) {
            cancelExpenseSelector.addEventListener('click', () => {
                document.getElementById('expenseSelectorModal').classList.remove('active');
            });
        }
        
        if (confirmExpenseSelector) {
            confirmExpenseSelector.addEventListener('click', () => {
                this.confirmExpenseSelection();
            });
        }
    }

    openExpenseSelectorModal() {
        const modal = document.getElementById('expenseSelectorModal');
        const listContainer = document.getElementById('expenseSelectorList');
        
        const pendingExpenses = this.state.getPendingReimbursableExpenses();
        
        if (pendingExpenses.length === 0) {
            listContainer.innerHTML = `
                <div class="expense-selector-empty">
                    <i class="fas fa-inbox"></i>
                    <p>No pending reimbursable expenses</p>
                </div>
            `;
            modal.classList.add('active');
            return;
        }
        
        listContainer.innerHTML = '';
        pendingExpenses.forEach(expense => {
            const isSelected = this.selectedExpensesForReimbursement.includes(expense.id);
            
            const item = document.createElement('div');
            item.className = `expense-selector-item ${isSelected ? 'selected' : ''}`;
            item.innerHTML = `
                <input type="checkbox" 
                    ${isSelected ? 'checked' : ''} 
                    data-expense-id="${expense.id}"
                    data-expense-amount="${expense.amount}">
                <div class="expense-selector-details">
                    <div class="expense-description">${expense.description}</div>
                    <div class="expense-meta">
                        <span>${expense.category}</span>
                        ${expense.subcategory ? `<span>› ${expense.subcategory}</span>` : ''}
                        <span>${new Date(expense.date).toLocaleDateString()}</span>
                    </div>
                    <div class="expense-amount">${currencyUtils.formatDisplayCurrency(expense.amount)}</div>
                </div>
            `;
            
            const checkbox = item.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', (e) => {
                const expenseId = e.target.dataset.expenseId;
                if (e.target.checked) {
                    if (!this.selectedExpensesForReimbursement.includes(expenseId)) {
                        this.selectedExpensesForReimbursement.push(expenseId);
                    }
                    item.classList.add('selected');
                } else {
                    this.selectedExpensesForReimbursement = this.selectedExpensesForReimbursement.filter(id => id !== expenseId);
                    item.classList.remove('selected');
                }
                this.updateExpenseSelectorSummary();
            });
            
            listContainer.appendChild(item);
        });
        
        this.updateExpenseSelectorSummary();
        modal.classList.add('active');
    }

    openEditExpenseSelectorModal() {
        const modal = document.getElementById('expenseSelectorModal');
        const listContainer = document.getElementById('expenseSelectorList');
        
        const pendingExpenses = this.state.getPendingReimbursableExpenses();
        
        // Get currently linked expenses for this income
        const editItemId = document.getElementById('editItemId').value;
        const currentlyLinked = this.state.getLinkedExpensesForIncome(editItemId);
        
        // Initialize with currently linked expenses
        this.selectedExpensesForEditReimbursement = currentlyLinked.map(e => e.id);
        
        if (pendingExpenses.length === 0 && currentlyLinked.length === 0) {
            listContainer.innerHTML = `
                <div class="expense-selector-empty">
                    <i class="fas fa-inbox"></i>
                    <p>No pending reimbursable expenses</p>
                </div>
            `;
            modal.classList.add('active');
            return;
        }
        
        // Combine pending and currently linked expenses
        const allExpenses = [...pendingExpenses];
        currentlyLinked.forEach(linked => {
            if (!allExpenses.find(e => e.id === linked.id)) {
                allExpenses.push(linked);
            }
        });
        
        listContainer.innerHTML = '';
        allExpenses.forEach(expense => {
            const isSelected = this.selectedExpensesForEditReimbursement.includes(expense.id);
            
            const item = document.createElement('div');
            item.className = `expense-selector-item ${isSelected ? 'selected' : ''}`;
            item.innerHTML = `
                <input type="checkbox" 
                    ${isSelected ? 'checked' : ''} 
                    data-expense-id="${expense.id}"
                    data-expense-amount="${expense.amount}">
                <div class="expense-selector-details">
                    <div class="expense-description">${expense.description}</div>
                    <div class="expense-meta">
                        <span>${expense.category}</span>
                        ${expense.subcategory ? `<span>› ${expense.subcategory}</span>` : ''}
                        <span>${new Date(expense.date).toLocaleDateString()}</span>
                    </div>
                    <div class="expense-amount">${currencyUtils.formatDisplayCurrency(expense.amount)}</div>
                </div>
            `;
            
            const checkbox = item.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', (e) => {
                const expenseId = e.target.dataset.expenseId;
                if (e.target.checked) {
                    if (!this.selectedExpensesForEditReimbursement.includes(expenseId)) {
                        this.selectedExpensesForEditReimbursement.push(expenseId);
                    }
                    item.classList.add('selected');
                } else {
                    this.selectedExpensesForEditReimbursement = this.selectedExpensesForEditReimbursement.filter(id => id !== expenseId);
                    item.classList.remove('selected');
                }
                this.updateEditExpenseSelectorSummary();
            });
            
            listContainer.appendChild(item);
        });
        
        this.updateEditExpenseSelectorSummary();
        modal.classList.add('active');
    }    

    updateEditExpenseSelectorSummary() {
        const summary = document.getElementById('expenseSelectorSummary');
        const countElement = document.getElementById('selectedExpenseCount');
        const totalElement = document.getElementById('selectedExpenseTotal');
        
        if (this.selectedExpensesForEditReimbursement.length === 0) {
            summary.style.display = 'none';
            return;
        }
        
        const expenses = this.state.getExpenses();
        const selectedExpenses = expenses.filter(e => 
            this.selectedExpensesForEditReimbursement.includes(e.id)
        );
        
        const total = selectedExpenses.reduce((sum, e) => sum + e.amount, 0);
        
        countElement.textContent = selectedExpenses.length;
        totalElement.textContent = currencyUtils.formatDisplayCurrency(total);
        summary.style.display = 'block';
    }    

    updateExpenseSelectorSummary() {
        const summary = document.getElementById('expenseSelectorSummary');
        const countElement = document.getElementById('selectedExpenseCount');
        const totalElement = document.getElementById('selectedExpenseTotal');
        
        if (this.selectedExpensesForReimbursement.length === 0) {
            summary.style.display = 'none';
            return;
        }
        
        const expenses = this.state.getExpenses();
        const selectedExpenses = expenses.filter(e => 
            this.selectedExpensesForReimbursement.includes(e.id)
        );
        
        const total = selectedExpenses.reduce((sum, e) => sum + e.amount, 0);
        
        countElement.textContent = selectedExpenses.length;
        totalElement.textContent = currencyUtils.formatDisplayCurrency(total);
        summary.style.display = 'block';
    }

    confirmExpenseSelection() {
        const isEditMode = document.getElementById('editItemId').value !== '';
        const selectedArray = isEditMode ? this.selectedExpensesForEditReimbursement : this.selectedExpensesForReimbursement;
        
        if (selectedArray.length === 0) {
            this.showAlert('Please select at least one expense', 'warning');
            return;
        }
        
        const expenses = this.state.getExpenses();
        const selectedExpenses = expenses.filter(e => selectedArray.includes(e.id));
        const total = selectedExpenses.reduce((sum, e) => sum + e.amount, 0);
        
        if (isEditMode) {
            // Update edit mode display
            const textElement = document.getElementById('editSelectedExpensesText');
            if (textElement) {
                textElement.innerHTML = `${selectedArray.length} expense${selectedArray.length > 1 ? 's' : ''} selected (${currencyUtils.formatDisplayCurrency(total)})`;
            }
            
            // Update amount in edit form
            const amountInput = document.getElementById('editAmount');
            if (amountInput) {
                amountInput.value = currencyUtils.formatCurrency(total.toString());
            }
        } else {
            // Update add mode display
            this.updateSelectedExpensesDisplay();
            
            const amountInput = document.getElementById('fabIncomeAmount');
            if (amountInput) {
                amountInput.value = currencyUtils.formatCurrency(total.toString());
            }
        }
        
        document.getElementById('expenseSelectorModal').classList.remove('active');
    }

    updateSelectedExpensesDisplay() {
        const textElement = document.getElementById('fabSelectedExpensesText');
        if (!textElement) return;
        
        const count = this.selectedExpensesForReimbursement.length;
        if (count === 0) {
            textElement.innerHTML = 'Select Expenses to Reimburse';
        } else {
            const expenses = this.state.getExpenses();
            const selectedExpenses = expenses.filter(e => 
                this.selectedExpensesForReimbursement.includes(e.id)
            );
            const total = selectedExpenses.reduce((sum, e) => sum + e.amount, 0);
            
            textElement.innerHTML = `${count} expense${count > 1 ? 's' : ''} selected (${currencyUtils.formatDisplayCurrency(total)})`;
        }
    }

    async handleUnlinkReimbursement(incomeId) {
        const modal = document.getElementById('unlinkReimbursementModal');
        
        // Store the income ID for the confirm button
        window.finTrack.pendingUnlinkIncomeId = incomeId;
        
        modal.classList.add('active');
    }

    async confirmUnlinkReimbursement() {
        const incomeId = window.finTrack.pendingUnlinkIncomeId;
        if (!incomeId) return;
        
        try {
            await this.db.unlinkReimbursement(incomeId);
            this.state.unlinkReimbursement(incomeId);
            this.showAlert('Reimbursement unlinked', 'success');

            this.ui.updateAllUI();
            
            // Force update reimbursement view if it's currently active
            if (this.ui) {
                this.ui.updateReimbursementView();
            }
            
            // Close modal
            document.getElementById('unlinkReimbursementModal').classList.remove('active');
            window.finTrack.pendingUnlinkIncomeId = null;
        } catch (error) {
            console.error('Error unlinking reimbursement:', error);
            this.showAlert('Error unlinking reimbursement', 'error');
        }
    }

    viewReceipt(expenseId, expenseName, receiptUrl) {
        const modal = document.getElementById('receiptViewerModal');
        const content = document.getElementById('receiptViewerContent');
        const nameElement = document.getElementById('receiptExpenseName');
        const downloadBtn = document.getElementById('receiptDownloadBtn');
        
        if (!modal || !content) {
            console.error('Receipt viewer modal not found');
            return;
        }
        
        // ✅ Use expenseId to get full expense details from state
        const expense = this.state.getExpenses().find(e => e.id === expenseId);
        
        if (!expense) {
            console.error('Expense not found:', expenseId);
            this.showAlert('Expense not found', 'error');
            return;
        }
        
        // ✅ Use the actual receiptUrl from the expense object if available
        const actualReceiptUrl = receiptUrl || expense.receiptUrl;
        
        if (!actualReceiptUrl) {
            this.showAlert('No receipt available for this expense', 'warning');
            return;
        }
        
        // Set expense name with more details
        if (nameElement) {
            const expenseDate = new Date(expense.date).toLocaleDateString();
            nameElement.textContent = `${expenseName} - ${expenseDate}`;
        }
        
        // Set download link with proper filename
        if (downloadBtn) {
            downloadBtn.href = actualReceiptUrl;
            const fileExt = actualReceiptUrl.split('.').pop().split('?')[0]; // Handle query params
            const sanitizedName = expenseName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const fileName = `receipt_${sanitizedName}_${expenseId.substring(0, 8)}.${fileExt}`;
            downloadBtn.download = fileName;
        }
        
        // Show loading state
        content.innerHTML = `
            <div class="receipt-loading">
                <i class="fas fa-spinner"></i>
                <p>Loading receipt...</p>
            </div>
        `;
        
        // Open modal
        modal.classList.add('active');
        
        // Load receipt content
        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(actualReceiptUrl);
        const isPDF = /\.pdf$/i.test(actualReceiptUrl);
        
        setTimeout(() => {
            if (isImage) {
                const img = new Image();
                img.onload = () => {
                    content.innerHTML = `
                        <div style="padding: 1rem; max-width: 100%;">
                            <img src="${actualReceiptUrl}" 
                                alt="Receipt for ${expenseName}" 
                                style="max-width: 100%; height: auto; display: block; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                        </div>
                    `;
                };
                img.onerror = () => {
                    content.innerHTML = `
                        <div class="receipt-error">
                            <i class="fas fa-exclamation-triangle"></i>
                            <p>Failed to load receipt image</p>
                            <p style="font-size: 0.85rem; color: var(--gray);">The image may have been deleted or is no longer available.</p>
                            <a href="${actualReceiptUrl}" target="_blank" class="btn btn-primary">
                                <i class="fas fa-external-link-alt"></i> Try opening in new tab
                            </a>
                        </div>
                    `;
                };
                img.src = actualReceiptUrl;
            } else if (isPDF) {
                content.innerHTML = `
                    <div style="width: 100%; height: 100%;">
                        <iframe src="${actualReceiptUrl}" 
                                style="width: 100%; height: 70vh; border: none; border-radius: 8px;"
                                title="Receipt PDF for ${expenseName}">
                        </iframe>
                        <div style="text-align: center; padding: 1rem; color: var(--gray); font-size: 0.9rem;">
                            <i class="fas fa-info-circle"></i> If the PDF doesn't display, 
                            <a href="${actualReceiptUrl}" target="_blank" style="color: var(--primary);">open it in a new tab</a>
                        </div>
                    </div>
                `;
            } else {
                content.innerHTML = `
                    <div class="receipt-error">
                        <i class="fas fa-file"></i>
                        <p>Preview not available for this file type</p>
                        <p style="font-size: 0.85rem; color: var(--gray);">File extension: ${actualReceiptUrl.split('.').pop()}</p>
                        <a href="${actualReceiptUrl}" target="_blank" class="btn btn-primary">
                            <i class="fas fa-download"></i> Download Receipt
                        </a>
                    </div>
                `;
            }
        }, 300);
    }

    showReimbursementDetails(expenseId) {
        const linkedIncome = this.state.getLinkedIncomeForExpense(expenseId);
        if (!linkedIncome) return;
        
        const modal = document.getElementById('reimbursementDetailsModal');
        const content = document.getElementById('reimbursementDetailsContent');
        
        content.innerHTML = `
            <div style="background: linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%); padding: 1rem; border-radius: 12px; margin-bottom: 1rem; border: 2px solid #10B981;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="color: #065F46; font-weight: 600;">Description:</span>
                    <span style="color: #047857; font-weight: 700;">${linkedIncome.description}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="color: #065F46; font-weight: 600;">Amount:</span>
                    <span style="color: #047857; font-weight: 700; font-size: 1.1rem;">${currencyUtils.formatDisplayCurrency(linkedIncome.amount)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="color: #065F46; font-weight: 600;">Source:</span>
                    <span style="color: #047857; font-weight: 700;">${linkedIncome.source}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #065F46; font-weight: 600;">Date:</span>
                    <span style="color: #047857; font-weight: 700;">${new Date(linkedIncome.date).toLocaleDateString()}</span>
                </div>
            </div>
            <button class="btn btn-primary" onclick="document.getElementById('reimbursementDetailsModal').classList.remove('active')" style="width: 100%;">
                <i class="fas fa-check"></i> Got it
            </button>
        `;
        
        modal.classList.add('active');
    }    
    
async checkInitialAuthState() {
    const authState = await this.auth.checkAuth();
    
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
    
    //v5.2    
    async handleAddExpense(e) {
        const form = e.target;
        const id = document.getElementById('expenseId').value;
        const description = document.getElementById('expenseDescription').value;
        const amount = currencyUtils.parseCurrency(document.getElementById('expenseAmount').value);
        const date = document.getElementById('expenseDate').value;
        const category = document.getElementById('expenseCategory').value;
        const subcategory = document.getElementById('expenseSubcategory').value;
        const isReimbursable = document.getElementById('expenseIsReimbursable')?.checked || false;
        const walletId = this.state.getState().currentWalletId;

        if (!walletId) {
            this.showAlert('Select a wallet first', 'error');
            return;
        }
        
        if (amount <= 0) {
            this.showAlert('Enter a valid amount', 'error');
            return;
        }
        
        // Check budget only if NOT reimbursable
        if (!isReimbursable) {
            const budgetStatus = this.checkBudgetBeforeExpense(category, amount);
            
            if (budgetStatus) {
          
                if (budgetStatus.willExceed) {
                    const confirmed = confirm(
                        `This expense will exceed your ${category} budget!\n\n` +
                        `Budget: ${currencyUtils.formatDisplayCurrency(budgetStatus.budget)}\n` +
                        `Already spent: ${currencyUtils.formatDisplayCurrency(budgetStatus.spent)}\n` +
                        `This expense: ${currencyUtils.formatDisplayCurrency(amount)}\n` +
                        `Total: ${currencyUtils.formatDisplayCurrency(budgetStatus.spent + amount)}\n\n` +
                        `Continue anyway?`
                    );
                    
                    if (!confirmed) {
                        return;
                    }
                } else {
                }
            } else {
            }
        } else {
        }
        
        try {
            const expenseData = { 
                id, description, amount, date, category, subcategory, 
                walletId, isReimbursable 
            };
            
            const savedExpense = await this.db.createExpense(expenseData);
            
            if (id) {
                this.state.updateExpense(savedExpense);
                this.showAlert('Expense updated', 'success');
            } else {
                this.state.addExpense(savedExpense);
                this.showAlert('Expense added', 'success');
            }
            
            this.ui.resetExpenseForm();
            this.ui.updateAllUI();
        } catch (error) {
            console.error('=== handleAddExpense ERROR ===');
            console.error('Error object:', error);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            this.showAlert('Error saving expense: ' + error.message, 'error');
        }
    }

    //v5.2
    checkBudgetBeforeExpense(categoryName, amount) {
        const categories = this.state.getCategories();
        const category = categories.find(c => c.name === categoryName);
        
        if (!category) return null;
        
        const walletId = this.state.getState().currentWalletId;
        const budgetStatus = this.state.getCategoryBudgetStatus(category.id, walletId);
        
        if (!budgetStatus) return null;
        
        const willExceed = (budgetStatus.spent + amount) > budgetStatus.budget;
        
        return {
            ...budgetStatus,
            willExceed
        };
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
                //v5.2    
                case 'budget':
                    success = await this.db.deleteBudget(id);
                    if (success) this.state.deleteBudget(id);
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
        this.setupExpenseSubTabs();

        initializeSidebar(this.state);
    }
    
    setupStateListeners() {
        // Listen for state changes and update UI
        this.state.subscribe('expenses', () => {
            this.updateExpensesUI();
            this.updateOverviewUI();
            this.updateStats();
            this.updateBudgetsUI();
            this.updateCompactBudgetView(); // ADD THIS
        });
        this.state.subscribe('incomes', () => {
            this.updateIncomesUI();
            this.updateOverviewUI();
            this.updateStats();
        });
        this.state.subscribe('wallets', () => {
            this.updateWalletsUI();
            this.updateStats();
        });
        this.state.subscribe('categories', () => {
            this.updateCategoriesUI();
            this.updateBudgetTabUI(); // ADD THIS
        });

        this.state.subscribe('budgets', () => {
            this.updateBudgetsUI();
            this.updateCompactBudgetView(); // ADD THIS
            this.updateBudgetTabUI(); // ADD THIS
        });

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

    loadEditParentCategories() {
        const parentCategory = document.getElementById('editParentCategory');
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
            const tabId = tab.getAttribute('data-tab');
            
            tab.addEventListener('click', () => {
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
            const contentId = content.id;
            const shouldBeActive = contentId === `${activeTab}Tab`;
            
            if (shouldBeActive) {
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
            case 'overview':
                this.updateOverviewUI();
                this.updateCompactBudgetView(); // NEW: Compact view for overview
                break;
            case 'expenses':
                const monthSelect = document.getElementById('expenseMonthSelect');
                const yearSelect = document.getElementById('expenseYearSelect');
                this.updateExpensesTabUI();
                this.switchExpenseSubTab('all');
                break;
            case 'income':
                this.updateIncomesTabUI();
                break;
            case 'budget':
                this.updateBudgetTabUI(); // NEW: Full budget management view
                break;
            case 'more':
                this.updateWalletsUI();
                this.updateCategoriesUI();
                break;
        }
    }

    updateCompactBudgetView() {
        const container = document.getElementById('budgetOverviewList');
        if (!container) return;
        
        const walletId = this.state.getState().currentWalletId;
        const categories = this.state.getMainCategories();
        const budgets = this.state.getBudgets();
        
        if (!walletId || categories.length === 0) {
            container.innerHTML = `
                <div class="budget-overview-item">
                    <div class="budget-details">No categories yet</div>
                </div>
            `;
            return;
        }
        
        // Filter categories that have budgets set
        const categoriesWithBudgets = categories.filter(cat => {
            return budgets.some(b => b.category_id === cat.id && b.wallet_id === walletId);
        });
        
        if (categoriesWithBudgets.length === 0) {
            container.innerHTML = `
                <div class="budget-overview-item">
                    <div class="budget-details" style="text-align: center; color: var(--gray);">
                        <i class="fas fa-chart-line"></i> No budgets set yet
                    </div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = '';
        
        categoriesWithBudgets.forEach(category => {
            const status = this.state.getCategoryBudgetStatus(category.id, walletId);
            if (!status) return;
            
            const progressColor = status.status === 'exceeded' ? '#EF4444' : 
                                status.status === 'warning' ? '#F59E0B' : '#10B981';
            
            const item = document.createElement('div');
            item.className = 'budget-overview-item';
            item.innerHTML = `
                <div class="budget-overview-category">${category.name}</div>
                <div class="budget-overview-bar-container">
                    <div class="budget-overview-bar">
                        <div class="budget-overview-bar-fill" style="width: ${Math.min(status.percentage, 100)}%; background: ${progressColor};"></div>
                    </div>
                    <div class="budget-overview-text">
                        <span style="color: ${progressColor}; font-weight: 600;">${Math.round(status.percentage)}%</span>
                        <span>${currencyUtils.formatDisplayCurrency(status.spent)} / ${currencyUtils.formatDisplayCurrency(status.budget)}</span>
                    </div>
                </div>
            `;
            
            container.appendChild(item);
        });
    }

    // 3. Add new method for full budget management tab
    updateBudgetTabUI() {
        const container = document.getElementById('budgetCategoriesList');
        if (!container) return;
        
        const walletId = this.state.getState().currentWalletId;
        const categories = this.state.getMainCategories();
        const budgets = this.state.getBudgets();
        
        if (!walletId) {
            container.innerHTML = `
                <div class="budget-item">
                    <div class="budget-details">Select a wallet first</div>
                </div>
            `;
            return;
        }
        
        if (categories.length === 0) {
            container.innerHTML = `
                <div class="budget-item">
                    <div class="budget-details">No categories yet. Add categories first.</div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = '';
        
        categories.forEach(category => {
            const budget = budgets.find(b => b.category_id === category.id && b.wallet_id === walletId);
            const status = budget ? this.state.getCategoryBudgetStatus(category.id, walletId) : null;
            
            const item = document.createElement('div');
            item.className = 'budget-category-item';
            
            if (budget && status) {
                const progressColor = status.status === 'exceeded' ? '#EF4444' : 
                                    status.status === 'warning' ? '#F59E0B' : '#10B981';
                
                item.innerHTML = `
                    <div class="budget-category-header">
                        <div class="budget-category-name">${category.name}</div>
                        <div class="action-buttons">
                            <button class="edit-btn" onclick="window.finTrack.ui.editBudget('${budget.id}', '${category.id}', ${budget.amount})">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="delete-btn" onclick="window.finTrack.ui.confirmDelete('budget', '${budget.id}', '${category.name}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="budget-status-bar">
                        <div class="budget-status-fill budget-status-${status.status}" 
                            style="width: ${Math.min(status.percentage, 100)}%; background: ${progressColor};"></div>
                    </div>
                    <div class="budget-info" style="font-size: 0.7rem;">
                        <span class="budget-info-spent" style="color: ${progressColor};">
                            Spent: ${currencyUtils.formatDisplayCurrency(status.spent)} (${Math.round(status.percentage)}%)
                        </span>
                        <span class="budget-info-limit">
                            Limit: ${currencyUtils.formatDisplayCurrency(status.budget)}
                        </span>
                    </div>
                    <div style="margin-top: 0.5rem; font-size: 0.8rem; color: ${status.remaining >= 0 ? 'var(--success)' : 'var(--danger)'};">
                        ${status.remaining >= 0 
                            ? `✓ ${currencyUtils.formatDisplayCurrency(status.remaining)} remaining` 
                            : `⚠ Over by ${currencyUtils.formatDisplayCurrency(Math.abs(status.remaining))}`}
                    </div>
                `;
            } else {
                // No budget set for this category
                item.innerHTML = `
                    <div class="budget-category-header">
                        <div class="budget-category-name">${category.name}</div>
                        <div class="budget-category-actions">
                            <button class="btn btn-sm btn-primary" onclick="window.finTrack.ui.setBudgetForCategory('${category.id}')"
                                    style="padding: 6px 12px; font-size: 0.8rem;">
                                <i class="fas fa-plus"></i> Set Budget
                            </button>
                        </div>
                    </div>
                    <div class="budget-not-set">
                        <i class="fas fa-info-circle"></i> No budget limit set
                    </div>
                `;
            }
            
            container.appendChild(item);
        });
    }

    // 4. Add helper method to set budget for specific category
    setBudgetForCategory(categoryId) {
        const modal = document.getElementById('budgetModal');
        const categorySelect = document.getElementById('budgetCategory');
        
        // Populate categories
        categorySelect.innerHTML = '<option value="">Select category</option>';
        const mainCategories = this.state.getMainCategories();
        
        mainCategories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            if (category.id === categoryId) {
                option.selected = true;
            }
            categorySelect.appendChild(option);
        });
        
        // Clear amount and show modal
        document.getElementById('budgetAmount').value = '';
        document.getElementById('budgetId').value = '';
        
        modal.classList.add('active');
    }

    // 5. Add method to edit existing budget
    editBudget(budgetId, categoryId, currentAmount) {
        const modal = document.getElementById('budgetModal');
        const categorySelect = document.getElementById('budgetCategory');
        const amountInput = document.getElementById('budgetAmount');
        const budgetIdInput = document.getElementById('budgetId');
        
        // Populate categories
        categorySelect.innerHTML = '<option value="">Select category</option>';
        const mainCategories = this.state.getMainCategories();
        
        mainCategories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            if (category.id === categoryId) {
                option.selected = true;
            }
            categorySelect.appendChild(option);
        });
        
        // Set current values
        budgetIdInput.value = budgetId;
        amountInput.value = currencyUtils.formatCurrency(currentAmount.toString());
        
        modal.classList.add('active');
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
        } else if (wallets.length > 0) {
            // Fallback to first wallet
            const firstWalletId = wallets[0].id;
            this.state.setCurrentWallet(firstWalletId);
            selector.value = firstWalletId;
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
        this.updateOverviewUI();
        this.updateExpensesTabUI();
        this.updateIncomesTabUI();
        this.updateStats();
        this.updateCompactBudgetView();
        this.updateBudgetTabUI();
    }

    syncWalletSelector() {
        const selector = document.getElementById('globalWalletSelect');
        if (!selector) return;
        
        const currentWalletId = this.state.getState().currentWalletId;
        if (currentWalletId && selector.value !== currentWalletId) {
            selector.value = currentWalletId;
        }
    }    
    
    // ==================== EXPENSE UI ====================
    
    updateExpensesUI() {
        this.updateExpensesTabUI();
        this.updateOverviewUI();
    }

    updateOverviewUI() {
        const recentActivityList = document.getElementById('recentActivityList');
        if (!recentActivityList) return;
        
        const currentWalletId = this.state.getState().currentWalletId;
        
        if (!currentWalletId) {
            recentActivityList.innerHTML = `
                <div class="expense-item">
                    <div class="expense-details">Select a wallet first</div>
                </div>
            `;
            return;
        }
        
        // Get all transactions (expenses + income) and sort by date
        const expenses = this.state.getExpenses()
            .filter(e => e.walletId === currentWalletId)
            .map(e => ({ ...e, type: 'expense' }));
        
        const incomes = this.state.getIncomes()
            .filter(i => i.walletId === currentWalletId)
            .map(i => ({ ...i, type: 'income' }));
        
        const allTransactions = [...expenses, ...incomes]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 10); // Last 10 transactions
        
        if (allTransactions.length === 0) {
            recentActivityList.innerHTML = `
                <div class="empty-day-message">
                    <i class="fas fa-receipt"></i>
                    No transactions yet. Tap <strong>+</strong> to add your first transaction.
                </div>
            `;
            return;
        }
        
        this.renderRecentActivity(allTransactions, recentActivityList);
    }

    renderRecentActivity(transactions, container) {
        const wallets = this.state.getWallets();
        container.innerHTML = '';
        
        // Group by day
        const groupedByDay = this.groupTransactionsByDay(transactions);
        
        groupedByDay.forEach((dayGroup, index) => {
            const dayGroupDiv = document.createElement('div');
            dayGroupDiv.className = 'day-group';
            
            // Calculate daily totals for expenses and income
            const dayExpenses = dayGroup.transactions
                .filter(t => t.type === 'expense')
                .reduce((sum, t) => sum + t.amount, 0);
            
            const dayIncome = dayGroup.transactions
                .filter(t => t.type === 'income')
                .reduce((sum, t) => sum + t.amount, 0);
            
            const dayTotal = dayIncome - dayExpenses;
            
            // Day header with toggle and totals
            const dayHeader = document.createElement('div');
            dayHeader.className = 'day-header';
            dayHeader.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-calendar"></i>
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                        <span class="day-header-text" style="font-weight: 600; font-size: 0.9rem;">${dayGroup.label}</span>
                        ${dayGroup.weekday ? `<span style="font-size: 0.75rem; color: var(--gray); opacity: 0.8;">${dayGroup.weekday}</span>` : ''}
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px; margin-left: auto; margin-right: 8px;">
                    ${dayIncome > 0 ? `<span style="color: var(--success); font-size: 0.8rem; font-weight: 600;">+${currencyUtils.formatDisplayCurrency(dayIncome)}</span>` : ''}
                    ${dayExpenses > 0 ? `<span style="color: var(--danger); font-size: 0.8rem; font-weight: 600;">-${currencyUtils.formatDisplayCurrency(dayExpenses)}</span>` : ''}
                </div>
                <i class="fas fa-chevron-down toggle-icon"></i>
            `;
            
            // Create content container
            const dayContent = document.createElement('div');
            dayContent.className = 'day-content';
            
            // Toggle functionality
            dayHeader.addEventListener('click', () => {
                const isExpanded = dayHeader.classList.contains('expanded');
                if (isExpanded) {
                    dayHeader.classList.remove('expanded');
                    dayContent.classList.remove('expanded');
                } else {
                    dayHeader.classList.add('expanded');
                    dayContent.classList.add('expanded');
                }
            });
            
            dayGroupDiv.appendChild(dayHeader);
            
            // Transactions for this day
            dayGroup.transactions.forEach(transaction => {
                const wallet = wallets.find(w => w.id === transaction.walletId);
                
                const item = document.createElement('div');
                item.className = transaction.type === 'expense' ? 'expense-item' : 'income-item';
                
                if (transaction.type === 'expense') {
                    let categoryText = transaction.category;
                    if (transaction.subcategory) {
                        categoryText += ` › ${transaction.subcategory}`;
                    }

                    let receiptIcon = '';
                    const receiptUrl = transaction.receiptUrl || transaction.receipt_url;
                    if (receiptUrl) {
                        receiptIcon = `<button class="receipt-icon-btn" onclick="window.finTrack.app.viewReceipt('${transaction.id}', '${transaction.description.replace(/'/g, "\\'")}', '${transaction.receiptUrl}')" title="View receipt">
                            <i class="fas fa-paperclip"></i>
                        </button>`;
                    }                    
                    
                    // Generate reimbursement badge
                    let reimbursementBadge = '';
                    if (transaction.isReimbursable) {
                        if (transaction.reimbursementStatus === 'pending') {
                            reimbursementBadge = '<span class="reimbursement-badge pending" title="Pending reimbursement"><i class="fas fa-clock"></i></span>';
                        } else if (transaction.reimbursementStatus === 'reimbursed') {
                            reimbursementBadge = `<span class="reimbursement-badge reimbursed clickable" onclick="window.finTrack.app.showReimbursementDetails('${transaction.id}')" title="Reimbursed - Click for details"><i class="fas fa-check-circle"></i></span>`;
                        }
                    }
                    
                    item.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
                            <div style="flex: 1; min-width: 0; margin-right: 12px;">
                                <div style="font-weight: 500; word-break: break-word; font-size: 0.8rem;">
                                    ${transaction.description}
                                    ${reimbursementBadge}
                                    ${receiptIcon}                                    
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                                <span class="expense-category" style="font-size: 0.6rem; background: var(--light-gray); padding: 2px 8px; border-radius: 12px; color: var(--gray); white-space: nowrap;">
                                    ${categoryText}
                                </span>
                            </div>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                            <div class="expense-amount">
                                ${currencyUtils.formatDisplayCurrency(transaction.amount)}
                            </div>
                            <div class="action-buttons">
                                <button class="edit-btn" onclick="window.finTrack.ui.editExpense('${transaction.id}')">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="delete-btn" onclick="window.finTrack.ui.confirmDelete('expense', '${transaction.id}', '${transaction.description}')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    `;
                } else {
                    // Add reimbursement badge for income
                    let reimbursementBadge = '';
                    if (transaction.isReimbursement) {
                        const linkedExpenses = this.state.getLinkedExpensesForIncome(transaction.id);
                        const count = linkedExpenses.length;
                        reimbursementBadge = `<span class="reimbursement-badge is-reimbursement" title="${count} linked expense${count !== 1 ? 's' : ''}"><i class="fas fa-link"></i></span>`;
                    }
                    
                    item.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
                            <div style="flex: 1; min-width: 0; margin-right: 12px;">
                                <div style="font-weight: 500; word-break: break-word; font-size: 0.8rem;">
                                    ${transaction.description}
                                    ${reimbursementBadge}
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                                <span class="income-source" style="font-size: 0.6rem; background: var(--light-gray); padding: 2px 8px; border-radius: 12px; color: var(--gray); white-space: nowrap;">
                                    ${transaction.source}
                                </span>
                            </div>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-top: 8px;">
                            <div class="income-amount">
                                ${currencyUtils.formatDisplayCurrency(transaction.amount)}
                            </div>
                            <div class="action-buttons">
                                ${transaction.isReimbursement ? `
                                    <button class="unlink-reimbursement-btn" onclick="window.finTrack.app.handleUnlinkReimbursement('${transaction.id}')">
                                        <i class="fas fa-unlink"></i>
                                    </button>
                                ` : ''}
                                <button class="edit-btn" onclick="window.finTrack.ui.editIncome('${transaction.id}')">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="delete-btn" onclick="window.finTrack.ui.confirmDelete('income', '${transaction.id}', '${transaction.description}')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    `;
                }
                
                dayContent.appendChild(item);
            });
            
            // Day total footer with net amount
            const dayTotalDiv = document.createElement('div');
            dayTotalDiv.className = 'day-total';
            const netColor = dayTotal >= 0 ? 'var(--success)' : 'var(--danger)';
            const netSign = dayTotal >= 0 ? '+' : '';
            dayTotalDiv.innerHTML = `
                Net: <span class="day-total-amount" style="color: ${netColor};">${netSign}${currencyUtils.formatDisplayCurrency(Math.abs(dayTotal))}</span>
            `;
            dayContent.appendChild(dayTotalDiv);
            
            dayGroupDiv.appendChild(dayContent);
            container.appendChild(dayGroupDiv);
        });
    }

    updateExpensesTabUI() {
        const monthSelect = document.getElementById('expenseMonthSelect');
        const yearSelect = document.getElementById('expenseYearSelect');
        
        // Check if elements exist
        if (!monthSelect || !yearSelect) {
            console.error('Expense filter elements not found!');
            return;
        }
        
        this.initializeExpenseFilters();
    }

    initializeExpenseFilters() {
        const monthSelect = document.getElementById('expenseMonthSelect');
        const yearSelect = document.getElementById('expenseYearSelect');
        
        if (!monthSelect || !yearSelect) {
            console.error('Month or year select not found');
            return;
        }
        
        // Check if already initialized
        const isInitialized = monthSelect.options.length > 0 && yearSelect.options.length > 0;
        
        if (isInitialized) {
            this.updateExpensesByDay();
            return;
        }
        
        // Get unique years from expenses
        const expenses = this.state.getExpenses();
        const years = [...new Set(expenses.map(e => new Date(e.date).getFullYear()))];
        
        if (years.length === 0) {
            years.push(new Date().getFullYear());
        }
        
        years.sort((a, b) => b - a);
        
        // Clear existing options
        monthSelect.innerHTML = '';
        yearSelect.innerHTML = '';
        
        // Populate month dropdown
        const monthNames = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"];
        
        monthNames.forEach((month, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = month;
            monthSelect.appendChild(option);
        });
        
        // Populate year dropdown
        years.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
        });
        
        // Set current month/year
        const now = new Date();
        monthSelect.value = now.getMonth();
        yearSelect.value = now.getFullYear();
        monthSelect.addEventListener('change', () => {
            this.updateExpensesByDay();
        });
        yearSelect.addEventListener('change', () => {
            this.updateExpensesByDay();
        });
        
        this.updateExpensesByDay();
    }

    updateExpensesByDay() {
        const monthSelect = document.getElementById('expenseMonthSelect');
        const yearSelect = document.getElementById('expenseYearSelect');
        const listContainer = document.getElementById('expensesByDayList');
        const totalElement = document.getElementById('expenseMonthlyTotal');
        const monthYearLabel = document.getElementById('expenseSelectedMonthYear');
                
        if (!monthSelect || !yearSelect || !listContainer) {
            console.error('Missing required elements for updateExpensesByDay');
            return;
        }
        
        const selectedMonth = parseInt(monthSelect.value);
        const selectedYear = parseInt(yearSelect.value);
        const currentWalletId = this.state.getState().currentWalletId;
        
        if (!currentWalletId) {
            listContainer.innerHTML = `
                <div class="expense-item">
                    <div class="expense-details">Select a wallet first</div>
                </div>
            `;
            if (totalElement) totalElement.textContent = currencyUtils.formatDisplayCurrency(0);
            if (monthYearLabel) monthYearLabel.textContent = 'Select a wallet';
            return;
        }
        
        // Filter expenses
        const expenses = this.state.getExpenses().filter(expense => {
            if (expense.walletId !== currentWalletId) return false;
            const expenseDate = new Date(expense.date);
            return expenseDate.getMonth() === selectedMonth && 
                   expenseDate.getFullYear() === selectedYear;
        });
        
        // Update total
        const monthlyTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
        if (totalElement) {
            totalElement.textContent = currencyUtils.formatDisplayCurrency(monthlyTotal);
        }
        
        // Update month/year label
        if (monthYearLabel) {
            const monthName = dateUtils.getMonthName(selectedMonth);
            monthYearLabel.textContent = `${monthName} ${selectedYear}`;
        }
        
        // Render expenses grouped by day
        if (expenses.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-day-message">
                    <i class="fas fa-receipt"></i>
                    No expenses for this period
                </div>
            `;
            return;
        }
        this.renderExpensesByDay(expenses, listContainer);
    }

    renderExpensesByDay(expenses, container) {
        const wallets = this.state.getWallets();
        const sortedExpenses = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Group by day
        const groupedByDay = this.groupTransactionsByDay(sortedExpenses);
        
        container.innerHTML = '';
        
        groupedByDay.forEach((dayGroup, index) => {
            const dayGroupDiv = document.createElement('div');
            dayGroupDiv.className = 'day-group';
            
            // Day header with toggle
            const dayHeader = document.createElement('div');
            dayHeader.className = 'day-header';
            const dayTotal = dayGroup.transactions.reduce((sum, t) => sum + t.amount, 0);
            dayHeader.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-calendar"></i>
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                        <span class="day-header-text" style="font-weight: 600; font-size: 0.9rem;">${dayGroup.label}</span>
                        ${dayGroup.weekday ? `<span style="font-size: 0.75rem; color: var(--gray); opacity: 0.8;">${dayGroup.weekday}</span>` : ''}
                    </div>
                </div>
                <span style="color: var(--danger); font-size: 0.85rem; font-weight: 600; margin-left: auto; margin-right: 8px;">
                    ${currencyUtils.formatDisplayCurrency(dayTotal)}
                </span>
                <i class="fas fa-chevron-down toggle-icon"></i>
            `;
            
            // Create content container
            const dayContent = document.createElement('div');
            dayContent.className = 'day-content';
            
            // Toggle functionality
            dayHeader.addEventListener('click', () => {
                const isExpanded = dayHeader.classList.contains('expanded');
                if (isExpanded) {
                    dayHeader.classList.remove('expanded');
                    dayContent.classList.remove('expanded');
                } else {
                    dayHeader.classList.add('expanded');
                    dayContent.classList.add('expanded');
                }
            });
            
            dayGroupDiv.appendChild(dayHeader);
            
            dayGroup.transactions.forEach(expense => {
                const expenseDate = new Date(expense.date);
                const time = expenseDate.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
                
                let categoryText = expense.category;
                if (expense.subcategory) {
                    categoryText += ` > ${expense.subcategory}`;
                }

                let receiptIcon = '';
                const receiptUrl = expense.receiptUrl || expense.receipt_url;
                if (receiptUrl) {
                    receiptIcon = `<button class="receipt-icon-btn" onclick="window.finTrack.app.viewReceipt('${expense.id}', '${expense.description.replace(/'/g, "\\'")}', '${expense.receiptUrl}')" title="View receipt">
                        <i class="fas fa-paperclip"></i>
                    </button>`;
                }                
                
                // Generate reimbursement badge
                let reimbursementBadge = '';
                if (expense.isReimbursable) {
                    if (expense.reimbursementStatus === 'pending') {
                        reimbursementBadge = '<span class="reimbursement-badge pending" title="Pending reimbursement"><i class="fas fa-clock"></i></span>';
                    } else if (expense.reimbursementStatus === 'reimbursed') {
                        reimbursementBadge = `<span class="reimbursement-badge reimbursed clickable" onclick="window.finTrack.app.showReimbursementDetails('${expense.id}')" title="Reimbursed - Click for details"><i class="fas fa-check-circle"></i></span>`;
                    }
                }
                
                const item = document.createElement('div');
                item.className = 'expense-item';
                item.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
                        <div style="flex: 1; min-width: 0; margin-right: 12px;">
                            <div style="font-weight: 500; word-break: break-word; font-size: 0.8rem;">
                                ${expense.description}
                                ${receiptIcon}
                                ${reimbursementBadge}
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                            <span class="expense-category" style="font-size: 0.6rem; background: var(--light-gray); padding: 2px 8px; border-radius: 12px; color: var(--gray); white-space: nowrap;">
                                ${categoryText}
                            </span>
                        </div>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-top: 8px;">
                        <div class="expense-amount" style="font-weight: 600; color: var(--primary);">
                            ${currencyUtils.formatDisplayCurrency(expense.amount)}
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
                dayContent.appendChild(item);
            });
            
            // Day total footer
            const dayTotalDiv = document.createElement('div');
            dayTotalDiv.className = 'day-total';
            dayTotalDiv.innerHTML = `Total: <span class="day-total-amount">${currencyUtils.formatDisplayCurrency(dayTotal)}</span>`;
            dayContent.appendChild(dayTotalDiv);
            
            dayGroupDiv.appendChild(dayContent);
            container.appendChild(dayGroupDiv);
        });
    }

    // Helper method to group transactions by day
    groupTransactionsByDay(transactions) {
        const groups = {};
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        transactions.forEach(transaction => {
            const transactionDate = new Date(transaction.date);
            const dateKey = transactionDate.toISOString().split('T')[0];
            
            if (!groups[dateKey]) {
                groups[dateKey] = {
                    date: transactionDate,
                    dateKey: dateKey,
                    transactions: []
                };
            }
            
            groups[dateKey].transactions.push(transaction);
        });
        
        // Convert to array and add labels
        return Object.values(groups)
            .sort((a, b) => b.date - a.date)
            .map(group => {
                const groupDate = new Date(group.date.getFullYear(), group.date.getMonth(), group.date.getDate());
                let label;
                let weekday = null;
                
                if (groupDate.getTime() === today.getTime()) {
                    label = 'Today';
                } else if (groupDate.getTime() === yesterday.getTime()) {
                    label = 'Yesterday';
                } else {
                    // Format: Dec 17, 2025
                    label = group.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    // Add weekday separately
                    weekday = group.date.toLocaleDateString('en-US', { weekday: 'long' });
                }
                
                return {
                    ...group,
                    label,
                    weekday
                };
            });
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
            const expenseDate = new Date(expense.date);
            const time = expenseDate.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            let categoryText = expense.category;
            if (expense.subcategory) {
                categoryText += ` > ${expense.subcategory}`;
            }
            
            const expenseItem = document.createElement('div');
            expenseItem.className = 'expense-item';
            
            // Match recent activity format
            expenseItem.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
                    <div style="flex: 1; min-width: 0; margin-right: 12px;">
                        <div style="font-weight: 500; word-break: break-word; font-size: 0.8rem;">
                            ${expense.description}
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                        <span class="expense-category" style="font-size: 0.6rem; background: var(--light-gray); padding: 2px 8px; border-radius: 12px; color: var(--gray); white-space: nowrap;">
                            ${categoryText}
                        </span>
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-top: 8px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div class="expense-amount" style="font-weight: 600; color: var(--primary);">
                            ${currencyUtils.formatDisplayCurrency(expense.amount)}
                        </div>
                        <div style="font-size: 0.75rem; color: var(--gray);">
                            ${time} • ${expenseDate.toLocaleDateString()}
                        </div>
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
        this.updateIncomesTabUI();
        this.updateOverviewUI();
    }

    updateIncomesTabUI() {
        this.initializeIncomeFilters();
        this.updateIncomesByDay();
    }

    initializeIncomeFilters() {
        const monthSelect = document.getElementById('incomeMonthSelect');
        const yearSelect = document.getElementById('incomeYearSelect');
        
        if (!monthSelect || !yearSelect) return;
        
        // Only initialize once
        if (monthSelect.options.length > 0) {
            this.updateIncomesByDay();
            return;
        }
        
        // Get unique years from incomes
        const incomes = this.state.getIncomes();
        const years = [...new Set(incomes.map(i => new Date(i.date).getFullYear()))];
        
        if (years.length === 0) {
            years.push(new Date().getFullYear());
        }
        
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
        
        // Add change listeners
        monthSelect.addEventListener('change', () => this.updateIncomesByDay());
        yearSelect.addEventListener('change', () => this.updateIncomesByDay());
        
        this.updateIncomesByDay();
    }

    updateIncomesByDay() {
        const monthSelect = document.getElementById('incomeMonthSelect');
        const yearSelect = document.getElementById('incomeYearSelect');
        const listContainer = document.getElementById('incomesByDayList');
        const totalElement = document.getElementById('incomeMonthlyTotal');
        const monthYearLabel = document.getElementById('incomeSelectedMonthYear');
        
        if (!monthSelect || !yearSelect || !listContainer) return;
        
        const selectedMonth = parseInt(monthSelect.value);
        const selectedYear = parseInt(yearSelect.value);
        const currentWalletId = this.state.getState().currentWalletId;
        
        if (!currentWalletId) {
            listContainer.innerHTML = `
                <div class="income-item">
                    <div class="income-details">Select a wallet first</div>
                </div>
            `;
            if (totalElement) totalElement.textContent = currencyUtils.formatDisplayCurrency(0);
            if (monthYearLabel) monthYearLabel.textContent = 'Select a wallet';
            return;
        }
        
        // Filter incomes
        const incomes = this.state.getIncomes().filter(income => {
            if (income.walletId !== currentWalletId) return false;
            const incomeDate = new Date(income.date);
            return incomeDate.getMonth() === selectedMonth && 
                   incomeDate.getFullYear() === selectedYear;
        });
        
        // Update total
        const monthlyTotal = incomes.reduce((sum, i) => sum + i.amount, 0);
        if (totalElement) {
            totalElement.textContent = currencyUtils.formatDisplayCurrency(monthlyTotal);
        }
        
        // Update month/year label
        if (monthYearLabel) {
            const monthName = dateUtils.getMonthName(selectedMonth);
            monthYearLabel.textContent = `${monthName} ${selectedYear}`;
        }
        
        // Render incomes grouped by day
        if (incomes.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-day-message">
                    <i class="fas fa-coins"></i>
                    No income for this period
                </div>
            `;
            return;
        }
        
        this.renderIncomesByDay(incomes, listContainer);
    }

    renderIncomesByDay(incomes, container) {
        const wallets = this.state.getWallets();
        const sortedIncomes = [...incomes].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Group by day
        const groupedByDay = this.groupTransactionsByDay(sortedIncomes);
        
        container.innerHTML = '';
        
        groupedByDay.forEach((dayGroup, index) => {
            const dayGroupDiv = document.createElement('div');
            dayGroupDiv.className = 'day-group';
            
            // Day header with toggle
            const dayHeader = document.createElement('div');
            dayHeader.className = 'day-header';
            const dayTotal = dayGroup.transactions.reduce((sum, t) => sum + t.amount, 0);
            dayHeader.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-calendar"></i>
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                        <span class="day-header-text" style="font-weight: 600; font-size: 0.9rem;">${dayGroup.label}</span>
                        ${dayGroup.weekday ? `<span style="font-size: 0.75rem; color: var(--gray); opacity: 0.8;">${dayGroup.weekday}</span>` : ''}
                    </div>
                </div>
                <span style="color: var(--success); font-size: 0.85rem; font-weight: 600; margin-left: auto; margin-right: 8px;">
                    ${currencyUtils.formatDisplayCurrency(dayTotal)}
                </span>
                <i class="fas fa-chevron-down toggle-icon"></i>
            `;
            
            // Create content container
            const dayContent = document.createElement('div');
            dayContent.className = 'day-content';
            
            // Toggle functionality
            dayHeader.addEventListener('click', () => {
                const isExpanded = dayHeader.classList.contains('expanded');
                if (isExpanded) {
                    dayHeader.classList.remove('expanded');
                    dayContent.classList.remove('expanded');
                } else {
                    dayHeader.classList.add('expanded');
                    dayContent.classList.add('expanded');
                }
            });
            
            dayGroupDiv.appendChild(dayHeader);
            
            dayGroup.transactions.forEach(income => {
                const incomeDate = new Date(income.date);
                const time = incomeDate.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
                
                // Add reimbursement badge for income
                let reimbursementBadge = '';
                if (income.isReimbursement) {
                    const linkedExpenses = this.state.getLinkedExpensesForIncome(income.id);
                    const count = linkedExpenses.length;
                    reimbursementBadge = `<span class="reimbursement-badge is-reimbursement" title="${count} linked expense${count !== 1 ? 's' : ''}"><i class="fas fa-link"></i></span>`;
                }
                
                const item = document.createElement('div');
                item.className = 'income-item';
                item.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
                        <div style="flex: 1; min-width: 0; margin-right: 12px;">
                            <div style="font-weight: 500; word-break: break-word; font-size: 0.8rem;">
                                ${income.description}
                                ${reimbursementBadge}
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                            <span class="income-source" style="font-size: 0.6rem; background: var(--light-gray); padding: 2px 8px; border-radius: 12px; color: var(--gray); white-space: nowrap;">
                                ${income.source}
                            </span>
                        </div>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-top: 8px;">
                        <div class="income-amount" style="font-weight: 600; color: var(--success);">
                            ${currencyUtils.formatDisplayCurrency(income.amount)}
                        </div>
                        <div class="action-buttons">
                            ${income.isReimbursement ? `
                                <button class="unlink-reimbursement-btn" onclick="window.finTrack.app.handleUnlinkReimbursement('${income.id}')">
                                    <i class="fas fa-unlink"></i>
                                </button>
                            ` : ''}
                            <button class="edit-btn" onclick="window.finTrack.ui.editIncome('${income.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="delete-btn" onclick="window.finTrack.ui.confirmDelete('income', '${income.id}', '${income.description}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
                dayContent.appendChild(item);
            });
            
            // Day total footer
            const dayTotalDiv = document.createElement('div');
            dayTotalDiv.className = 'day-total';
            dayTotalDiv.innerHTML = `Total: <span class="day-total-amount income">${currencyUtils.formatDisplayCurrency(dayTotal)}</span>`;
            dayContent.appendChild(dayTotalDiv);
            
            dayGroupDiv.appendChild(dayContent);
            container.appendChild(dayGroupDiv);
        });
    }
    
    renderIncomeList(incomes, container) {
        const sortedIncomes = [...incomes].sort((a, b) => new Date(b.date) - new Date(a.date));
        const wallets = this.state.getWallets();
        
        container.innerHTML = '';
        
        sortedIncomes.forEach(income => {
            const incomeDate = new Date(income.date);
            const time = incomeDate.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            const incomeItem = document.createElement('div');
            incomeItem.className = 'income-item';
            
            // Match recent activity format
            incomeItem.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
                    <div style="flex: 1; min-width: 0; margin-right: 12px;">
                        <div style="font-weight: 500; word-break: break-word; font-size: 0.8rem;">
                            ${income.description}
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                        <span class="income-source" style="font-size: 0.6rem; background: var(--light-gray); padding: 2px 8px; border-radius: 12px; color: var(--gray); white-space: nowrap;">
                            ${income.source}
                        </span>
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-top: 8px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div class="income-amount" style="font-weight: 600; color: var(--success);">
                            ${currencyUtils.formatDisplayCurrency(income.amount)}
                        </div>
                        <div style="font-size: 0.75rem; color: var(--gray);">
                            ${time} • ${incomeDate.toLocaleDateString()}
                        </div>
                    </div>
                    <div class="action-buttons">
                        ${income.isReimbursement ? `
                            <button class="unlink-reimbursement-btn" onclick="window.finTrack.app.handleUnlinkReimbursement('${income.id}')">
                                <i class="fas fa-unlink"></i>
                            </button>
                        ` : ''}
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

    //v5.2
     updateBudgetsUI() {
        const budgetsList = document.getElementById('budgetsList');
        if (!budgetsList) return;
        
        const budgets = this.state.getBudgets();
        const walletId = this.state.getState().currentWalletId;
        
        if (!walletId || budgets.length === 0) {
            budgetsList.innerHTML = `
                <div class="budget-item">
                    <div class="budget-details">No budgets set</div>
                </div>
            `;
            return;
        }
        
        const walletBudgets = budgets.filter(b => b.wallet_id === walletId);
        
        budgetsList.innerHTML = '';
        
        walletBudgets.forEach(budget => {
            const status = this.state.getCategoryBudgetStatus(budget.category_id, walletId);
            
            if (!status) return;
            
            const budgetItem = document.createElement('div');
            budgetItem.className = 'budget-item';
            
            const progressColor = status.status === 'exceeded' ? '#EF4444' : 
                                 status.status === 'warning' ? '#F59E0B' : '#10B981';
            
            budgetItem.innerHTML = `
                <div style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <strong>${budget.categories?.name || 'Category'}</strong>
                        <span style="color: ${progressColor}; font-weight: 600;">
                            ${currencyUtils.formatDisplayCurrency(status.spent)} / 
                            ${currencyUtils.formatDisplayCurrency(status.budget)}
                        </span>
                    </div>
                    <div style="background: #E5E7EB; height: 8px; border-radius: 4px; overflow: hidden;">
                        <div style="
                            width: ${Math.min(status.percentage, 100)}%; 
                            height: 100%; 
                            background: ${progressColor};
                            transition: width 0.3s ease;
                        "></div>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--gray); margin-top: 4px;">
                        ${currencyUtils.formatDisplayCurrency(status.remaining)} remaining
                        ${status.status === 'exceeded' ? '(over budget)' : ''}
                    </div>
                </div>
                <button class="delete-btn" onclick="window.finTrack.ui.confirmDelete('budget', '${budget.id}', '${budget.categories?.name}')">
                    <i class="fas fa-trash"></i>
                </button>
            `;
            
            budgetsList.appendChild(budgetItem);
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
    
// In the UIController class, update the renderWalletList method:

    renderWalletList(wallets, container) {
        container.innerHTML = '';
        
        wallets.forEach(wallet => {
            const balance = this.state.getWalletBalance(wallet.id);
            const isDefault = wallet.isDefault || false;
            
            const walletItem = document.createElement('div');
            walletItem.className = 'wallet-item';
            
            // Mobile-friendly layout
            walletItem.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
                    <!-- Top row: Wallet name and default badge -->
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
                        <div style="flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <div style="font-weight: 500; font-size: 1rem; word-break: break-word;">
                                ${wallet.name}
                            </div>
                            ${isDefault ? 
                                '<span style="background: var(--primary); color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 600; white-space: nowrap; flex-shrink: 0;">DEFAULT</span>' 
                                : ''}
                        </div>
                    </div>
                    
                    <!-- Bottom row: Balance and actions -->
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; flex-wrap: wrap; gap: 8px;">
                        <div class="wallet-balance" style="font-size: 1.1rem; font-weight: 600; color: var(--primary); min-width: 0;">
                            ${currencyUtils.formatDisplayCurrency(balance)}
                        </div>
                        
                        <div class="action-buttons" style="display: flex; gap: 8px; flex-shrink: 0;">
                            ${!isDefault ? `
                                <button class="btn btn-sm" 
                                        onclick="window.finTrack.app.handleSetDefaultWallet('${wallet.id}')" 
                                        style="padding: 6px 12px; font-size: 0.75rem; background: var(--light-gray); color: var(--dark); border-radius: 6px; white-space: nowrap; display: flex; align-items: center; gap: 4px;">
                                    <i class="fas fa-star" style="font-size: 0.7rem;"></i> 
                                    <span>Default</span>
                                </button>
                            ` : ''}
                            
                            <button class="edit-btn" onclick="window.finTrack.ui.editWallet('${wallet.id}')"
                                    style="padding: 6px; border-radius: 6px; background: var(--light-gray); color: var(--dark);">
                                <i class="fas fa-edit"></i>
                            </button>
                            
                            <button class="delete-btn" onclick="window.finTrack.ui.confirmDelete('wallet', '${wallet.id}', '${wallet.name}')"
                                    style="padding: 6px; border-radius: 6px; background: var(--light-danger); color: var(--danger);">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
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
                <div class="category-button-group">
                    <button class="add-subcategory-btn" data-id="${category.id}">
                        <i class="fas fa-plus"></i> Sub
                    </button>
                    <button class="edit-btn" onclick="window.finTrack.ui.editCategory('${category.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete-btn" onclick="window.finTrack.ui.confirmDelete('category', '${category.id}', '${category.name}')">
                        <i class="fas fa-trash"></i>
                    </button>
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
        const pendingReimbursementTotal = document.getElementById('pendingReimbursementTotal');
        
        if (!totalIncome || !totalExpenses || !currentWalletBalance) return;
        
        const currentWalletId = this.state.getState().currentWalletId;
        
        if (!currentWalletId) {
            totalIncome.textContent = currencyUtils.formatDisplayCurrency(0);
            totalExpenses.textContent = currencyUtils.formatDisplayCurrency(0);
            currentWalletBalance.textContent = currencyUtils.formatDisplayCurrency(0);
            if (pendingReimbursementTotal) {
                pendingReimbursementTotal.textContent = currencyUtils.formatDisplayCurrency(0);
            }
            return;
        }
        
        const expenses = this.state.getExpenses().filter(e => e.walletId === currentWalletId);
        const incomes = this.state.getIncomes().filter(i => i.walletId === currentWalletId);
        
        const totalExpensesAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
        const totalIncomeAmount = incomes.reduce((sum, i) => sum + i.amount, 0);
        const balance = totalIncomeAmount - totalExpensesAmount;
        
        // NEW: Calculate pending reimbursement total
        const pendingTotal = this.state.getPendingReimbursementTotal();
        
        totalIncome.textContent = currencyUtils.formatDisplayCurrency(totalIncomeAmount);
        totalExpenses.textContent = currencyUtils.formatDisplayCurrency(totalExpensesAmount);
        currentWalletBalance.textContent = currencyUtils.formatDisplayCurrency(balance);
        
        if (pendingReimbursementTotal) {
            pendingReimbursementTotal.textContent = currencyUtils.formatDisplayCurrency(pendingTotal);
        }
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

        const expenseCategoryRow = document.getElementById('editExpenseCategoryRow');
        const expenseReimbursableSection = document.getElementById('editExpenseReimbursableSection');
        const expenseReceiptSection = document.getElementById('editExpenseReceiptSection'); // ✅ ADD THIS
        const incomeReimbursementSection = document.getElementById('editIncomeReimbursementSection');
        const incomeTypeGroup = document.getElementById('editIncomeTypeGroup');
        const editIncomeExpenseSelector = document.getElementById('editIncomeExpenseSelector');

        if (expenseCategoryRow) expenseCategoryRow.style.display = 'none';
        if (expenseReimbursableSection) expenseReimbursableSection.style.display = 'none';
        if (expenseReceiptSection) expenseReceiptSection.style.display = 'none'; // ✅ ADD THIS
        if (incomeReimbursementSection) incomeReimbursementSection.style.display = 'none';
        if (incomeTypeGroup) incomeTypeGroup.style.display = 'none';
        if (editIncomeExpenseSelector) editIncomeExpenseSelector.classList.add('hidden');

        const expenseReimbursableCheckbox = document.getElementById('editIsReimbursable');
        const incomeReimbursementCheckbox = document.getElementById('editIncomeIsReimbursement');
        if (expenseReimbursableCheckbox) expenseReimbursableCheckbox.checked = false;
        if (incomeReimbursementCheckbox) incomeReimbursementCheckbox.checked = false;

        if (type === 'expense') {
            title.innerHTML = 'Edit Expense';
            subtitle.textContent = 'Update expense details';
            
            if (expenseCategoryRow) expenseCategoryRow.style.display = 'flex';
            if (expenseReimbursableSection) {
                expenseReimbursableSection.style.display = 'block';
                console.log('✅ Expense reimbursable section shown');
            }
            if (expenseReceiptSection) expenseReceiptSection.style.display = 'block';
            
            if (item.receiptUrl) {
                this.displayReceiptPreview(item.receiptUrl);
            } else {
                const previewContainer = document.getElementById('editReceiptPreview');
                if (previewContainer) {
                    previewContainer.innerHTML = '';
                    previewContainer.style.display = 'none';
                }
            }
        } else {
            title.innerHTML = 'Edit Income';
            subtitle.textContent = 'Update income details';
            
            if (incomeReimbursementSection) incomeReimbursementSection.style.display = 'block';
            if (incomeTypeGroup) incomeTypeGroup.style.display = 'block';
        }
        
        document.getElementById('editItemType').value = type;
        document.getElementById('editItemId').value = item.id;
        
        this.populateCategorySelect(categorySelect, type);
        
        // Setup subcategory if it's an expense
        if (type === 'expense') {
            
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
                
                // iOS Safari fix: Remove old listeners by cloning
                const newCategorySelect = categorySelect.cloneNode(true);
                categorySelect.parentNode.replaceChild(newCategorySelect, categorySelect);
                
                // Re-set the value after cloning
                newCategorySelect.value = item.category;
                
                // Debounced update handler for rapid switching
                let updateTimeout = null;  // ✅ Timer instead of boolean flag
                let lastValue = newCategorySelect.value;

                newCategorySelect.addEventListener('change', (e) => {
                    const selectedCategory = e.target.value;
                    
                    // Cancel any pending update (KEY CHANGE!)
                    if (updateTimeout) {
                        clearTimeout(updateTimeout);  // ✅ Cancel previous timer
                    }
                    
                    // Store the latest selection
                    lastValue = selectedCategory;
                    
                    const newSubcategorySelect = document.getElementById('editSubcategory');
                    
                    // Immediate visual feedback - disable subcategory
                    newSubcategorySelect.disabled = true;
                    
                    // Debounce the actual update
                    updateTimeout = setTimeout(() => {  // ✅ Set new timer
                        const selectedMainCategory = mainCategories.find(c => c.name === lastValue);
                        
                        // Close the category dropdown
                        newCategorySelect.blur();
                        
                        // Update subcategory options
                        if (selectedMainCategory) {
                            const newSubcategories = this.state.getSubcategories(selectedMainCategory.id);
                            newSubcategorySelect.innerHTML = '<option value="">Optional</option>';
                            newSubcategories.forEach(subcat => {
                                const option = document.createElement('option');
                                option.value = subcat.name;
                                option.textContent = subcat.name;
                                newSubcategorySelect.appendChild(option);
                            });
                        } else {
                            newSubcategorySelect.innerHTML = '<option value="">Optional</option>';
                        }
                        
                        // Re-enable after a short delay for iOS to settle
                        requestAnimationFrame(() => {
                            setTimeout(() => {
                                newSubcategorySelect.disabled = false;
                                updateTimeout = null;
                            }, 50);
                        });
                    }, 200); // ✅ 200ms debounce - waits for user to stop switching
                });
            }
        } else {
            
            // Show income type dropdown
            const incomeTypeGroup = document.getElementById('editIncomeTypeGroup');
            const incomeTypeSelect = document.getElementById('editIncomeType');
            if (incomeTypeGroup && incomeTypeSelect) {
                incomeTypeGroup.style.display = 'block';
                
                // Populate income type options
                incomeTypeSelect.innerHTML = `
                    <option value="">Select type</option>
                    <option value="Salary">Salary</option>
                    <option value="Freelance">Freelance</option>
                    <option value="Investment">Investment</option>
                    <option value="Gift">Gift</option>
                    <option value="Bonus">Bonus</option>
                    <option value="Reimbursement">Reimbursement</option>
                    <option value="Other">Other</option>
                `;
                incomeTypeSelect.value = item.source;
            }
            
            // Show reimbursement section for income
            const reimbursementSection = document.getElementById('editIncomeReimbursementSection');
            if (reimbursementSection) {
                reimbursementSection.style.display = 'block';
                
                // Set checkbox state
                const isReimbursementCheckbox = document.getElementById('editIncomeIsReimbursement');
                if (isReimbursementCheckbox) {
                    isReimbursementCheckbox.checked = item.isReimbursement || false;
                    
                    // Show/hide expense selector based on checkbox state
                    const expenseSelector = document.getElementById('editIncomeExpenseSelector');
                    if (item.isReimbursement) {
                        expenseSelector.classList.remove('hidden');
                        // Update display with linked expenses
                        const linkedExpenses = this.state.getLinkedExpensesForIncome(item.id);
                        const textElement = document.getElementById('editSelectedExpensesText');
                        if (textElement && linkedExpenses.length > 0) {
                            const total = linkedExpenses.reduce((sum, e) => sum + e.amount, 0);
                            textElement.innerHTML = `${linkedExpenses.length} expense${linkedExpenses.length > 1 ? 's' : ''} selected (${currencyUtils.formatDisplayCurrency(total)})`;
                        }
                    } else {
                        expenseSelector.classList.add('hidden');
                    }
                }
            }
        }

        // Fill values from the transaction
        document.getElementById('editDescription').value = item.description;
        
        // ✅ Format amount with thousand separators (remove "Rp " prefix)
        document.getElementById('editAmount').value = currencyUtils.formatDisplayCurrency(item.amount).replace('Rp ', '');
        
        document.getElementById('editDate').value = item.date;
        document.getElementById('editCategory').value = type === 'expense' ? item.category : item.source;

        //v5.2
        if (type === 'expense') {
            const checkbox = document.getElementById('editIsReimbursable');
            
            if (checkbox) {
                checkbox.checked = item.isReimbursable || false;
                console.log('🔧 Setting expense reimbursable checkbox to:', item.isReimbursable);
            }
        }
        
        // ✅ Add live formatting for edit amount input
        const editAmountInput = document.getElementById('editAmount');
        // Remove any existing listeners by cloning
        const newEditAmountInput = editAmountInput.cloneNode(true);
        editAmountInput.parentNode.replaceChild(newEditAmountInput, editAmountInput);
        
        // Add new event listener
        newEditAmountInput.addEventListener('input', function() {
            this.value = currencyUtils.formatCurrency(this.value);
        });

        modal.classList.add('active');
    }

    displayReceiptPreview(receiptUrl) {
        const previewContainer = document.getElementById('editReceiptPreview');
        if (!previewContainer) return;
        
        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(receiptUrl);
        const isPDF = /\.pdf$/i.test(receiptUrl);
        
        let previewHTML = '';
        
        if (isImage) {
            previewHTML = `
                <div style="position: relative; border: 2px solid var(--light-gray); border-radius: 8px; overflow: hidden; max-width: 300px;">
                    <img src="${receiptUrl}" 
                        alt="Receipt" 
                        style="width: 100%; height: auto; display: block; cursor: pointer;"
                        onclick="window.open('${receiptUrl}', '_blank')">
                    <div style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.6); border-radius: 6px; padding: 6px 10px; display: flex; gap: 8px;">
                        <a href="${receiptUrl}" 
                        target="_blank" 
                        style="color: white; text-decoration: none;"
                        title="View full size">
                            <i class="fas fa-external-link-alt"></i>
                        </a>
                        <button onclick="window.finTrack.ui.removeReceipt()" 
                                style="background: none; border: none; color: white; cursor: pointer; padding: 0;"
                                title="Remove receipt">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        } else if (isPDF) {
            previewHTML = `
                <div style="border: 2px solid var(--light-gray); border-radius: 8px; padding: 16px; display: flex; align-items: center; justify-content: space-between; max-width: 300px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <i class="fas fa-file-pdf" style="font-size: 2rem; color: #DC2626;"></i>
                        <div>
                            <div style="font-weight: 600; font-size: 0.9rem;">Receipt PDF</div>
                            <a href="${receiptUrl}" 
                            target="_blank" 
                            style="color: var(--primary); text-decoration: none; font-size: 0.8rem;">
                                <i class="fas fa-external-link-alt"></i> View PDF
                            </a>
                        </div>
                    </div>
                    <button onclick="window.finTrack.ui.removeReceipt()" 
                            class="delete-btn"
                            title="Remove receipt">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        }
        
        previewContainer.innerHTML = previewHTML;
        previewContainer.style.display = previewHTML ? 'block' : 'none';
    }

    removeReceipt() {
        const previewContainer = document.getElementById('editReceiptPreview');
        if (previewContainer) {
            previewContainer.innerHTML = '';
            previewContainer.style.display = 'none';
        }
        
        // Mark for deletion
        const uploadInput = document.getElementById('editReceiptUpload');
        if (uploadInput) {
            uploadInput.dataset.deleteExisting = 'true';
        }
    }    

    populateCategorySelect(selectElement, type) {
        selectElement.disabled = true;
        selectElement.innerHTML = '';
        
        if (type === 'expense') {
            const categories = this.state.getCategories();
            
            categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.name;
                option.textContent = cat.name;
                selectElement.appendChild(option);
            });
        } else {
            const sources = ['Salary', 'Freelance', 'Investment', 'Gift', 'Bonus', 'Other'];
            sources.forEach(source => {
                const option = document.createElement('option');
                option.value = source;
                option.textContent = source;
                selectElement.appendChild(option);
            });
        }

        setTimeout(() => {
            selectElement.disabled = false;
        }, 50);        
    }    

    // Add this inside the UIController class in app.js
    showLoading(isLoading) {
        const submitBtn = document.querySelector('#editTransactionForm button[type="submit"]');
        if (!submitBtn) return;
    
        if (isLoading) {
            // Save the original text ONLY if not already set
            if (!submitBtn.dataset.originalText) {
                submitBtn.dataset.originalText = submitBtn.innerHTML;
            }
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        } else {
            submitBtn.disabled = false;
            // Restore the original text (e.g., "Save Changes")
            submitBtn.innerHTML = submitBtn.dataset.originalText || '<i class="fas fa-save"></i> Save Changes';
            // Clear the stored text so next modal open works correctly
            delete submitBtn.dataset.originalText;
        }
    }   
    
    editWallet(id) {
        const wallet = this.state.getWallets().find(w => w.id === id);
        if (!wallet) return;
        
        document.getElementById('editWalletId').value = wallet.id;
        document.getElementById('editWalletName').value = wallet.name;
        
        document.getElementById('editWalletModal').classList.add('active');
    }
    
    editCategory(id) {
        const category = this.state.getCategories().find(c => c.id === id);
        if (!category) return;
        
        document.getElementById('editCategoryId').value = category.id;
        document.getElementById('editCategoryName').value = category.name;
        document.getElementById('editCategoryType').value = category.type;
        
        if (category.type === 'sub') {
            document.getElementById('editParentCategoryGroup').classList.remove('hidden');
            this.loadEditParentCategories();
            
            setTimeout(() => {
                document.getElementById('editParentCategory').value = category.parentId;
            }, 100);
        } else {
            document.getElementById('editParentCategoryGroup').classList.add('hidden');
        }
        
        document.getElementById('editCategoryModal').classList.add('active');
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
            let message = '';
            
            switch(type) {
                case 'budget':
                    message = `Delete the budget limit for "${name}"? This will NOT delete the category itself, only the spending limit.`;
                    break;
                case 'category':
                    message = `Delete category "${name}"? This will also delete all its subcategories. Expenses won't be deleted but will lose their category.`;
                    break;
                case 'wallet':
                    message = `Delete wallet "${name}"? All expenses and income in this wallet will also be deleted.`;
                    break;
                case 'expense':
                    message = `Delete expense "${name}"? This can't be undone.`;
                    break;
                case 'income':
                    message = `Delete income "${name}"? This can't be undone.`;
                    break;
                default:
                    message = `Delete "${name}"? This can't be undone.`;
            }
            
            deleteMessage.textContent = message;
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
        this.updateOverviewUI();
        this.updateCompactBudgetView(); // ADD THIS
        this.updateBudgetTabUI(); // ADD THIS
        this.updateExpensesTabUI();
        this.updateIncomesTabUI();
        this.updateWalletsUI();
        this.updateCategoriesUI();
        this.updateStats();
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

    //v5.2
    openBudgetModal() {
        const modal = document.getElementById('budgetModal');
        const categorySelect = document.getElementById('budgetCategory');
        
        // Populate categories
        categorySelect.innerHTML = '<option value="">Select category</option>';
        const mainCategories = this.state.getMainCategories();
        
        mainCategories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            categorySelect.appendChild(option);
        });
        
        // Setup currency formatting
        const amountInput = document.getElementById('budgetAmount');
        amountInput.addEventListener('input', function() {
            this.value = currencyUtils.formatCurrency(this.value);
        });
        
        modal.classList.add('active');
    }
    
    setupExpenseSubTabs() {
        const subTabs = document.querySelectorAll('.expense-sub-tab');
        
        subTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const subtab = tab.getAttribute('data-subtab');
                this.switchExpenseSubTab(subtab);
            });
        });
    }

    switchExpenseSubTab(subtab) {
        // Update active tab
        document.querySelectorAll('.expense-sub-tab').forEach(tab => {
            if (tab.getAttribute('data-subtab') === subtab) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        
        // Show/hide views
        const allExpensesView = document.getElementById('allExpensesView');
        const reimbursementView = document.getElementById('reimbursementView');
        
        if (subtab === 'all') {
            allExpensesView.style.display = 'block';
            reimbursementView.style.display = 'none';
        } else if (subtab === 'reimbursement') {
            allExpensesView.style.display = 'none';
            reimbursementView.style.display = 'block';
            this.updateReimbursementView();
        }
    }

    updateReimbursementView() {
        const currentWalletId = this.state.getState().currentWalletId;
        
        if (!currentWalletId) {
            this.showEmptyReimbursementState('Please select a wallet first');
            return;
        }
        
        const stats = this.state.getReimbursementStats();
        
        // Update dashboard stats
        document.getElementById('reimbPendingTotal').textContent = 
            currencyUtils.formatDisplayCurrency(stats.pendingAmount);
        document.getElementById('reimbPendingCount').textContent = 
            `${stats.pending} expense${stats.pending !== 1 ? 's' : ''}`;
        
        document.getElementById('reimbReimbursedTotal').textContent = 
            currencyUtils.formatDisplayCurrency(stats.reimbursedAmount);
        document.getElementById('reimbReimbursedCount').textContent = 
            `${stats.reimbursed} expense${stats.reimbursed !== 1 ? 's' : ''}`;
        
        // Update pending list
        this.renderPendingReimbursements();
        
        // Update reimbursed list
        this.renderReimbursedExpenses();
    }

    renderPendingReimbursements() {
        const container = document.getElementById('pendingReimbursementList');
        const countElement = document.getElementById('pendingReimbursementCount');
        const pending = this.state.getPendingReimbursableExpenses();
        
        countElement.textContent = pending.length;
        
        if (pending.length === 0) {
            container.innerHTML = `
                <div class="reimbursement-empty">
                    <i class="fas fa-inbox"></i>
                    <h3>No Pending Reimbursements</h3>
                    <p>Check "💰 Reimbursable" when adding expenses that will be reimbursed</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = '';
        
        pending.forEach(expense => {
            const item = document.createElement('div');
            item.className = 'expense-item';
            
            let categoryText = expense.category;
            if (expense.subcategory) {
                categoryText += ` › ${expense.subcategory}`;
            }

            let receiptIcon = '';
            if (expense.receiptUrl) {
                receiptIcon = `<button class="receipt-icon-btn" onclick="window.finTrack.app.viewReceipt('${expense.id}', '${expense.description.replace(/'/g, "\\'")}', '${expense.receiptUrl}')" title="View receipt">
                    <i class="fas fa-paperclip"></i>
                </button>`;
            }            
            
            item.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
                    <div style="flex: 1; min-width: 0; margin-right: 12px;">
                        <div style="font-weight: 500; word-break: break-word; font-size: 0.8rem; display: flex; align-items: center; flex-wrap: wrap; gap: 4px;">
                            <span>${expense.description}</span>
                            ${receiptIcon}
                            <span class="reimbursement-badge pending">
                                <i class="fas fa-clock"></i> Pending
                            </span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                        <span class="expense-category" style="font-size: 0.6rem; background: var(--light-gray); padding: 2px 8px; border-radius: 12px; color: var(--gray); white-space: nowrap;">
                            ${categoryText}
                        </span>
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-top: 8px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div class="expense-amount" style="font-weight: 600; color: var(--primary);">
                            ${currencyUtils.formatDisplayCurrency(expense.amount)}
                        </div>
                        <div style="font-size: 0.75rem; color: var(--gray);">
                            ${new Date(expense.date).toLocaleDateString()}
                        </div>
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
            
            container.appendChild(item);
        });
    }

    renderReimbursedExpenses() {
        const container = document.getElementById('reimbursedList');
        const countElement = document.getElementById('reimbursedCount');
        
        const currentWalletId = this.state.getState().currentWalletId;
        const expenses = this.state.getExpenses().filter(e => 
            e.walletId === currentWalletId &&
            e.isReimbursable === true &&
            e.reimbursementStatus === 'reimbursed'
        );
        
        // Get all reimbursement incomes
        const reimbursementIncomes = this.state.getIncomes().filter(i =>
            i.walletId === currentWalletId &&
            i.isReimbursement === true
        );
        
        countElement.textContent = reimbursementIncomes.length;
        
        if (reimbursementIncomes.length === 0) {
            container.innerHTML = `
                <div class="reimbursement-empty">
                    <i class="fas fa-check-circle"></i>
                    <h3>No Reimbursements Yet</h3>
                    <p>Add income and mark as reimbursement to link expenses</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = '';
        
        // Group by income (reimbursement)
        reimbursementIncomes.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        reimbursementIncomes.forEach(income => {
            const linkedExpenses = this.state.getLinkedExpensesForIncome(income.id);
            
            const groupDiv = document.createElement('div');
            groupDiv.style.marginBottom = '1.5rem';
            
            // Income header
            const incomeHeader = document.createElement('div');
            incomeHeader.className = 'income-item';
            incomeHeader.style.background = 'linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)';
            incomeHeader.style.border = '2px solid #10B981';
            incomeHeader.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
                    <div style="flex: 1; min-width: 0; margin-right: 12px;">
                        <div style="font-weight: 600; word-break: break-word; font-size: 0.9rem; color: #065F46;">
                            <i class="fas fa-check-circle" style="color: #10B981;"></i>
                            ${income.description}
                            <span class="linked-income-badge">
                                <i class="fas fa-link"></i>
                                ${linkedExpenses.length} expense${linkedExpenses.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                        <span style="font-size: 0.7rem; background: white; padding: 2px 8px; border-radius: 12px; color: #065F46; font-weight: 600;">
                            ${new Date(income.date).toLocaleDateString()}
                        </span>
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-top: 8px;">
                    <div class="income-amount" style="font-weight: 700; color: #10B981; font-size: 1.1rem;">
                        ${currencyUtils.formatDisplayCurrency(income.amount)}
                    </div>
                    <div class="action-buttons">
                        <button class="unlink-reimbursement-btn" onclick="window.finTrack.app.handleUnlinkReimbursement('${income.id}')">
                            <i class="fas fa-unlink"></i> Unlink
                        </button>
                        <button class="edit-btn" onclick="window.finTrack.ui.editIncome('${income.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="delete-btn" onclick="window.finTrack.ui.confirmDelete('income', '${income.id}', '${income.description}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
            
            groupDiv.appendChild(incomeHeader);
            
            // Linked expenses
            if (linkedExpenses.length > 0) {
                const expensesContainer = document.createElement('div');
                expensesContainer.style.marginLeft = '20px';
                expensesContainer.style.marginTop = '8px';
                expensesContainer.style.paddingLeft = '12px';
                expensesContainer.style.borderLeft = '3px solid #10B981';
                
                linkedExpenses.forEach(expense => {
                    let categoryText = expense.category;
                    if (expense.subcategory) {
                        categoryText += ` › ${expense.subcategory}`;
                    }

                    let receiptIcon = '';
                    if (expense.receiptUrl) {
                        receiptIcon = `<button class="receipt-icon-btn" onclick="window.finTrack.app.viewReceipt('${expense.id}', '${expense.description.replace(/'/g, "\\'")}', '${expense.receiptUrl}')" title="View receipt">
                            <i class="fas fa-paperclip"></i>
                        </button>`;
                    }                    
                    
                    const expenseItem = document.createElement('div');
                    expenseItem.className = 'expense-item';
                    // expenseItem.style.background = '#F9FAFB';
                    // expenseItem.style.marginBottom = '8px';
                    expenseItem.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                            <div style="flex: 1;">
                                <div style="font-size: 0.85rem; font-weight: 500; display: flex; align-items: center; gap: 4px;">
                                    <span>${expense.description}</span>
                                    ${receiptIcon}
                                </div>
                                <div style="font-size: 0.75rem; color: var(--gray); margin-top: 2px;">
                                    ${categoryText} • ${new Date(expense.date).toLocaleDateString()}
                                </div>
                            </div>
                            <div style="font-weight: 600; color: var(--primary);">
                                ${currencyUtils.formatDisplayCurrency(expense.amount)}
                            </div>
                        </div>
                    `;
                    
                    expensesContainer.appendChild(expenseItem);
                });
                
                groupDiv.appendChild(expensesContainer);
            }
            
            container.appendChild(groupDiv);
        });
    }

    showEmptyReimbursementState(message) {
        const container = document.getElementById('pendingReimbursementList');
        container.innerHTML = `
            <div class="reimbursement-empty">
                <i class="fas fa-wallet"></i>
                <h3>${message}</h3>
            </div>
        `;
        
        document.getElementById('reimbursedList').innerHTML = container.innerHTML;
    }    

    displayReceiptPreview(receiptUrl) {
        const previewContainer = document.getElementById('editReceiptPreview');
        if (!previewContainer) return;
        
        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(receiptUrl);
        const isPDF = /\.pdf$/i.test(receiptUrl);
        
        let previewHTML = '';
        
        if (isImage) {
            previewHTML = `
                <div style="position: relative; border: 2px solid var(--light-gray); border-radius: 8px; overflow: hidden; max-width: 300px;">
                    <img src="${receiptUrl}" 
                        alt="Receipt" 
                        style="width: 100%; height: auto; display: block; cursor: pointer;"
                        onclick="window.open('${receiptUrl}', '_blank')">
                    <div style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.6); border-radius: 6px; padding: 6px 10px; display: flex; gap: 8px;">
                        <a href="${receiptUrl}" 
                        target="_blank" 
                        style="color: white; text-decoration: none;"
                        title="View full size">
                            <i class="fas fa-external-link-alt"></i>
                        </a>
                        <button onclick="window.finTrack.ui.removeReceipt()" 
                                style="background: none; border: none; color: white; cursor: pointer; padding: 0;"
                                title="Remove receipt">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        } else if (isPDF) {
            previewHTML = `
                <div style="border: 2px solid var(--light-gray); border-radius: 8px; padding: 16px; display: flex; align-items: center; justify-content: space-between; max-width: 300px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <i class="fas fa-file-pdf" style="font-size: 2rem; color: #DC2626;"></i>
                        <div>
                            <div style="font-weight: 600; font-size: 0.9rem;">Receipt PDF</div>
                            <a href="${receiptUrl}" 
                            target="_blank" 
                            style="color: var(--primary); text-decoration: none; font-size: 0.8rem;">
                                <i class="fas fa-external-link-alt"></i> View PDF
                            </a>
                        </div>
                    </div>
                    <button onclick="window.finTrack.ui.removeReceipt()" 
                            class="delete-btn"
                            title="Remove receipt">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        }
        
        previewContainer.innerHTML = previewHTML;
        previewContainer.style.display = previewHTML ? 'block' : 'none';
    }

    // Add method to remove receipt
    removeReceipt() {
        const previewContainer = document.getElementById('editReceiptPreview');
        if (previewContainer) {
            previewContainer.innerHTML = '';
            previewContainer.style.display = 'none';
        }
        
        // Mark for deletion
        const uploadInput = document.getElementById('editReceiptUpload');
        if (uploadInput) {
            uploadInput.dataset.deleteExisting = 'true';
        }
    }    
}

// Export app factory function
export const createApp = (supabase) => {
    return new FinTrackApp(supabase);

};


