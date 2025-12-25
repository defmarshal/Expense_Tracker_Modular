// js/modules/state.js

/**
 * STATE MANAGEMENT MODULE
 * Centralized state management with observer pattern
 */

class FinTrackState {
  constructor() {
    this.state = {
      // User state
      user: null,
      isAuthenticated: false,
      
      // Data state
      expenses: [],
      incomes: [],
      wallets: [],
      categories: [],
      budgets: [],
      
      // UI state
      currentWalletId: null,
      activeTab: 'overview',
      activeModal: null,
      loading: false,
      
      // Filters
      filters: {
        month: new Date().getMonth(),
        year: new Date().getFullYear(),
        category: null,
        searchQuery: ''
      },
      
      // Temporary state
      pendingTransaction: null,
      editingItem: null
    };
    
    this.subscribers = {};
    this.listeners = new Map();
    this.transactionId = 0;
  }

  notifySubscribers(key) {
    if (this.subscribers[key]) {
        this.subscribers[key].forEach(callback => {
            try {
                callback(this.state[key]);
            } catch (error) {
                console.error(`Error in subscriber callback for ${key}:`, error);
            }
        });
    }
}

  // Getters
  getState() {
    return { ...this.state };
  }

  getUser() {
    return this.state.user;
  }

  getExpenses() {
    return [...this.state.expenses];
  }

  getIncomes() {
    return [...this.state.incomes];
  }

  getWallets() {
    return [...this.state.wallets];
  }

  getCategories() {
    return [...this.state.categories];
  }

  getCurrentWallet() {
    return this.state.wallets.find(w => w.id === this.state.currentWalletId);
  }

  getActiveTab() {
    return this.state.activeTab;
  }

  // Setters with immutability
  setState(updates) {
      console.log('State: setState called with updates:', updates);
      const oldState = { ...this.state };
      this.state = { ...this.state, ...updates };
      console.log('State: calling notifyListeners');
      this.notifyListeners(oldState, this.state);
      return this.state;
  }

  // Specific state updates
  setUser(user) {
    return this.setState({
      user,
      isAuthenticated: !!user
    });
  }

  setExpenses(expenses) {
      console.log('setExpenses called with', expenses.length, 'expenses');
      const result = this.setState({ expenses });
      console.log('After setState, notifying subscribers...');
      return result;
  }

  setIncomes(incomes) {
    return this.setState({ incomes });
  }

  setWallets(wallets) {
    let newState = { wallets };
    
    // If no current wallet is set and we have wallets, set the first one
    if (!this.state.currentWalletId && wallets.length > 0) {
      newState.currentWalletId = wallets[0].id;
    }
    
    return this.setState(newState);
  }

  setCategories(categories) {
    return this.setState({ categories });
  }

  setCurrentWallet(walletId) {
    return this.setState({ currentWalletId: walletId });
  }

  setActiveTab(tab) {
      console.log('State: setActiveTab called, changing from', this.state.activeTab, 'to', tab);
      const result = this.setState({ activeTab: tab });
      console.log('State: activeTab is now', this.state.activeTab);
      return result;
  }

  setActiveModal(modalName) {
    return this.setState({ activeModal: modalName });
  }

  setLoading(isLoading) {
    return this.setState({ loading: isLoading });
  }

  setFilter(key, value) {
    const filters = { ...this.state.filters, [key]: value };
    return this.setState({ filters });
  }

  // Data manipulation
  addExpense(expense) {
      console.log('=== addExpense called ===');
      console.log('Adding expense:', expense);
      console.log('Current expenses count:', this.state.expenses.length);
      
      const expenses = [...this.state.expenses, expense];
      console.log('New expenses count:', expenses.length);
      console.log('Calling setExpenses...');
      
      const result = this.setExpenses(expenses);
      
      console.log('After setExpenses, expenses in state:', this.state.expenses.length);
      return result;
  }

  updateExpense(updatedExpense) {
    const expenses = this.state.expenses.map(expense =>
      expense.id === updatedExpense.id ? updatedExpense : expense
    );
    return this.setExpenses(expenses);
  }

