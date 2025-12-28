// js/modules/database.js

/**
 * DATABASE MODULE
 * Supabase CRUD operations and data management
 */

import { validationUtils } from './utils.js';

class DatabaseService {
  constructor(supabase) {
    this.supabase = supabase;
    this.user = null;
  }

  // User management
  setUser(user) {
    this.user = user;
  }

  getUser() {
    return this.user;
  }

  // Data transformation helpers
  toCamelCase(obj) {
    if (!obj) return obj;
    if (Array.isArray(obj)) return obj.map(item => this.toCamelCase(item));
    if (typeof obj !== 'object') return obj;

    const transformed = {};
    for (const [key, value] of Object.entries(obj)) {
      // Convert snake_case to camelCase
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      transformed[camelKey] = value;
    }
    return transformed;
  }

  toSnakeCase(obj) {
    if (!obj) return obj;
    if (Array.isArray(obj)) return obj.map(item => this.toSnakeCase(item));
    if (typeof obj !== 'object') return obj;

    const transformed = {};
    for (const [key, value] of Object.entries(obj)) {
      // Convert camelCase to snake_case
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      transformed[snakeKey] = value;
    }
    return transformed;
  }

  // Generic CRUD operations
  async create(table, data) {
    try {
      if (!this.user) throw new Error('User not authenticated');
      
      const { data: result, error } = await this.supabase
        .from(table)
        .insert([{ ...data, user_id: this.user.id }])
        .select()
        .single();
      
      if (error) throw error;
      return this.toCamelCase(result);
    } catch (error) {
      console.error(`Error creating ${table}:`, error);
      throw error;
    }
  }

  async read(table, filters = {}, orderBy = { column: 'created_at', ascending: false }) {
      try {
          if (!this.user) throw new Error('User not authenticated');
          
          let query = this.supabase
              .from(table)
              .select('*')
              .eq('user_id', this.user.id);
          
          // Apply filters - convert keys to snake_case
          Object.entries(filters).forEach(([key, value]) => {
              if (value !== undefined && value !== null) {
                  // Convert camelCase to snake_case
                  const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
                  query = query.eq(snakeKey, value);
              }
          });
          
          // Apply ordering
          if (orderBy) {
              query = query.order(orderBy.column, { ascending: orderBy.ascending });
          }
          
          const { data, error } = await query;
          
          if (error) throw error;
          return this.toCamelCase(data);
      } catch (error) {
          console.error(`Error reading ${table}:`, error);
          throw error;
      }
  }

  async update(table, id, updates) {
    try {
      if (!this.user) throw new Error('User not authenticated');
      
      const { data, error } = await this.supabase
        .from(table)
        .update(updates)
        .eq('id', id)
        .eq('user_id', this.user.id)
        .select()
        .single();
      
      if (error) throw error;
      return this.toCamelCase(data);
    } catch (error) {
      console.error(`Error updating ${table}:`, error);
      throw error;
    }
  }

  async delete(table, id) {
    try {
      if (!this.user) throw new Error('User not authenticated');
      
      const { error } = await this.supabase
        .from(table)
        .delete()
        .eq('id', id)
        .eq('user_id', this.user.id);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error(`Error deleting ${table}:`, error);
      throw error;
    }
  }

