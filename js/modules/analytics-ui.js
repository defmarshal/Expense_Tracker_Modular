// js/modules/analytics-ui.js

import { currencyUtils, dateUtils, domUtils } from './utils.js';
import { getChartService } from './charts.js';

/**
 * Analytics UI rendering module
 */
class AnalyticsUI {
    constructor() {
        this.chartService = getChartService();
        this.currentView = {
            walletId: 'all',
            periodKey: null,
            trendRange: 6,
            comparisonRange: 6
        };
    }

    // Initialize UI components
    initializeUI() {
        this.setupSelectors();
        this.setupEventListeners();
        this.setupCategoryAccordions();
    }

    setupSelectors() {
        // Wallet selector
        this.populateWalletSelector();
        
        // Period selector
        this.populatePeriodSelector();
        
        // Range selectors
        this.setupRangeSelectors();
    }

    setupEventListeners() {
        // Report toggle
        document.getElementById('reportHeader')?.addEventListener('click', () => {
            this.toggleReport();
        });

        // Category accordion toggles will be handled by setupCategoryAccordions
    }

    setupCategoryAccordions() {
        // Event delegation for category toggles
        document.addEventListener('click', (e) => {
            if (e.target.closest('.category-header')) {
                const header = e.target.closest('.category-header');
                const categoryId = header.getAttribute('data-category-id');
                if (categoryId) this.toggleCategory(categoryId);
            }
            
            if (e.target.closest('.subcategory-header')) {
                const header = e.target.closest('.subcategory-header');
                const categoryId = header.getAttribute('data-category-id');
                const subcategoryId = header.getAttribute('data-subcategory-id');
                if (categoryId && subcategoryId) {
                    this.toggleSubcategory(categoryId, subcategoryId);
                }
            }
        });
    }

    setupRangeSelectors() {
        const trendRange = document.getElementById('trendRange');
        const comparisonRange = document.getElementById('comparisonRange');
        
        if (trendRange) {
            trendRange.addEventListener('change', (e) => {
                this.currentView.trendRange = parseInt(e.target.value);
                this.emitUIEvent('trendRangeChanged', this.currentView.trendRange);
            });
        }
        
        if (comparisonRange) {
            comparisonRange.addEventListener('change', (e) => {
                this.currentView.comparisonRange = parseInt(e.target.value);
                this.emitUIEvent('comparisonRangeChanged', this.currentView.comparisonRange);
            });
        }
    }

    populateWalletSelector(wallets = []) {
        const selector = document.getElementById('walletSelect');
        if (!selector) return;

        selector.innerHTML = '<option value="all">All Wallets</option>';
        
        wallets.forEach(wallet => {
            const option = document.createElement('option');
            option.value = wallet.id;
            option.textContent = wallet.name;
            selector.appendChild(option);
        });

        selector.addEventListener('change', (e) => {
            this.currentView.walletId = e.target.value;
            this.emitUIEvent('walletChanged', this.currentView.walletId);
        });
    }

    populatePeriodSelector(periods = []) {
        const selector = document.getElementById('monthSelect');
        if (!selector) return;

        selector.innerHTML = '';
        
        periods.forEach(periodKey => {
            const option = document.createElement('option');
            option.value = periodKey;
            option.textContent = this.getPeriodLabel(periodKey);
            selector.appendChild(option);
        });

        if (periods.length > 0 && !this.currentView.periodKey) {
            this.currentView.periodKey = periods[0];
            selector.value = periods[0];
        }

        selector.addEventListener('change', (e) => {
            this.currentView.periodKey = e.target.value;
            this.emitUIEvent('periodChanged', this.currentView.periodKey);
        });
    }

    // Update summary cards
    updateSummaryCards(summary, periodLabel) {
        const elements = {
            balance: document.getElementById('totalBalance'),
            income: document.getElementById('totalIncome'),
            expenses: document.getElementById('totalExpenses'),
            balanceLabel: document.getElementById('balanceLabel'),
            incomeLabel: document.getElementById('incomeLabel'),
            expenseLabel: document.getElementById('expenseLabel')
        };

        if (elements.balance) {
            elements.balance.textContent = currencyUtils.formatDisplayCurrency(summary.balance);
            elements.balance.className = `stat-value balance ${summary.balance >= 0 ? 'income' : 'expense'}`;
        }
        
        if (elements.income) elements.income.textContent = currencyUtils.formatDisplayCurrency(summary.income);
        if (elements.expenses) elements.expenses.textContent = currencyUtils.formatDisplayCurrency(summary.expenses);
        
        // Update labels
        if (elements.balanceLabel) elements.balanceLabel.textContent = periodLabel;
        if (elements.incomeLabel) elements.incomeLabel.textContent = periodLabel;
        if (elements.expenseLabel) elements.expenseLabel.textContent = periodLabel;
    }

