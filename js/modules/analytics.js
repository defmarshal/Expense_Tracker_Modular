// js/modules/analytics.js

import { getState } from './state.js';
import { getDatabase } from './database.js';
import { currencyUtils, dateUtils, asyncUtils } from './utils.js';

/**
 * Analytics data processing module
 */
class AnalyticsService {
    constructor() {
        this.state = getState();
        this.db = null;
        this.cache = {
            periodData: new Map(),
            chartData: new Map(),
            lastUpdate: Date.now()
        };
        this.charts = {
            category: null,
            trend: null,
            comparison: null
        };
    }

    // Initialize with database
    initialize(database) {
        this.db = database;
        return this;
    }

    // Data caching with expiration (5 minutes)
    cacheData(key, data) {
        this.cache[key] = {
            data,
            timestamp: Date.now()
        };
        return data;
    }

    getCachedData(key, maxAge = 300000) { // 5 minutes default
        const cached = this.cache[key];
        if (cached && (Date.now() - cached.timestamp) < maxAge) {
            return cached.data;
        }
        return null;
    }

    // Period calculations (26th-25th system)
    calculatePeriodDates(periodKey) {
        const [year, month] = periodKey.split('-').map(Number);
        
        let startYear = year;
        let startMonth = month - 1;
        if (startMonth === 0) {
            startMonth = 12;
            startYear = year - 1;
        }
        
        const endDate = new Date(year, month - 1, 25, 23, 59, 59);
        const startDate = new Date(startYear, startMonth - 1, 26);
        
        return { startDate, endDate };
    }

// Calculate date range based on preset
    calculateDateRange(rangeType) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let startDate, endDate;

        switch (rangeType) {
            case 'last-7':
                startDate = new Date(today);
                startDate.setDate(today.getDate() - 6);
                endDate = today;
                break;
            
            case 'last-30':
                startDate = new Date(today);
                startDate.setDate(today.getDate() - 29);
                endDate = today;
                break;
            
            case 'this-month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = today;
                break;
            
            case 'last-month':
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                endDate = new Date(now.getFullYear(), now.getMonth(), 0);
                break;
            
            case 'last-3-months':
                startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
                endDate = today;
                break;
            
            case 'last-6-months':
                startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
                endDate = today;
                break;
            
            case 'year-to-date':
                startDate = new Date(now.getFullYear(), 0, 1);
                endDate = today;
                break;
            
            default:
                return null;
        }