  //5.2
  async createExpense(expenseData) {
      try {
          if (!this.user) throw new Error('Not authenticated');

          const expenseRecord = {
              user_id: this.user.id,
              wallet_id: expenseData.walletId,
              description: expenseData.description,
              amount: expenseData.amount,
              date: expenseData.date,
              category: expenseData.category,
              subcategory: expenseData.subcategory || null,
              is_reimbursable: expenseData.isReimbursable || false,
              // NEW: Set reimbursement_status based on is_reimbursable
              reimbursement_status: expenseData.isReimbursable ? 'pending' : 'not_applicable'
          };
          
          if (expenseData.id) {
              // Update existing expense
              const { data, error } = await this.supabase
                  .from('expenses')
                  .update({
                      description: expenseRecord.description,
                      amount: expenseRecord.amount,
                      date: expenseRecord.date,
                      category: expenseRecord.category,
                      subcategory: expenseRecord.subcategory,
                      is_reimbursable: expenseRecord.is_reimbursable,
                      reimbursement_status: expenseRecord.reimbursement_status,
                      wallet_id: expenseRecord.wallet_id
                  })
                  .eq('id', expenseData.id)
                  .eq('user_id', this.user.id)
                  .select()
                  .single();
              
              if (error) {
                  console.error('createExpense - Update error:', error);
                  throw error;
              }
              return this.toCamelCase(data);
          } else {
              // Insert new expense
              const { data, error } = await this.supabase
                  .from('expenses')
                  .insert(expenseRecord)
                  .select()
                  .single();
              
              if (error) {
                  console.error('createExpense - Insert error:', error);
                  throw error;
              }
              return this.toCamelCase(data);
          }
      } catch (error) {
          console.error('createExpense - Fatal error:', error);
          throw error;
      }
  }

  async getExpenses(filters = {}) {
    return await this.read('expenses', filters, { column: 'date', ascending: false });
  }

  async updateExpense(id, updates) {
      try {
          if (!this.user) throw new Error('Not authenticated');
          
          // Build the update object with proper snake_case conversion
          const updateData = {};
          
          if (updates.description !== undefined) updateData.description = updates.description;
          if (updates.amount !== undefined) updateData.amount = updates.amount;
          if (updates.date !== undefined) updateData.date = updates.date;
          if (updates.category !== undefined) updateData.category = updates.category;
          if (updates.subcategory !== undefined) updateData.subcategory = updates.subcategory;
          if (updates.wallet_id !== undefined) updateData.wallet_id = updates.wallet_id;
          
          // ⭐ CRITICAL: Handle is_reimbursable field
          if (updates.is_reimbursable !== undefined) {
              updateData.is_reimbursable = updates.is_reimbursable;
              // Update reimbursement_status based on is_reimbursable
              updateData.reimbursement_status = updates.is_reimbursable ? 'pending' : 'not_applicable';
              console.log('🔧 DATABASE: Updating is_reimbursable to:', updates.is_reimbursable);
          }
          
          const { data, error } = await this.supabase
              .from('expenses')
              .update(updateData)
              .eq('id', id)
              .eq('user_id', this.user.id)
              .select()
              .single();
          
          if (error) {
              console.error('updateExpense - Error:', error);
              throw error;
          }
          
          console.log('✅ DATABASE: Expense updated successfully:', data);
          return this.toCamelCase(data);
      } catch (error) {
          console.error('updateExpense - Fatal error:', error);
          throw error;
      }
  }

  async deleteExpense(id) {
    return await this.delete('expenses', id);
  }

  // Income-specific operations
  async createIncome(incomeData) {
      try {
          if (!this.user) throw new Error('Not authenticated');
          
          const incomeRecord = {
              user_id: this.user.id,
              description: incomeData.description,
              amount: incomeData.amount,
              date: incomeData.date,
              source: incomeData.source,
              wallet_id: incomeData.walletId,
              // NEW: Add reimbursement fields
              is_reimbursement: incomeData.isReimbursement || false,
              linked_expense_ids: incomeData.linkedExpenseIds || []
          };
          
          if (incomeData.id) {
              // Update existing
              const { data, error } = await this.supabase
                  .from('incomes')
                  .update(incomeRecord)
                  .eq('id', incomeData.id)
                  .eq('user_id', this.user.id)
                  .select()
                  .single();
              
              if (error) throw error;
              return this.toCamelCase(data);
          } else {
              // Insert new
              const { data, error } = await this.supabase
                  .from('incomes')
                  .insert(incomeRecord)
                  .select()
                  .single();
              
              if (error) throw error;
              
              // If this is a reimbursement, link the expenses
              if (incomeData.isReimbursement && incomeData.linkedExpenseIds?.length > 0) {
                  await this.linkReimbursement(data.id, incomeData.linkedExpenseIds);
              }
              
              return this.toCamelCase(data);
          }
      } catch (error) {
          console.error('createIncome - Error:', error);
          throw error;
      }
  }