  deleteExpense(expenseId) {
    const expenses = this.state.expenses.filter(expense => expense.id !== expenseId);
    return this.setExpenses(expenses);
  }

  addIncome(income) {
    const incomes = [...this.state.incomes, income];
    return this.setIncomes(incomes);
  }

  updateIncome(updatedIncome) {
    const incomes = this.state.incomes.map(income =>
      income.id === updatedIncome.id ? updatedIncome : income
    );
    return this.setIncomes(incomes);
  }

  deleteIncome(incomeId) {
    const incomes = this.state.incomes.filter(income => income.id !== incomeId);
    return this.setIncomes(incomes);
  }

  addWallet(wallet) {
    const wallets = [...this.state.wallets, wallet];
    return this.setWallets(wallets);
  }

  updateWallet(updatedWallet) {
    const wallets = this.state.wallets.map(wallet =>
      wallet.id === updatedWallet.id ? updatedWallet : wallet
    );
    return this.setWallets(wallets);
  }

  deleteWallet(walletId) {
    const wallets = this.state.wallets.filter(wallet => wallet.id !== walletId);
    let newState = { wallets };
    
    // If deleting the current wallet, switch to another if available
    if (this.state.currentWalletId === walletId && wallets.length > 0) {
      newState.currentWalletId = wallets[0].id;
    } else if (this.state.currentWalletId === walletId) {
      newState.currentWalletId = null;
    }
    
    return this.setState(newState);
  }

  addCategory(category) {
    const categories = [...this.state.categories, category];
    return this.setCategories(categories);
  }

  updateCategory(updatedCategory) {
    const categories = this.state.categories.map(category =>
      category.id === updatedCategory.id ? updatedCategory : category
    );
    return this.setCategories(categories);
  }

  deleteCategory(categoryId) {
    const categories = this.state.categories.filter(category => category.id !== categoryId);
    return this.setCategories(categories);
  }

  // Computed properties
  getWalletBalance(walletId = null) {
      const targetWalletId = walletId || this.state.currentWalletId;
      if (!targetWalletId) return 0;  // Return 0 if no wallet selected
      
      const walletExpenses = this.state.expenses.filter(e => e.walletId === targetWalletId);
      const walletIncomes = this.state.incomes.filter(i => i.walletId === targetWalletId);
      
      const totalExpenses = walletExpenses.reduce((sum, expense) => sum + expense.amount, 0);
      const totalIncomes = walletIncomes.reduce((sum, income) => sum + income.amount, 0);
      
      return totalIncomes - totalExpenses;
  }

  getMonthlyExpenses(month, year, walletId = null) {
      const targetWalletId = walletId || this.state.currentWalletId;
      
      return this.state.expenses.filter(expense => {
          // If wallet is specified, filter by it
          if (targetWalletId && expense.walletId !== targetWalletId) {
              return false;
          }
          
          // Also filter by month/year
          const expenseDate = new Date(expense.date);
          return expenseDate.getMonth() === month && 
                 expenseDate.getFullYear() === year;
      });
  }

  getCurrentMonthExpenses() {
    const now = new Date();
    return this.getMonthlyExpenses(now.getMonth(), now.getFullYear());
  }

  getMainCategories() {
    return this.state.categories.filter(c => c.type === 'main');
  }

  getSubcategories(parentId) {
    return this.state.categories.filter(c => c.type === 'sub' && c.parentId === parentId);
  }

  //V5.2
  // Add budget methods
  getBudgets() {
      return [...this.state.budgets]; // Return copy for immutability
  }

  setBudgets(budgets) {
      return this.setState({ budgets }); // Use setState to trigger listeners properly
  }

  addBudget(budget) {
      const budgets = [...this.state.budgets, budget];
      return this.setBudgets(budgets);
  }

  updateBudget(budget) {
      const budgets = this.state.budgets.map(b => 
          b.id === budget.id ? budget : b
      );
      return this.setBudgets(budgets);
  }