        return { startDate, endDate };
    }

    // Filter data by date range
    filterDataByDateRange(data, startDate, endDate, walletId = 'all') {
        return data.filter(item => {
            // Filter by wallet
            if (walletId !== 'all' && item.walletId !== walletId) {
                return false;
            }
            // Filter by date range
            const itemDate = new Date(item.date);
            return itemDate >= startDate && itemDate <= endDate;
        });
    }

    // Calculate summary for date range
    calculateSummaryByDateRange(startDate, endDate, walletId = 'all') {
        const expenses = this.filterDataByDateRange(this.state.getExpenses(), startDate, endDate, walletId);
        const incomes = this.filterDataByDateRange(this.state.getIncomes(), startDate, endDate, walletId);
        
        const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
        const totalIncome = incomes.reduce((sum, i) => sum + i.amount, 0);
        const balance = totalIncome - totalExpenses;
        
        return {
            expenses: totalExpenses,
            income: totalIncome,
            balance,
            expenseCount: expenses.length,
            incomeCount: incomes.length
        };
    }

    // Calculate category breakdown for date range
    calculateCategoryBreakdownByDateRange(startDate, endDate, walletId = 'all') {
        const expenses = this.filterDataByDateRange(this.state.getExpenses(), startDate, endDate, walletId);
        const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
        
        const categories = {};
        
        expenses.forEach(expense => {
            const category = expense.category || 'Uncategorized';
            const subcategory = expense.subcategory || 'General';
            
            if (!categories[category]) {
                categories[category] = {
                    total: 0,
                    percentage: 0,
                    subcategories: {}
                };
            }
            
            if (!categories[category].subcategories[subcategory]) {
                categories[category].subcategories[subcategory] = {
                    total: 0,
                    percentage: 0,
                    expenses: []
                };
            }
            
            categories[category].total += expense.amount;
            categories[category].subcategories[subcategory].total += expense.amount;
            categories[category].subcategories[subcategory].expenses.push(expense);
        });
        
        // Calculate percentages
        Object.keys(categories).forEach(category => {
            categories[category].percentage = Math.round((categories[category].total / totalExpenses) * 100);
            
            Object.keys(categories[category].subcategories).forEach(subcategory => {
                categories[category].subcategories[subcategory].percentage = 
                    Math.round((categories[category].subcategories[subcategory].total / categories[category].total) * 100);
            });
        });
        
        const label = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        
        return {
            categories,
            totalExpenses,
            periodLabel: label
        };
    }

    // Format date range label
    formatDateRangeLabel(startDate, endDate) {
        return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }    

    isDateInPeriod(dateString, periodKey) {
        const { startDate, endDate } = this.calculatePeriodDates(periodKey);
        const checkDate = new Date(dateString);
        return checkDate >= startDate && checkDate <= endDate;
    }

    getPeriodLabel(periodKey) {
        const [year, month] = periodKey.split('-').map(Number);
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        
        let prevMonth = month - 1;
        let prevYear = year;
        if (prevMonth === 0) {
            prevMonth = 12;
            prevYear = year - 1;
        }
        
        return `${monthNames[prevMonth - 1]} 26 - ${monthNames[month - 1]} 25`;
    }

    // Generate period key from date
    getPeriodKeyFromDate(dateString) {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        
        if (day >= 26) {
            let nextMonth = month + 1;
            let nextYear = year;
            if (nextMonth > 12) {
                nextMonth = 1;
                nextYear = year + 1;
            }
            return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
        } else {
            return `${year}-${String(month).padStart(2, '0')}`;
        }
    }

    // Get available periods from data
    generateAvailablePeriods() {
        const expenses = this.state.getExpenses();
        const incomes = this.state.getIncomes();
        const allDates = [...expenses.map(e => e.date), ...incomes.map(i => i.date)];
        
        const periodKeysSet = new Set();
        allDates.forEach(dateStr => {
            const periodKey = this.getPeriodKeyFromDate(dateStr);
            periodKeysSet.add(periodKey);
        });
        
        return Array.from(periodKeysSet).sort().reverse();
    }

    // Filter data by wallet and period
    filterDataByPeriodAndWallet(data, periodKey, walletId = 'all') {
        return data.filter(item => {
            // Filter by wallet
            if (walletId !== 'all' && item.walletId !== walletId) {
                return false;
            }
            // Filter by period
            return this.isDateInPeriod(item.date, periodKey);
        });
    }

    // Calculate summary statistics
    calculateSummary(periodKey, walletId = 'all') {
        const expenses = this.filterDataByPeriodAndWallet(this.state.getExpenses(), periodKey, walletId);
        const incomes = this.filterDataByPeriodAndWallet(this.state.getIncomes(), periodKey, walletId);
        
        const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
        const totalIncome = incomes.reduce((sum, i) => sum + i.amount, 0);
        const balance = totalIncome - totalExpenses;
        
        return {
            expenses: totalExpenses,
            income: totalIncome,
            balance,
            expenseCount: expenses.length,
            incomeCount: incomes.length
        };
    }

    // Calculate category breakdown
    calculateCategoryBreakdown(periodKey, walletId = 'all') {
        const expenses = this.filterDataByPeriodAndWallet(this.state.getExpenses(), periodKey, walletId);
        const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
        
        const categories = {};
        
        expenses.forEach(expense => {
            const category = expense.category || 'Uncategorized';
            const subcategory = expense.subcategory || 'General';
            
            if (!categories[category]) {
                categories[category] = {
                    total: 0,
                    percentage: 0,
                    subcategories: {}
                };
            }
            
            if (!categories[category].subcategories[subcategory]) {
                categories[category].subcategories[subcategory] = {
                    total: 0,
                    percentage: 0,
                    expenses: []
                };
            }
            
            categories[category].total += expense.amount;
            categories[category].subcategories[subcategory].total += expense.amount;
            categories[category].subcategories[subcategory].expenses.push(expense);
        });
        
        // Calculate percentages
        Object.keys(categories).forEach(category => {
            categories[category].percentage = Math.round((categories[category].total / totalExpenses) * 100);
            
            Object.keys(categories[category].subcategories).forEach(subcategory => {
                categories[category].subcategories[subcategory].percentage = 
                    Math.round((categories[category].subcategories[subcategory].total / categories[category].total) * 100);
            });
        });
        
        return {
            categories,
            totalExpenses,
            periodLabel: this.getPeriodLabel(periodKey)
        };
    }

