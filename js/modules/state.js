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
      const oldState = { ...this.state };
      this.state = { ...this.state, ...updates };
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
      const result = this.setState({ expenses });
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
      const result = this.setState({ activeTab: tab });
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
      
      const expenses = [...this.state.expenses, expense];
      
      const result = this.setExpenses(expenses);
      
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

  // Budget period: 26th of previous month to 25th of current month
  getCategoryBudgetStatus(categoryId, walletId) {
      const budget = this.state.budgets.find(
          b => b.category_id === categoryId && b.wallet_id === walletId
      );
      
      if (!budget) return null;
      
      const now = new Date();
      const currentDay = now.getDate();
      
      // Calculate budget period: 26th prev month to 25th current month
      let startDate, endDate;
      
      if (currentDay >= 26) {
          // We're in the period that started on the 26th of this month
          startDate = new Date(now.getFullYear(), now.getMonth(), 26, 0, 0, 0, 0);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 25, 23, 59, 59, 999);
      } else {
          // We're in the period that started on the 26th of last month
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 26, 0, 0, 0, 0);
          endDate = new Date(now.getFullYear(), now.getMonth(), 25, 23, 59, 59, 999);
      }
       
      // Get expenses for this category (exclude reimbursable ones)
      const expenses = this.state.expenses.filter(e => {
          const expenseDate = new Date(e.date);
          const matches = e.walletId === walletId &&
                e.category === this.getCategoryName(categoryId) &&
                expenseDate >= startDate &&
                expenseDate <= endDate &&
                !e.isReimbursable;
          return matches;
      });
      
      const spent = expenses.reduce((sum, e) => sum + e.amount, 0);
      const remaining = budget.amount - spent;
      const percentage = (spent / budget.amount) * 100;

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
      // Notify all listeners
      this.listeners.forEach((callbacks, key) => {
        const oldValue = oldState[key];
        const newValue = newState[key];

        if (oldValue !== newValue) {
          callbacks.forEach(callback => {
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

  // Get all pending reimbursable expenses for current wallet
  getPendingReimbursableExpenses() {
      const currentWalletId = this.state.currentWalletId;
      if (!currentWalletId) return [];
      
      return this.state.expenses.filter(expense => 
          expense.walletId === currentWalletId &&
          expense.isReimbursable === true &&
          expense.reimbursementStatus === 'pending'
      );
  }

  // Get total amount of pending reimbursements for current wallet
  getPendingReimbursementTotal() {
      const pending = this.getPendingReimbursableExpenses();
      return pending.reduce((sum, expense) => sum + expense.amount, 0);
  }

  // Check if an expense is reimbursed
  isExpenseReimbursed(expenseId) {
      const expense = this.state.expenses.find(e => e.id === expenseId);
      return expense?.reimbursementStatus === 'reimbursed';
  }

  // Get linked income for an expense
  getLinkedIncomeForExpense(expenseId) {
      const expense = this.state.expenses.find(e => e.id === expenseId);
      if (!expense || !expense.linkedIncomeId) return null;
      
      return this.state.incomes.find(i => i.id === expense.linkedIncomeId);
  }

  // Get linked expenses for an income
  getLinkedExpensesForIncome(incomeId) {
      const income = this.state.incomes.find(i => i.id === incomeId);
      if (!income || !income.linkedExpenseIds || income.linkedExpenseIds.length === 0) {
          return [];
      }
      
      return this.state.expenses.filter(e => 
          income.linkedExpenseIds.includes(e.id)
      );
  }

  // Check if an income is a reimbursement
  isIncomeReimbursement(incomeId) {
      const income = this.state.incomes.find(i => i.id === incomeId);
      return income?.isReimbursement === true;
  }

  // Update expense reimbursement status
  updateExpenseReimbursementStatus(expenseId, status, linkedIncomeId = null) {
      const expenseIndex = this.state.expenses.findIndex(e => e.id === expenseId);
      if (expenseIndex === -1) return;
      
      const expenses = [...this.state.expenses];
      expenses[expenseIndex] = {
          ...expenses[expenseIndex],
          reimbursementStatus: status,
          linkedIncomeId: linkedIncomeId
      };
      
      return this.setExpenses(expenses);
  }

  // Update income reimbursement data
  updateIncomeReimbursement(incomeId, linkedExpenseIds) {
      const incomeIndex = this.state.incomes.findIndex(i => i.id === incomeId);
      if (incomeIndex === -1) return;
      
      const incomes = [...this.state.incomes];
      incomes[incomeIndex] = {
          ...incomes[incomeIndex],
          isReimbursement: true,
          linkedExpenseIds: linkedExpenseIds
      };
      
      return this.setIncomes(incomes);
  }

  // Link reimbursement (update both expense and income)
  linkReimbursement(incomeId, expenseIds) {
      // Update income
      const incomes = this.state.incomes.map(income => 
          income.id === incomeId 
              ? { ...income, isReimbursement: true, linkedExpenseIds: expenseIds }
              : income
      );
      
      // Update expenses
      const expenses = this.state.expenses.map(expense => 
          expenseIds.includes(expense.id)
              ? { ...expense, reimbursementStatus: 'reimbursed', linkedIncomeId: incomeId }
              : expense
      );
      
      // Update both at once
      this.state = {
          ...this.state,
          expenses,
          incomes
      };
      
      // Notify listeners
      this.notifyListeners({ ...this.state }, this.state);
      
      return this.state;
  }

  // Unlink reimbursement (revert to pending)
  unlinkReimbursement(incomeId) {
      const income = this.state.incomes.find(i => i.id === incomeId);
      if (!income) return;
      
      const linkedExpenseIds = income.linkedExpenseIds || [];
      
      // Update income
      const incomes = this.state.incomes.map(i => 
          i.id === incomeId
              ? { ...i, isReimbursement: false, linkedExpenseIds: [] }
              : i
      );
      
      // Reset expenses to pending
      const expenses = this.state.expenses.map(expense => 
          linkedExpenseIds.includes(expense.id)
              ? { ...expense, reimbursementStatus: 'pending', linkedIncomeId: null }
              : expense
      );
      
      // Update both at once
      this.state = {
          ...this.state,
          expenses,
          incomes
      };
      
      // Notify listeners
      this.notifyListeners({ ...this.state }, this.state);
      
      return this.state;
  }

  // Get reimbursement statistics
  getReimbursementStats() {
      const currentWalletId = this.state.currentWalletId;
      if (!currentWalletId) {
          return {
              totalReimbursable: 0,
              pending: 0,
              reimbursed: 0,
              pendingAmount: 0,
              reimbursedAmount: 0
          };
      }
      
      const reimbursableExpenses = this.state.expenses.filter(e => 
          e.walletId === currentWalletId && e.isReimbursable
      );
      
      const pending = reimbursableExpenses.filter(e => e.reimbursementStatus === 'pending');
      const reimbursed = reimbursableExpenses.filter(e => e.reimbursementStatus === 'reimbursed');
      
      return {
          totalReimbursable: reimbursableExpenses.length,
          pending: pending.length,
          reimbursed: reimbursed.length,
          pendingAmount: pending.reduce((sum, e) => sum + e.amount, 0),
          reimbursedAmount: reimbursed.reduce((sum, e) => sum + e.amount, 0)
      };
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