  async getIncomes(filters = {}) {
    return await this.read('incomes', filters, { column: 'date', ascending: false });
  }

  async updateIncome(id, updates) {
      try {
          if (!this.user) throw new Error('Not authenticated');
          
          // Build the update object with proper snake_case conversion
          const updateData = {};
          
          if (updates.description !== undefined) updateData.description = updates.description;
          if (updates.amount !== undefined) updateData.amount = updates.amount;
          if (updates.date !== undefined) updateData.date = updates.date;
          if (updates.source !== undefined) updateData.source = updates.source;
          if (updates.wallet_id !== undefined) updateData.wallet_id = updates.wallet_id;
          
          // ⭐ CRITICAL: Handle is_reimbursement and linked_expense_ids fields
          if (updates.isReimbursement !== undefined) {
              updateData.is_reimbursement = updates.isReimbursement;
              console.log('🔧 DATABASE: Updating income is_reimbursement to:', updates.isReimbursement);
          }
          
          if (updates.linkedExpenseIds !== undefined) {
              updateData.linked_expense_ids = updates.linkedExpenseIds;
              console.log('🔧 DATABASE: Updating linked_expense_ids to:', updates.linkedExpenseIds);
          }
          
          const { data, error } = await this.supabase
              .from('incomes')
              .update(updateData)
              .eq('id', id)
              .eq('user_id', this.user.id)
              .select()
              .single();
          
          if (error) {
              console.error('updateIncome - Error:', error);
              throw error;
          }
          
          console.log('✅ DATABASE: Income updated successfully');
          return this.toCamelCase(data);
      } catch (error) {
          console.error('updateIncome - Fatal error:', error);
          throw error;
      }
  }

  async deleteIncome(id) {
    return await this.delete('incomes', id);
  }

  // Wallet-specific operations
  async createWallet(walletData) {
      const data = { name: walletData.name };
      
      // If this is marked as default or it's the first wallet, set as default
      if (walletData.isDefault) {
          data.is_default = true;
      }
      
      const wallet = await this.create('wallets', data);
      
      // If this was set as default, unset others
      if (walletData.isDefault) {
          await this.supabase
              .from('wallets')
              .update({ is_default: false })
              .eq('user_id', this.user.id)
              .neq('id', wallet.id);
      }
      
      return wallet;
  }

  async getWallets() {
    return await this.read('wallets');
  }

  async updateWallet(id, updates) {
      const data = {};
      if (updates.name) data.name = updates.name;
      
      // Handle is_default if provided
      if (updates.isDefault !== undefined) {
          data.is_default = updates.isDefault;
          
          // If setting as default, unset others first
          if (updates.isDefault) {
              await this.supabase
                  .from('wallets')
                  .update({ is_default: false })
                  .eq('user_id', this.user.id)
                  .neq('id', id);
          }
      }
      
      return await this.update('wallets', id, data);
  }

  async deleteWallet(id) {
    return await this.delete('wallets', id);
  }

  async setDefaultWallet(walletId) {
    try {
      if (!this.user) throw new Error('User not authenticated');
      
      // First, unset all wallets as default
      await this.supabase
        .from('wallets')
        .update({ is_default: false })
        .eq('user_id', this.user.id);
      
      // Then set the selected wallet as default
      const { data, error } = await this.supabase
        .from('wallets')
        .update({ is_default: true })
        .eq('id', walletId)
        .eq('user_id', this.user.id)
        .select()
        .single();
      
      if (error) throw error;
      return this.toCamelCase(data);
    } catch (error) {
      console.error('Error setting default wallet:', error);
      throw error;
    }
  }

