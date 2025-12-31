// js/modules/export.js

/**
 * EXPORT SERVICE MODULE
 * Handles data export to CSV, Excel, and PDF formats
 */

import { currencyUtils, dateUtils } from './utils.js';
import { getState } from './state.js';

class ExportService {
    constructor() {
        this.state = getState();
    }

    /**
     * Export expenses to CSV
     */
    exportExpensesToCSV(filters = {}) {
        const expenses = this.getFilteredExpenses(filters);
        
        if (expenses.length === 0) {
            throw new Error('No expenses to export for the selected period');
        }

        const csvData = expenses.map(expense => ({
            'Date': this.formatDate(expense.date),
            'Description': expense.description,
            'Amount': expense.amount,
            'Category': expense.category || 'Uncategorized',
            'Subcategory': expense.subcategory || '-',
            'Wallet': this.getWalletName(expense.walletId),
            'Reimbursable': expense.isReimbursable ? 'Yes' : 'No',
            'Status': this.getReimbursementStatus(expense),
            'Type': 'Expense'
        }));

        const filename = this.generateFilename('expenses', filters);
        this.downloadCSV(csvData, filename);
        return expenses.length;
    }

    /**
     * Export incomes to CSV
     */
    exportIncomesToCSV(filters = {}) {
        const incomes = this.getFilteredIncomes(filters);
        
        if (incomes.length === 0) {
            throw new Error('No income to export for the selected period');
        }

        const csvData = incomes.map(income => ({
            'Date': this.formatDate(income.date),
            'Description': income.description,
            'Amount': income.amount,
            'Source': income.source || 'Other',
            'Wallet': this.getWalletName(income.walletId),
            'Is Reimbursement': income.isReimbursement ? 'Yes' : 'No',
            'Type': 'Income'
        }));

        const filename = this.generateFilename('income', filters);
        this.downloadCSV(csvData, filename);
        return incomes.length;
    }

    /**
     * Export both expenses and incomes to CSV
     */
    exportAllTransactionsToCSV(filters = {}) {
        const expenses = this.getFilteredExpenses(filters);
        const incomes = this.getFilteredIncomes(filters);
        
        if (expenses.length === 0 && incomes.length === 0) {
            throw new Error('No transactions to export for the selected period');
        }

        // Map expenses
        const expenseData = expenses.map(expense => ({
            'Date': this.formatDate(expense.date),
            'Type': 'Expense',
            'Description': expense.description,
            'Amount': -expense.amount, // Negative for expenses
            'Category/Source': expense.category || 'Uncategorized',
            'Subcategory': expense.subcategory || '-',
            'Wallet': this.getWalletName(expense.walletId),
            'Reimbursable': expense.isReimbursable ? 'Yes' : 'No',
            'Status': this.getReimbursementStatus(expense)
        }));

        // Map incomes
        const incomeData = incomes.map(income => ({
            'Date': this.formatDate(income.date),
            'Type': 'Income',
            'Description': income.description,
            'Amount': income.amount, // Positive for income
            'Category/Source': income.source || 'Other',
            'Subcategory': '-',
            'Wallet': this.getWalletName(income.walletId),
            'Reimbursable': '-',
            'Status': income.isReimbursement ? 'Reimbursement' : '-'
        }));

        // Combine and sort by date
        const allData = [...expenseData, ...incomeData].sort((a, b) => 
            new Date(b.Date) - new Date(a.Date)
        );

        const filename = this.generateFilename('all-transactions', filters);
        this.downloadCSV(allData, filename);
        return expenses.length + incomes.length;
    }

    /**
     * Export summary report with statistics
     */
    exportSummaryToCSV(filters = {}) {
        const expenses = this.getFilteredExpenses(filters);
        const incomes = this.getFilteredIncomes(filters);

        const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
        const totalIncome = incomes.reduce((sum, i) => sum + i.amount, 0);
        const balance = totalIncome - totalExpenses;

        // Category breakdown
        const categoryBreakdown = {};
        expenses.forEach(expense => {
            const cat = expense.category || 'Uncategorized';
            if (!categoryBreakdown[cat]) {
                categoryBreakdown[cat] = 0;
            }
            categoryBreakdown[cat] += expense.amount;
        });

        // Build summary data
        const summaryData = [
            { 'Metric': 'Total Income', 'Value': totalIncome },
            { 'Metric': 'Total Expenses', 'Value': totalExpenses },
            { 'Metric': 'Net Balance', 'Value': balance },
            { 'Metric': 'Number of Expenses', 'Value': expenses.length },
            { 'Metric': 'Number of Incomes', 'Value': incomes.length },
            { 'Metric': '', 'Value': '' }, // Empty row
            { 'Metric': 'EXPENSES BY CATEGORY', 'Value': '' }
        ];

        // Add category breakdown
        Object.entries(categoryBreakdown)
            .sort((a, b) => b[1] - a[1])
            .forEach(([category, amount]) => {
                const percentage = ((amount / totalExpenses) * 100).toFixed(1);
                summaryData.push({
                    'Metric': category,
                    'Value': amount,
                    'Percentage': percentage + '%'
                });
            });

        const filename = this.generateFilename('summary', filters);
        this.downloadCSV(summaryData, filename);
        return 1;
    }

