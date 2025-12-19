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

  // Expense-specific operations
  async createExpense(expenseData) {
    return await this.create('expenses', {
      description: expenseData.description,
      amount: expenseData.amount,
      date: expenseData.date,
      category: expenseData.category,
      subcategory: expenseData.subcategory,
      wallet_id: expenseData.walletId
    });
  }

  async getExpenses(filters = {}) {
    return await this.read('expenses', filters, { column: 'date', ascending: false });
  }

  async updateExpense(id, updates) {
    return await this.update('expenses', id, updates);
  }

  async deleteExpense(id) {
    return await this.delete('expenses', id);
  }

  // Income-specific operations
  async createIncome(incomeData) {
    return await this.create('incomes', {
      description: incomeData.description,
      amount: incomeData.amount,
      date: incomeData.date,
      source: incomeData.source,
      wallet_id: incomeData.walletId
    });
  }

  async getIncomes(filters = {}) {
    return await this.read('incomes', filters, { column: 'date', ascending: false });
  }

  async updateIncome(id, updates) {
    return await this.update('incomes', id, updates);
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
    const data = {
      name: categoryData.name,
      type: categoryData.type
    };
    
    if (categoryData.parentId && validationUtils.isValidUUID(categoryData.parentId)) {
      data.parent_id = categoryData.parentId;
    }
    
    return await this.create('categories', data);
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
}

// Create singleton instance
let databaseInstance = null;

export const getDatabase = (supabaseClient) => {
  if (!databaseInstance) {
    databaseInstance = new DatabaseService(supabaseClient);
  }
  return databaseInstance;
};