  async getDefaultWallet() {
    try {
      if (!this.user) throw new Error('User not authenticated');
      
      const { data, error } = await this.supabase
        .from('wallets')
        .select('*')
        .eq('user_id', this.user.id)
        .eq('is_default', true)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
      return data ? this.toCamelCase(data) : null;
    } catch (error) {
      console.error('Error getting default wallet:', error);
      return null;
    }
  }  

  // Category-specific operations
  async createCategory(categoryData) {
    try {
      if (!this.user) throw new Error('User not authenticated');
      
      const data = {
        name: categoryData.name,
        type: categoryData.type || 'main'
      };
      
      if (categoryData.parentId && validationUtils.isValidUUID(categoryData.parentId)) {
        data.parent_id = categoryData.parentId;
      } else {
        data.parent_id = null;
      }
      
      // Check if we're updating an existing category
      if (categoryData.id && validationUtils.isValidUUID(categoryData.id)) {
        // UPDATE existing category
        const { data: result, error } = await this.supabase
          .from('categories')
          .update(data)
          .eq('id', categoryData.id)
          .eq('user_id', this.user.id)
          .select()
          .single();
        
        if (error) throw error;
        return this.toCamelCase(result);
      } else {
        // INSERT new category
        const { data: result, error } = await this.supabase
          .from('categories')
          .insert([{ ...data, user_id: this.user.id }])
          .select()
          .single();
        
        if (error) throw error;
        return this.toCamelCase(result);
      }
    } catch (error) {
      console.error('Error in createCategory:', error);
      throw error;
    }
  }

  async getCategories() {
    return await this.read('categories', {}, { column: 'created_at', ascending: true });
  }

  async updateCategory(id, updates) {
    return await this.update('categories', id, updates);
  }

  async deleteCategory(id) {
    return await this.delete('categories', id);
  }

  // Aggregated queries
  async getMonthlySummary(month, year, walletId = null) {
    try {
      if (!this.user) throw new Error('User not authenticated');
      
      // Get start and end dates for the month
      const startDate = new Date(year, month, 1).toISOString();
      const endDate = new Date(year, month + 1, 0).toISOString();
      
      // Build expense query
      let expenseQuery = this.supabase
        .from('expenses')
        .select('amount')
        .eq('user_id', this.user.id)
        .gte('date', startDate)
        .lte('date', endDate);
      
      if (walletId) {
        expenseQuery = expenseQuery.eq('wallet_id', walletId);
      }
      
      // Build income query
      let incomeQuery = this.supabase
        .from('incomes')
        .select('amount')
        .eq('user_id', this.user.id)
        .gte('date', startDate)
        .lte('date', endDate);
      
      if (walletId) {
        incomeQuery = incomeQuery.eq('wallet_id', walletId);
      }
      
      // Execute both queries in parallel
      const [expensesResult, incomesResult] = await Promise.all([
        expenseQuery,
        incomeQuery
      ]);
      
      if (expensesResult.error) throw expensesResult.error;
      if (incomesResult.error) throw incomesResult.error;
      
      const totalExpenses = expensesResult.data.reduce((sum, item) => sum + item.amount, 0);
      const totalIncomes = incomesResult.data.reduce((sum, item) => sum + item.amount, 0);
      
      return {
        expenses: totalExpenses,
        incomes: totalIncomes,
        balance: totalIncomes - totalExpenses,
        expenseCount: expensesResult.data.length,
        incomeCount: incomesResult.data.length
      };
    } catch (error) {
      console.error('Error getting monthly summary:', error);
      throw error;
    }
  }

  // Batch operations
  async batchDeleteExpenses(expenseIds) {
    try {
      if (!this.user) throw new Error('User not authenticated');
      
      const { error } = await this.supabase
        .from('expenses')
        .delete()
        .in('id', expenseIds)
        .eq('user_id', this.user.id);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error batch deleting expenses:', error);
      throw error;
    }
  }

