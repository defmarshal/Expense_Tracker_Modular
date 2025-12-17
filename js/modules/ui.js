// js/modules/ui.js

/**
 * UI CONTROLLER MODULE
 * Handles all DOM updates and UI interactions
 */

import { getState } from './state.js';
import { currencyUtils, dateUtils, domUtils } from './utils.js';

class UIController {
    constructor() {
        this.state = getState();
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
        this.state.subscribe('expenses', () => this.updateExpensesUI());
        this.state.subscribe('incomes', () => this.updateIncomesUI());
        this.state.subscribe('wallets', () => this.updateWalletsUI());
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
            categoryType.addEventListener('change', function() {
                if (this.value === 'sub') {
                    parentCategoryGroup.classList.remove('hidden');
                    this.loadParentCategories();
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
        const tabContents = document.querySelectorAll('.tab-content');
        
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
        
        selector.innerHTML = '<option value="">Select wallet</option>';
        const wallets = this.state.getWallets();
        
        wallets.forEach(wallet => {
            const option = document.createElement('option');
            option.value = wallet.id;
            option.textContent = wallet.name;
            selector.appendChild(option);
        });
        
        // Set current wallet if available
        const currentWalletId = this.state.getState().currentWalletId;
        if (currentWalletId) {
            selector.value = currentWalletId;
        } else if (wallets.length > 0) {
            this.state.setCurrentWallet(wallets[0].id);
        }
        
        // Add change listener
        selector.addEventListener('change', (e) => {
            this.state.setCurrentWallet(e.target.value);
        });
    }
    
    updateWalletDependentUI() {
        this.updateExpensesUI();
        this.updateIncomesUI();
        this.updateStats();
        this.updateMonthYearFilters();
    }
    
    // ==================== EXPENSE UI ====================
    
    updateExpensesUI() {
        this.updateCurrentMonthExpenses();
        this.updateHistoricalExpensesView();
    }
    
    updateCurrentMonthExpenses() {
        const expensesList = document.getElementById('expensesList');
        if (!expensesList) return;
        
        const currentMonthExpenses = this.state.getCurrentMonthExpenses();
        
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
        
        const filters = this.state.getState().filters;
        const monthlyExpenses = this.state.getMonthlyExpenses(filters.month, filters.year);
        
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
        let displayIncomes = this.state.getIncomes();
        
        if (currentWalletId) {
            displayIncomes = displayIncomes.filter(income => income.walletId === currentWalletId);
        }
        
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
            
            const walletItem = document.createElement('div');
            walletItem.className = 'wallet-item';
            walletItem.innerHTML = `
                <div class="wallet-details">
                    <div style="font-weight: 500;">${wallet.name}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div class="wallet-balance">${currencyUtils.formatDisplayCurrency(balance)}</div>
                    <div class="action-buttons">
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
        
        if (!currentWalletId) {
            totalIncome.textContent = currencyUtils.formatDisplayCurrency(0);
            totalExpenses.textContent = currencyUtils.formatDisplayCurrency(0);
            currentWalletBalance.textContent = currencyUtils.formatDisplayCurrency(0);
            return;
        }
        
        const balance = this.state.getWalletBalance(currentWalletId);
        
        // For now, calculate from data - in real app, these would be separate stats
        const walletExpenses = this.state.getExpenses().filter(e => e.walletId === currentWalletId);
        const walletIncomes = this.state.getIncomes().filter(i => i.walletId === currentWalletId);
        
        const totalExpensesAmount = walletExpenses.reduce((sum, e) => sum + e.amount, 0);
        const totalIncomeAmount = walletIncomes.reduce((sum, i) => sum + i.amount, 0);
        
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
        
        // Fill form
        document.getElementById('expenseId').value = expense.id;
        document.getElementById('expenseDescription').value = expense.description;
        document.getElementById('expenseAmount').value = currencyUtils.formatCurrency(expense.amount.toString());
        document.getElementById('expenseDate').value = expense.date;
        document.getElementById('expenseCategory').value = expense.category;
        
        // Update subcategory dropdown and set value
        setTimeout(() => {
            const categoryChangeEvent = new Event('change');
            document.getElementById('expenseCategory').dispatchEvent(categoryChangeEvent);
            
            setTimeout(() => {
                document.getElementById('expenseSubcategory').value = expense.subcategory || '';
            }, 100);
        }, 100);
        
        // Update button text and show cancel
        const expenseSubmitBtn = document.getElementById('expenseSubmitBtn');
        const expenseCancelBtn = document.getElementById('expenseCancelBtn');
        
        if (expenseSubmitBtn) expenseSubmitBtn.innerHTML = '<i class="fas fa-save"></i> Update';
        if (expenseCancelBtn) expenseCancelBtn.classList.remove('hidden');
        
        // Switch to expenses tab and scroll to form
        this.state.setActiveTab('expenses');
        domUtils.scrollToElement(document.getElementById('expenseForm'));
    }
    
    editIncome(id) {
        const income = this.state.getIncomes().find(i => i.id === id);
        if (!income) return;
        
        document.getElementById('incomeId').value = income.id;
        document.getElementById('incomeDescription').value = income.description;
        document.getElementById('incomeAmount').value = currencyUtils.formatCurrency(income.amount.toString());
        document.getElementById('incomeDate').value = income.date;
        document.getElementById('incomeSource').value = income.source;
        
        const incomeSubmitBtn = document.getElementById('incomeSubmitBtn');
        const incomeCancelBtn = document.getElementById('incomeCancelBtn');
        
        if (incomeSubmitBtn) incomeSubmitBtn.innerHTML = '<i class="fas fa-save"></i> Update';
        if (incomeCancelBtn) incomeCancelBtn.classList.remove('hidden');
        
        this.state.setActiveTab('income');
        domUtils.scrollToElement(document.getElementById('incomeForm'));
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
}

// Create singleton instance
let uiInstance = null;

export const getUIController = () => {
    if (!uiInstance) {
        uiInstance = new UIController();
    }
    return uiInstance;
};