    /**
     * Export budgets to CSV
     */
    exportBudgetsToCSV() {
        const budgets = this.state.getBudgets();
        const walletId = this.state.getState().currentWalletId;

        if (budgets.length === 0) {
            throw new Error('No budgets to export');
        }

        const csvData = budgets
            .filter(b => b.wallet_id === walletId)
            .map(budget => {
                const categoryName = budget.categories?.name || 'Unknown';
                const status = this.state.getCategoryBudgetStatus(budget.category_id, walletId);
                
                return {
                    'Category': categoryName,
                    'Budget Limit': budget.amount,
                    'Spent': status?.spent || 0,
                    'Remaining': status?.remaining || 0,
                    'Percentage Used': status ? Math.round(status.percentage) + '%' : '0%',
                    'Status': status?.status || 'ok',
                    'Period': budget.period || 'monthly'
                };
            });

        const filename = `fintrack-budgets-${this.getCurrentDateString()}.csv`;
        this.downloadCSV(csvData, filename);
        return csvData.length;
    }

    // ==================== HELPER METHODS ====================

    /**
     * Filter expenses based on date range and wallet
     */
    getFilteredExpenses(filters) {
        let expenses = this.state.getExpenses();

        // Filter by wallet
        const walletId = filters.walletId || this.state.getState().currentWalletId;
        if (walletId) {
            expenses = expenses.filter(e => e.walletId === walletId);
        }

        // Filter by date range
        if (filters.dateRange) {
            expenses = this.filterByDateRange(expenses, filters.dateRange, filters.startDate, filters.endDate);
        }

        return expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    /**
     * Filter incomes based on date range and wallet
     */
    getFilteredIncomes(filters) {
        let incomes = this.state.getIncomes();

        // Filter by wallet
        const walletId = filters.walletId || this.state.getState().currentWalletId;
        if (walletId) {
            incomes = incomes.filter(i => i.walletId === walletId);
        }

        // Filter by date range
        if (filters.dateRange) {
            incomes = this.filterByDateRange(incomes, filters.dateRange, filters.startDate, filters.endDate);
        }

        return incomes.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    /**
     * Filter data by date range
     */
    filterByDateRange(data, rangeType, customStart, customEnd) {
        const now = new Date();
        let startDate, endDate;

        switch (rangeType) {
            case 'this-month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = now;
                break;
            
            case 'last-month':
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                endDate = new Date(now.getFullYear(), now.getMonth(), 0);
                break;
            
            case 'last-3-months':
                startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
                endDate = now;
                break;
            
            case 'last-6-months':
                startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
                endDate = now;
                break;
            
            case 'this-year':
                startDate = new Date(now.getFullYear(), 0, 1);
                endDate = now;
                break;
            
            case 'last-year':
                startDate = new Date(now.getFullYear() - 1, 0, 1);
                endDate = new Date(now.getFullYear() - 1, 11, 31);
                break;
            
            case 'custom':
                if (customStart && customEnd) {
                    startDate = new Date(customStart);
                    endDate = new Date(customEnd);
                } else {
                    return data; // No filter if custom dates not provided
                }
                break;
            
            case 'all-time':
            default:
                return data;
        }

        return data.filter(item => {
            const itemDate = new Date(item.date);
            return itemDate >= startDate && itemDate <= endDate;
        });
    }

    /**
     * Get wallet name by ID
     */
    getWalletName(walletId) {
        const wallet = this.state.getWallets().find(w => w.id === walletId);
        return wallet ? wallet.name : 'Unknown';
    }

    /**
     * Get reimbursement status text
     */
    getReimbursementStatus(expense) {
        if (!expense.isReimbursable) return 'Not Reimbursable';
        if (expense.reimbursementStatus === 'reimbursed') return 'Reimbursed';
        if (expense.reimbursementStatus === 'pending') return 'Pending';
        return '-';
    }

    /**
     * Format date for export
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    /**
     * Generate filename based on export type and filters
     */
    generateFilename(type, filters) {
        const dateStr = this.getCurrentDateString();
        const wallet = this.getWalletName(filters.walletId || this.state.getState().currentWalletId);
        const range = filters.dateRange || 'all-time';
        
        return `fintrack-${type}-${wallet.replace(/\s+/g, '-')}-${range}-${dateStr}.csv`;
    }

    /**
     * Get current date string for filename
     */
    getCurrentDateString() {
        const now = new Date();
        return now.toISOString().split('T')[0];
    }

    /**
     * Download CSV file
     */
    downloadCSV(data, filename) {
        // Use Papa Parse to convert to CSV
        const csv = Papa.unparse(data, {
            quotes: true,
            header: true
        });

        // Create blob and download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Create singleton instance
let exportInstance = null;

export const getExportService = () => {
    if (!exportInstance) {
        exportInstance = new ExportService();
    }
    return exportInstance;
};

export const initializeExport = () => {
    return getExportService();
};