  // v5.2
  async createBudget(budgetData) {
      try {
          // Use the stored user instead of calling getUser()
          if (!this.user) throw new Error('Not authenticated');
          
          // Check for existing budget first
          const { data: existingBudget, error: checkError } = await this.supabase
              .from('budgets')
              .select('id')
              .eq('user_id', this.user.id)
              .eq('wallet_id', budgetData.walletId)
              .eq('category_id', budgetData.categoryId)
              .maybeSingle(); // Use maybeSingle() instead of single() to avoid error if not found
          
          if (checkError && checkError.code !== 'PGRST116') {
              console.error('createBudget - Check error:', checkError);
              throw checkError;
          }
          
          const budgetRecord = {
              user_id: this.user.id,
              wallet_id: budgetData.walletId,
              category_id: budgetData.categoryId,
              amount: budgetData.amount,
              period: budgetData.period || 'monthly',
              start_date: budgetData.startDate || new Date().toISOString().split('T')[0],
              updated_at: new Date().toISOString()
          };
          
          let result;
          
          if (existingBudget) {
              const { data, error } = await this.supabase
                  .from('budgets')
                  .update({
                      amount: budgetRecord.amount,
                      period: budgetRecord.period,
                      start_date: budgetRecord.start_date,
                      updated_at: budgetRecord.updated_at
                  })
                  .eq('id', existingBudget.id)
                  .select('*, categories(name, type)')
                  .single();
              
              if (error) {
                  console.error('createBudget - Update error:', error);
                  throw error;
              }
              result = data;
          } else {
              const { data, error } = await this.supabase
                  .from('budgets')
                  .insert(budgetRecord)
                  .select('*, categories(name, type)')
                  .single();
              
              if (error) {
                  console.error('createBudget - Insert error:', error);
                  throw error;
              }
              result = data;
          }
          return result;
          
      } catch (error) {
          console.error('createBudget - Fatal error:', error);
          throw error;
      }
  }

  // Also update getBudgets to use this.user instead of getUser():
  async getBudgets() {
      try {
          if (!this.user) return [];
          
          const { data, error } = await this.supabase
              .from('budgets')
              .select('*, categories(name, type)')
              .eq('user_id', this.user.id);
          
          if (error) {
              console.error('getBudgets - Error:', error);
              throw error;
          }
          return data || [];
      } catch (error) {
          console.error('getBudgets - Fatal error:', error);
          return [];
      }
  }

  // Also update deleteBudget to be consistent:
  async deleteBudget(id) {
      try {
          if (!this.user) throw new Error('Not authenticated');
          
          const { error } = await this.supabase
              .from('budgets')
              .delete()
              .eq('id', id)
              .eq('user_id', this.user.id); // Add user_id check for security
          
          if (error) {
              console.error('deleteBudget - Error:', error);
              throw error;
          }
          return true;
      } catch (error) {
          console.error('deleteBudget - Fatal error:', error);
          throw error;
      }
  }

  async getPendingReimbursableExpenses(walletId) {
      try {
          const { data, error } = await this.supabase
              .from('expenses')
              .select('*')
              .eq('wallet_id', walletId)
              .eq('user_id', this.user.id)
              .eq('is_reimbursable', true)
              .eq('reimbursement_status', 'pending')
              .order('date', { ascending: false });

          if (error) throw error;
          return this.toCamelCase(data) || [];
      } catch (error) {
          console.error('Error fetching pending reimbursable expenses:', error);
          throw error;
      }
  }

  // Link income with expenses (mark as reimbursed)
  async linkReimbursement(incomeId, expenseIds) {
      try {
          // 1. Update income to mark as reimbursement
          const { data: incomeData, error: incomeError } = await this.supabase
              .from('incomes')
              .update({
                  is_reimbursement: true,
                  linked_expense_ids: expenseIds
              })
              .eq('id', incomeId)
              .eq('user_id', this.user.id)
              .select()
              .single();

          if (incomeError) throw incomeError;

          // 2. Update each expense to link to this income
          const { data: expenseData, error: expenseError } = await this.supabase
              .from('expenses')
              .update({
                  reimbursement_status: 'reimbursed',
                  linked_income_id: incomeId
              })
              .in('id', expenseIds)
              .eq('user_id', this.user.id)
              .select();

          if (expenseError) throw expenseError;

          return {
              income: this.toCamelCase(incomeData),
              expenses: this.toCamelCase(expenseData)
          };
      } catch (error) {
          console.error('Error linking reimbursement:', error);
          throw error;
      }
  }