    // Update insights cards
    updateInsightsCards(insights) {
        const elements = {
            savingsRate: document.getElementById('savingsRate'),
            savingsTrend: document.getElementById('savingsTrend'),
            topCategory: document.getElementById('topCategory'),
            topCategoryAmount: document.getElementById('topCategoryAmount'),
            monthlyAverage: document.getElementById('monthlyAverage'),
            averageTrend: document.getElementById('averageTrend')
        };

        if (elements.savingsRate) {
            elements.savingsRate.textContent = `${insights.savingsRate}%`;
        }
        
        if (elements.topCategory) {
            elements.topCategory.textContent = insights.topCategory;
        }
        
        if (elements.topCategoryAmount) {
            elements.topCategoryAmount.textContent = currencyUtils.formatDisplayCurrency(insights.topCategoryAmount);
        }
        
        if (elements.monthlyAverage) {
            elements.monthlyAverage.textContent = currencyUtils.formatDisplayCurrency(insights.periodAverage);
        }
    }

    // Render category breakdown
    renderCategoryBreakdown(breakdown) {
        const container = document.getElementById('categoryBreakdown');
        if (!container) return;

        if (!breakdown.categories || Object.keys(breakdown.categories).length === 0) {
            container.innerHTML = `
                <div class="no-expenses">
                    <i class="fas fa-receipt" style="font-size: 2rem; margin-bottom: 10px; opacity: 0.3;"></i>
                    <p>No expenses for this period</p>
                </div>
            `;
            return;
        }

        // Sort categories by total (descending)
        const sortedCategories = Object.keys(breakdown.categories).sort((a, b) => 
            breakdown.categories[b].total - breakdown.categories[a].total
        );

        let html = '';
        
        sortedCategories.forEach(category => {
            const catData = breakdown.categories[category];
            const categoryProgress = (catData.total / breakdown.totalExpenses) * 100;
            const safeCategoryId = category.replace(/[^a-zA-Z0-9]/g, '-');
            
            html += `
                <div class="category-group">
                    <div class="category-header" data-category-id="${safeCategoryId}">
                        <h3>
                            <i class="fas fa-folder" style="color: var(--primary);"></i>
                            ${category}
                        </h3>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span class="category-total">${currencyUtils.formatDisplayCurrency(catData.total)}</span>
                            <span class="category-percentage">${catData.percentage}%</span>
                            <button class="category-toggle" id="toggle-${safeCategoryId}">
                                <i class="fas fa-chevron-down"></i>
                            </button>
                        </div>
                    </div>
                    <div class="category-progress">
                        <div class="category-progress-bar" style="width: ${categoryProgress}%"></div>
                    </div>
                    <div class="category-content" id="content-${safeCategoryId}">
                        ${this.renderSubcategoryBreakdown(safeCategoryId, catData.subcategories, catData.total)}
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }

    renderSubcategoryBreakdown(categoryId, subcategories, categoryTotal) {
        const sortedSubcategories = Object.keys(subcategories).sort((a, b) => 
            subcategories[b].total - subcategories[a].total
        );
        
        if (sortedSubcategories.length === 0) {
            return `<div class="no-expenses" style="padding: 16px;">No subcategories</div>`;
        }
        
        let html = '';
        
        sortedSubcategories.forEach(subcategory => {
            const subData = subcategories[subcategory];
            const subcategoryProgress = (subData.total / categoryTotal) * 100;
            const safeSubcategoryId = subcategory.replace(/[^a-zA-Z0-9]/g, '-');
            
        html += `
            <div class="subcategory-group">
                <div class="subcategory-header" 
                     data-category-id="${categoryId}" 
                     data-subcategory-id="${safeSubcategoryId}">
                    <h4>
                        <i class="fas fa-folder-open" style="color: var(--secondary); font-size: 0.8rem;"></i>
                        ${subcategory}
                    </h4>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="subcategory-total">${currencyUtils.formatDisplayCurrency(subData.total)}</span>
                        <span class="subcategory-percentage">${subData.percentage}%</span>
                        <button class="subcategory-toggle" id="toggle-${categoryId}-${safeSubcategoryId}">
                            <i class="fas fa-chevron-down"></i>
                        </button>
                    </div>
                </div>
                <div class="subcategory-progress">
                    <div class="subcategory-progress-bar" style="width: ${subcategoryProgress}%"></div>
                </div>
                <div class="subcategory-content" id="content-${categoryId}-${safeSubcategoryId}">
                    ${this.renderExpenseList(subData.expenses)}
                </div>
            </div>
        `;
        });
        
        return html;
    }

    renderExpenseList(expenses) {
        if (!expenses || expenses.length === 0) {
            return `<div class="no-expenses" style="padding: 12px; font-size: 0.8rem;">No expenses</div>`;
        }
        
        const sortedExpenses = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        let html = '<div class="expense-list">';
        
        sortedExpenses.forEach(expense => {
            const date = new Date(expense.date).toLocaleDateString('en-US', {
                day: 'numeric',
                month: 'short'
            });
            
            html += `
                <div class="expense-item-detail">
                    <div class="expense-info">
                        <div class="expense-description">${expense.description}</div>
                        <div class="expense-meta">
                            <span class="expense-date">${date}</span>
                            <span class="expense-wallet">${expense.walletName || 'Unknown'}</span>
                        </div>
                    </div>
                    <div class="expense-amount-detail">
                        ${currencyUtils.formatDisplayCurrency(expense.amount)}
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        return html;
    }

    toggleCategory(categoryId) {
        const content = document.getElementById(`content-${categoryId}`);
        const toggle = document.getElementById(`toggle-${categoryId}`);
        
        if (!content || !toggle) return;
        
        const isExpanded = content.classList.contains('expanded');
        
        if (isExpanded) {
            content.classList.remove('expanded');
            toggle.innerHTML = '<i class="fas fa-chevron-down"></i>';
        } else {
            content.classList.add('expanded');
            toggle.innerHTML = '<i class="fas fa-chevron-up"></i>';
        }
    }

    toggleSubcategory(categoryId, subcategoryId) {
        const content = document.getElementById(`content-${categoryId}-${subcategoryId}`);
        const toggle = document.getElementById(`toggle-${categoryId}-${subcategoryId}`);
        
        if (!content || !toggle) return;
        
        const isExpanded = content.classList.contains('expanded');
        
        if (isExpanded) {
            content.classList.remove('expanded');
            toggle.innerHTML = '<i class="fas fa-chevron-down"></i>';
        } else {
            content.classList.add('expanded');
            toggle.innerHTML = '<i class="fas fa-chevron-up"></i>';
        }
    }

    toggleReport() {
        const reportContent = document.getElementById('reportContent');
        const reportToggle = document.getElementById('reportToggle');
        
        if (!reportContent || !reportToggle) return;
        
        const isExpanded = !reportContent.classList.contains('collapsed');
        
        if (isExpanded) {
            reportContent.classList.add('collapsed');
            reportToggle.classList.add('collapsed');
        } else {
            reportContent.classList.remove('collapsed');
            reportToggle.classList.remove('collapsed');
        }
    }

    // Show/hide loading states
    showLoading() {
        document.getElementById('analyticsContent')?.classList.add('hidden');
        document.getElementById('noDataAlert')?.classList.add('hidden');
        
        // Show loading skeleton if exists, or create one
        let skeleton = document.getElementById('analyticsSkeleton');
        if (!skeleton) {
            skeleton = this.createSkeletonLoader();
            document.querySelector('.analytics-container')?.appendChild(skeleton);
        } else {
            skeleton.classList.remove('hidden');
        }
    }

    hideLoading() {
        document.getElementById('analyticsContent')?.classList.remove('hidden');
        document.getElementById('analyticsSkeleton')?.classList.add('hidden');
    }

    createSkeletonLoader() {
        const skeleton = document.createElement('div');
        skeleton.id = 'analyticsSkeleton';
        skeleton.className = 'skeleton-container';
        
        skeleton.innerHTML = `
            <div class="skeleton-grid">
                ${Array(3).fill().map(() => `
                    <div class="skeleton-card"></div>
                `).join('')}
            </div>
            <div class="skeleton-chart"></div>
            <div class="skeleton-chart"></div>
            <div class="skeleton-insights">
                ${Array(3).fill().map(() => `
                    <div class="skeleton-insight"></div>
                `).join('')}
            </div>
        `;
        
        return skeleton;
    }

    // Show/hide no data message
    showNoDataMessage() {
        const noDataAlert = document.getElementById('noDataAlert');
        const analyticsContent = document.getElementById('analyticsContent');
        
        if (noDataAlert) noDataAlert.classList.remove('hidden');
        if (analyticsContent) analyticsContent.classList.add('hidden');
    }

    hideNoDataMessage() {
        const noDataAlert = document.getElementById('noDataAlert');
        const analyticsContent = document.getElementById('analyticsContent');
        
        if (noDataAlert) noDataAlert.classList.add('hidden');
        if (analyticsContent) analyticsContent.classList.remove('hidden');
    }

    // Event system for UI updates
    emitUIEvent(eventName, data) {
        const event = new CustomEvent(`analytics-ui:${eventName}`, {
            detail: data,
            bubbles: true
        });
        document.dispatchEvent(event);
    }

    subscribe(eventName, callback) {
        const handler = (event) => callback(event.detail);
        document.addEventListener(`analytics-ui:${eventName}`, handler);
        
        return () => {
            document.removeEventListener(`analytics-ui:${eventName}`, handler);
        };
    }

    // Helper function
    getPeriodLabel(periodKey) {
        const [year, month] = periodKey.split('-').map(Number);
        const monthNames = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"];
        
        let prevMonth = month - 1;
        let prevYear = year;
        if (prevMonth === 0) {
            prevMonth = 12;
            prevYear = year - 1;
        }
        
        return `${monthNames[prevMonth - 1]} 26th - ${monthNames[month - 1]} 25th`;
    }
}

// Singleton instance
let analyticsUIInstance = null;

export const getAnalyticsUI = () => {
    if (!analyticsUIInstance) {
        analyticsUIInstance = new AnalyticsUI();
    }
    return analyticsUIInstance;
};