// js/modules/analytics.js - Replace calculateTrendData method with cumulative version

    calculateTrendData(endPeriodKey, periodCount = 12, walletId = 'all') {
            if (!endPeriodKey) return { 
                periods: [], 
                labels: [], 
                income: [], 
                expense: []
            };
            
            const allPeriods = this.generateAvailablePeriods().sort();
            let endIndex = allPeriods.indexOf(endPeriodKey);
            if (endIndex === -1) endIndex = allPeriods.length - 1;
            
            const startIndex = Math.max(0, endIndex - periodCount + 1);
            const trendPeriods = allPeriods.slice(startIndex, endIndex + 1);
            
            console.log('Trend periods for yearly comparison:', {
                startIndex,
                endIndex,
                trendPeriods
            });
            
            // Calculate PERIOD TOTALS (non-cumulative)
            const periodIncomeData = trendPeriods.map(periodKey => {
                const periodIncomes = this.filterDataByPeriodAndWallet(
                    this.state.getIncomes(), 
                    periodKey, 
                    walletId
                );
                return periodIncomes.reduce((sum, income) => sum + income.amount, 0);
            });
            
            const periodExpenseData = trendPeriods.map(periodKey => {
                const periodExpenses = this.filterDataByPeriodAndWallet(
                    this.state.getExpenses(), 
                    periodKey, 
                    walletId
                );
                return periodExpenses.reduce((sum, expense) => sum + expense.amount, 0);
            });
            
            const labels = trendPeriods.map(periodKey => {
                const [year, month] = periodKey.split('-');
                return new Date(year, month - 1).toLocaleDateString('en-US', { 
                    month: 'short', 
                    year: '2-digit' 
                });
            });
            
            return { 
                periods: trendPeriods, 
                labels, 
                income: periodIncomeData,
                expense: periodExpenseData
            };
        }

    // Calculate insights
    calculateInsights(periodKey, walletId = 'all') {
        const summary = this.calculateSummary(periodKey, walletId);
        const categoryBreakdown = this.calculateCategoryBreakdown(periodKey, walletId);
        
        // Savings rate
        const savingsRate = summary.income > 0 ? 
            Math.round(((summary.income - summary.expenses) / summary.income) * 100) : 0;
        
        // Top category
        let topCategory = '-';
        let topCategoryAmount = 0;
        
        Object.keys(categoryBreakdown.categories).forEach(category => {
            if (categoryBreakdown.categories[category].total > topCategoryAmount) {
                topCategory = category;
                topCategoryAmount = categoryBreakdown.categories[category].total;
            }
        });
        
        // Average spending
        const allPeriods = this.generateAvailablePeriods().sort();
        const currentIndex = allPeriods.indexOf(periodKey);
        const startIndex = Math.max(0, currentIndex - 6);
        const lastSixPeriods = allPeriods.slice(startIndex, currentIndex + 1);
        
        const periodTotals = lastSixPeriods.map(p => {
            const periodExpenses = this.filterDataByPeriodAndWallet(this.state.getExpenses(), p, walletId);
            return periodExpenses.reduce((sum, e) => sum + e.amount, 0);
        });
        
        const periodAverage = periodTotals.length > 0 ? 
            periodTotals.reduce((sum, amount) => sum + amount, 0) / periodTotals.length : 0;
        
        return {
            savingsRate,
            topCategory,
            topCategoryAmount,
            periodAverage: Math.round(periodAverage),
            periodCount: lastSixPeriods.length
        };
    }

    getDailyExpenseData(periodKey, walletId = 'all') {
        const { startDate, endDate } = this.calculatePeriodDates(periodKey);
        const daysInPeriod = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        const dailyData = Array(daysInPeriod).fill(0);
        
        const periodExpenses = this.filterDataByPeriodAndWallet(
            this.state.getExpenses(), 
            periodKey, 
            walletId
        );
        
        periodExpenses.forEach(expense => {
            const expenseDate = new Date(expense.date);
            const dayIndex = Math.floor((expenseDate - startDate) / (1000 * 60 * 60 * 24));
            if (dayIndex >= 0 && dayIndex < daysInPeriod) {
                dailyData[dayIndex] += expense.amount;
            }
        });
        
        return dailyData;
    }

    getDaysInPeriod(periodKey) {
        const { startDate, endDate } = this.calculatePeriodDates(periodKey);
        const days = [];
        const current = new Date(startDate);
        
        while (current <= endDate) {
            days.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }
        
        return days;
    }

    getDailyComparisonData(periodKey, periodCount = 6, walletId = 'all') {
        if (!periodKey) return null;
        
        const currentPeriodDays = this.getDaysInPeriod(periodKey);
        const daysInCurrentPeriod = currentPeriodDays.length;
        const currentPeriodDaily = this.getDailyExpenseData(periodKey, walletId);
        
        const periods = this.generateAvailablePeriods().sort();
        const currentIndex = periods.indexOf(periodKey);
        if (currentIndex === -1) return null;
        
        const startIndex = Math.max(0, currentIndex - periodCount);
        const historicalPeriods = periods.slice(startIndex, currentIndex);
        
        const dailyAverages = Array(daysInCurrentPeriod).fill(0);
        const dayCounts = Array(daysInCurrentPeriod).fill(0);
        
        historicalPeriods.forEach(historicalPeriodKey => {
            const historicalDailyData = this.getDailyExpenseData(historicalPeriodKey, walletId);
            const daysInHistoricalPeriod = historicalDailyData.length;
            
            for (let day = 0; day < daysInCurrentPeriod; day++) {
                if (day < daysInHistoricalPeriod) {
                    dailyAverages[day] += historicalDailyData[day];
                    dayCounts[day]++;
                } else {
                    // Use last available day for missing days
                    dailyAverages[day] += historicalDailyData[daysInHistoricalPeriod - 1] || 0;
                    dayCounts[day]++;
                }
            }
        });
        
        const historicalAverageDaily = dailyAverages.map((sum, index) => 
            dayCounts[index] > 0 ? sum / dayCounts[index] : 0
        );
        
        const currentMonthCumulative = [];
        const historicalAverageCumulative = [];
        
        let currentSum = 0;
        let historicalSum = 0;
        
        for (let i = 0; i < daysInCurrentPeriod; i++) {
            currentSum += currentPeriodDaily[i];
            historicalSum += historicalAverageDaily[i];
            currentMonthCumulative.push(currentSum);
            historicalAverageCumulative.push(historicalSum);
        }
        
        return {
            days: Array.from({length: daysInCurrentPeriod}, (_, i) => i + 1),
            currentMonthDaily: currentPeriodDaily,
            currentMonthCumulative: currentMonthCumulative,
            historicalAverageDaily: historicalAverageDaily,
            historicalAverageCumulative: historicalAverageCumulative
        };
}
}

// Singleton instance
let analyticsInstance = null;

export const getAnalytics = () => {
    if (!analyticsInstance) {
        analyticsInstance = new AnalyticsService();
    }
    return analyticsInstance;
};

export const initializeAnalytics = (database) => {
    const analytics = getAnalytics();
    return analytics.initialize(database);
};