  // Unlink reimbursement (revert to pending)
  async unlinkReimbursement(incomeId) {
      try {
          // 1. Get the income to find linked expenses
          const { data: income, error: fetchError } = await this.supabase
              .from('incomes')
              .select('linked_expense_ids')
              .eq('id', incomeId)
              .eq('user_id', this.user.id)
              .single();

          if (fetchError) throw fetchError;

          const expenseIds = income.linked_expense_ids || [];

          // 2. Reset expenses to pending
          if (expenseIds.length > 0) {
              const { error: expenseError } = await this.supabase
                  .from('expenses')
                  .update({
                      reimbursement_status: 'pending',
                      linked_income_id: null
                  })
                  .in('id', expenseIds)
                  .eq('user_id', this.user.id);

              if (expenseError) throw expenseError;
          }

          // 3. Reset income
          const { data: incomeData, error: incomeError } = await this.supabase
              .from('incomes')
              .update({
                  is_reimbursement: false,
                  linked_expense_ids: []
              })
              .eq('id', incomeId)
              .eq('user_id', this.user.id)
              .select()
              .single();

          if (incomeError) throw incomeError;

          return this.toCamelCase(incomeData);
      } catch (error) {
          console.error('Error unlinking reimbursement:', error);
          throw error;
      }
  }

  // Get linked income for an expense
  async getLinkedIncome(expenseId) {
      try {
          const { data: expense, error: expenseError } = await this.supabase
              .from('expenses')
              .select('linked_income_id')
              .eq('id', expenseId)
              .eq('user_id', this.user.id)
              .single();

          if (expenseError) throw expenseError;

          if (!expense.linked_income_id) return null;

          const { data: income, error: incomeError } = await this.supabase
              .from('incomes')
              .select('*')
              .eq('id', expense.linked_income_id)
              .eq('user_id', this.user.id)
              .single();

          if (incomeError) throw incomeError;

          return this.toCamelCase(income);
      } catch (error) {
          console.error('Error fetching linked income:', error);
          throw error;
      }
  }

  // Get linked expenses for an income
  async getLinkedExpenses(incomeId) {
      try {
          const { data: income, error: incomeError } = await this.supabase
              .from('incomes')
              .select('linked_expense_ids')
              .eq('id', incomeId)
              .eq('user_id', this.user.id)
              .single();

          if (incomeError) throw incomeError;

          const expenseIds = income.linked_expense_ids || [];
          if (expenseIds.length === 0) return [];

          const { data: expenses, error: expensesError } = await this.supabase
              .from('expenses')
              .select('*')
              .in('id', expenseIds)
              .eq('user_id', this.user.id)
              .order('date', { ascending: false });

          if (expensesError) throw expensesError;

          return this.toCamelCase(expenses);
      } catch (error) {
          console.error('Error fetching linked expenses:', error);
          throw error;
      }
  }

  // Get total pending reimbursement amount for a wallet
  async getPendingReimbursementTotal(walletId) {
      try {
          const { data, error } = await this.supabase
              .from('expenses')
              .select('amount')
              .eq('wallet_id', walletId)
              .eq('user_id', this.user.id)
              .eq('is_reimbursable', true)
              .eq('reimbursement_status', 'pending');

          if (error) throw error;

          const total = (data || []).reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
          return total;
      } catch (error) {
          console.error('Error calculating pending reimbursement total:', error);
          throw error;
      }
  }

}

// Create singleton instance
let databaseInstance = null;

export const getDatabase = (supabaseClient) => {
  if (!databaseInstance) {
    databaseInstance = new DatabaseService(supabaseClient);
  }
  return databaseInstance;
};