  deleteBudget(id) {
      const budgets = this.state.budgets.filter(b => b.id !== id);
      return this.setBudgets(budgets);
  }

  // Calculate budget usage (excluding reimbursable expenses)
  getCategoryBudgetStatus(categoryId, walletId) {
      const budget = this.state.budgets.find(
          b => b.category_id === categoryId && b.wallet_id === walletId
      );
      
      if (!budget) return null;
      
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      console.log('getCategoryBudgetStatus - Looking for:', {
          categoryId,
          walletId,
          categoryName: this.getCategoryName(categoryId)
      });
      
      // Get expenses for this category (exclude reimbursable ones)
      const expenses = this.state.expenses.filter(e => {
          const expenseDate = new Date(e.date);
          const matches = e.walletId === walletId &&  // ✅ Changed from e.wallet_id
                e.category === this.getCategoryName(categoryId) &&
                expenseDate >= startOfMonth &&
                !e.isReimbursable;  // ✅ Changed from e.is_reimbursable
          
          if (matches) {
              console.log('Found matching expense:', e);
          }
          
          return matches;
      });
      
      console.log('getCategoryBudgetStatus - Found expenses:', expenses.length);
      
      const spent = expenses.reduce((sum, e) => sum + e.amount, 0);
      const remaining = budget.amount - spent;
      const percentage = (spent / budget.amount) * 100;
      
      console.log('getCategoryBudgetStatus - Result:', {
          budget: budget.amount,
          spent,
          remaining,
          percentage
      });
      
      return {
          budget: budget.amount,
          spent,
          remaining,
          percentage,
          status: percentage >= 100 ? 'exceeded' : percentage >= 80 ? 'warning' : 'ok'
      };
  }

  getCategoryName(categoryId) {
      const category = this.state.categories.find(c => c.id === categoryId);
      return category ? category.name : '';
  }

  // Event system
  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);
    
    // Return unsubscribe function
    return () => {
      const keyListeners = this.listeners.get(key);
      if (keyListeners) {
        keyListeners.delete(callback);
        if (keyListeners.size === 0) {
          this.listeners.delete(key);
        }
      }
    };
  }

  notifyListeners(oldState, newState) {
      console.log('State: notifyListeners called');
      // Notify all listeners
      this.listeners.forEach((callbacks, key) => {
        const oldValue = oldState[key];
        const newValue = newState[key];
        
        console.log(`Checking key: ${key}, old:`, oldValue, 'new:', newValue, 'changed:', oldValue !== newValue);
        
        if (oldValue !== newValue) {
          console.log(`Notifying ${callbacks.size} listeners for key: ${key}`);
          callbacks.forEach(callback => {
            console.log('Calling callback for', key);
            callback(newValue, oldValue);
          });
        }
      });
  }

  // Transaction support for batch updates
  beginTransaction() {
    const id = ++this.transactionId;
    const transactionState = { ...this.state };
    
    return {
      id,
      update: (updates) => {
        transactionState = { ...transactionState, ...updates };
      },
      commit: () => {
        this.state = transactionState;
        this.notifyListeners({ ...this.state }, this.state);
      },
      rollback: () => {
        // Discard transaction
      }
    };
  }

  // Reset state
  reset() {
    const oldState = { ...this.state };
    this.state = {
      user: null,
      isAuthenticated: false,
      expenses: [],
      incomes: [],
      wallets: [],
      categories: [],
      //v5.2
      budgets: [],
      currentWalletId: null,
      activeTab: 'overview',
      activeModal: null,
      loading: false,
      filters: {
        month: new Date().getMonth(),
        year: new Date().getFullYear(),
        category: null,
        searchQuery: ''
      },
      pendingTransaction: null,
      editingItem: null
    };
    this.notifyListeners(oldState, this.state);
  }
}

// Create singleton instance
let stateInstance = null;

export const getState = () => {
  if (!stateInstance) {
    stateInstance = new FinTrackState();
  }
  return stateInstance;
};

