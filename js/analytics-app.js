// js/analytics-app.js

import { getAuth } from './modules/auth.js';
import { getDatabase } from './modules/database.js';
import { getState } from './modules/state.js';
import { getAnalytics, initializeAnalytics } from './modules/analytics.js';
import { getChartService } from './modules/charts.js';
import { getAnalyticsUI } from './modules/analytics-ui.js';
import { debounce } from './modules/debounce.js';
import { asyncUtils, storageUtils } from './modules/utils.js';

import { 
    getWalletPersistence, 
    loadAndSetDefaultWallet, 
    handleWalletChange 
} from './modules/wallet-persistence.js';

/**
 * Main analytics application orchestrator
 */
class AnalyticsApp {
    constructor() {
        // Core services
        this.state = getState();
        this.auth = null;
        this.db = null;
        this.analytics = getAnalytics();
        this.charts = getChartService();
        this.ui = getAnalyticsUI();
        this.walletPersistence = null;
        
        // Application state
        this.appState = {
            isLoading: false,
            hasData: false,
            currentView: {
                walletId: 'all',
                periodKey: null,
                trendRange: 12,
                comparisonRange: 6,
                dateRangeType: 'current-period', // NEW
                customStartDate: null,           // NEW
                customEndDate: null              // NEW
            }
        };
        
        // Data cache
        this.dataCache = {
            periodSummary: null,
            categoryBreakdown: null,
            trendData: null,
            comparisonData: null,
            insights: null
        };
        
        // Debounced functions - will be initialized after methods are defined
        this.debouncedUpdateAnalytics = null;
        this.debouncedUpdateCharts = null;
    }

    async initialize(supabaseClient) {
        try {
            console.log('Initializing Analytics App...');
            
            // Initialize debounced functions now that methods exist
            this.debouncedUpdateAnalytics = debounce(this.updateAnalytics.bind(this), 300);
            this.debouncedUpdateCharts = debounce(this.updateCharts.bind(this), 200);
            
            // Initialize services
            this.auth = getAuth(supabaseClient);
            this.db = getDatabase(supabaseClient);
            await this.auth.initialize();
            this.walletPersistence = getWalletPersistence(this.db);

            // Initialize analytics with database
            initializeAnalytics(this.db);
            
            // Setup UI
            this.ui.initializeUI();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Setup state listeners
            this.setupStateListeners();
            
            // Setup UI listeners
            this.setupUIListeners();
            
            // Check initial auth state
            await this.checkInitialAuthState();
            
            console.log('Analytics App initialized successfully');
        } catch (error) {
            console.error('Error initializing Analytics App:', error);
            this.showAlert('Failed to load analytics. Please refresh.', 'error');
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

    setupEventListeners() {
        // Wallet selector change
        const walletSelect = document.getElementById('walletSelect');
        if (walletSelect) {
            walletSelect.addEventListener('change', async (e) => {
                const newWalletId = e.target.value;
                const userId = this.auth.getUser?.()?.id;
                
                await handleWalletChange(
                    this.walletPersistence,
                    newWalletId,
                    userId,
                    (walletId) => {
                        this.appState.currentView.walletId = walletId;
                        if (this.debouncedUpdateAnalytics) {
                            this.debouncedUpdateAnalytics();
                        }
                    }
                );
            });
        }

        // Period selector change (debounced)
        const monthSelect = document.getElementById('monthSelect');
        if (monthSelect) {
            monthSelect.addEventListener('change', (e) => {
                this.appState.currentView.periodKey = e.target.value;
                if (this.debouncedUpdateAnalytics) {
                    this.debouncedUpdateAnalytics();
                }
            });
        }

        // Date range selector change
        const dateRangeSelect = document.getElementById('dateRangeSelect');
        if (dateRangeSelect) {
            dateRangeSelect.addEventListener('change', (e) => {
                this.appState.currentView.dateRangeType = e.target.value;
                
                // Show/hide custom date inputs
                const customContainer = document.getElementById('customDateContainer');
                if (e.target.value === 'custom') {
                    customContainer?.classList.remove('hidden');
                } else {
                    customContainer?.classList.add('hidden');
                    if (this.debouncedUpdateAnalytics) {
                        this.debouncedUpdateAnalytics();
                    }
                }
                
                // Hide month selector if not using current-period
                const monthContainer = document.querySelector('.month-selector-container');
                if (e.target.value === 'current-period') {
                    monthContainer?.classList.remove('hidden');
                } else {
                    monthContainer?.classList.add('hidden');
                }
            });
        }

        // Apply custom date range
        document.getElementById('applyCustomDate')?.addEventListener('click', () => {
            const startDate = document.getElementById('startDate')?.value;
            const endDate = document.getElementById('endDate')?.value;
            
            if (startDate && endDate) {
                this.appState.currentView.customStartDate = startDate;
                this.appState.currentView.customEndDate = endDate;
                if (this.debouncedUpdateAnalytics) {
                    this.debouncedUpdateAnalytics();
                }
            } else {
                this.showAlert('Please select both start and end dates', 'warning');
            }
        });        

        // Logout button
        document.getElementById('logoutBtn')?.addEventListener('click', async () => {
            try {
                // Clear wallet persistence
                if (this.walletPersistence) {
                    this.walletPersistence.clearStoredWallet();
                }
                
                await this.auth.signOut();
                this.showAlert('Logged out', 'success');
                setTimeout(() => window.location.href = 'index.html', 1000);
            } catch (error) {
                console.error('Logout error:', error);
            }
        });

        // Back button
        document.querySelector('.back-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'index.html';
        });
    }

    setupStateListeners() {
        // Listen for state changes
        this.state.subscribe('expenses', () => this.handleDataChange());
        this.state.subscribe('incomes', () => this.handleDataChange());
        this.state.subscribe('wallets', () => this.handleWalletsUpdate());
        this.state.subscribe('categories', () => this.handleCategoriesUpdate());
    }

    setupUIListeners() {
        // Listen for UI events
        this.ui.subscribe('walletChanged', (walletId) => {
            this.appState.currentView.walletId = walletId;
            if (this.debouncedUpdateAnalytics) {
                this.debouncedUpdateAnalytics();
            }
        });

        this.ui.subscribe('periodChanged', (periodKey) => {
            this.appState.currentView.periodKey = periodKey;
            if (this.debouncedUpdateAnalytics) {
                this.debouncedUpdateAnalytics();
            }
        });

        // this.ui.subscribe('trendRangeChanged', (range) => {
        //     this.appState.currentView.trendRange = range;
        //     this.updateTrendChart();
        // });

        this.ui.subscribe('comparisonRangeChanged', (range) => {
            this.appState.currentView.comparisonRange = range;
            this.updateComparisonChart();
        });
    }

    async checkInitialAuthState() {
        try {
            const authState = await this.auth.checkAuth();
            
            if (authState.isAuthenticated) {
                await this.loadData();
            } else {
                this.ui.showNoDataMessage();
            }
        } catch (error) {
            console.error('Error checking auth state:', error);
            this.ui.showNoDataMessage();
        }
    }

    async getDefaultWalletId() {
        try {
            const user = this.auth.getUser?.();
            if (!user) return 'all';

            const { data, error } = await this.db.supabase
                .from('profiles') // or user_settings
                .select('default_wallet_id')
                .eq('id', user.id)
                .single();

            if (error) {
                console.error('Failed to fetch default wallet:', error);
                return 'all';
            }

            return data?.default_wallet_id ?? 'all';
        } catch (err) {
            console.error('Error loading default wallet:', err);
            return 'all';
        }
    }    

    async loadData() {
        this.setLoading(true);

        try {
            // 1. Get wallets from STATE (already loaded by auth)
            const wallets = this.state.getWallets();
            
            // If no wallets in state, something went wrong
            if (wallets.length === 0) {
                console.warn('No wallets found in state');
                this.ui.showNoDataMessage();
                return;
            }
            
            this.ui.populateWalletSelector(wallets);

            // 2. Load and set default wallet using persistence
            const userId = this.auth.getUser?.()?.id;
            const defaultWalletId = await loadAndSetDefaultWallet(
                this.walletPersistence,
                wallets,
                userId,
                (walletId) => {
                    this.appState.currentView.walletId = walletId;
                    const walletSelect = document.getElementById('walletSelect');
                    if (walletSelect) {
                        walletSelect.value = walletId;
                    }
                }
            );

            // 3. Generate periods
            const availablePeriods = this.analytics.generateAvailablePeriods();
            this.ui.populatePeriodSelector(availablePeriods);

            if (availablePeriods.length > 0) {
                this.appState.currentView.periodKey = availablePeriods[0];
                this.appState.hasData = true;
                this.ui.hideNoDataMessage();

                // 4. Run analytics
                await this.updateAnalytics();
            } else {
                this.ui.showNoDataMessage();
            }

        } catch (error) {
            console.error('Error loading data:', error);
            this.ui.showNoDataMessage();
        } finally {
            this.setLoading(false);
        }
    }

    handleDataChange() {
        if (this.appState.hasData && this.debouncedUpdateAnalytics) {
            this.debouncedUpdateAnalytics();
        }
    }

    handleWalletsUpdate() {
        const wallets = this.state.getWallets();
        this.ui.populateWalletSelector(wallets);
        
        if (wallets.length > 0 && this.appState.currentView.walletId === 'all' && this.debouncedUpdateAnalytics) {
            this.debouncedUpdateAnalytics();
        }
    }

    handleCategoriesUpdate() {
        // Categories updated, might affect breakdown
        if (this.appState.hasData && this.debouncedUpdateAnalytics) {
            this.debouncedUpdateAnalytics();
        }
    }

    async updateAnalytics() {
            if (this.appState.isLoading) {
                return;
            }

            this.setLoading(true);
            
            try {
                const { walletId, dateRangeType, customStartDate, customEndDate, periodKey } = this.appState.currentView;
                
                let summary, breakdown, periodLabel;
                
                // Check if using date range or period
                if (dateRangeType === 'current-period') {
                    if (!periodKey) {
                        this.setLoading(false);
                        return;
                    }
                    // Use existing period-based logic
                    summary = this.analytics.calculateSummary(periodKey, walletId);
                    periodLabel = this.analytics.getPeriodLabel(periodKey);
                    breakdown = this.analytics.calculateCategoryBreakdown(periodKey, walletId);
                } else if (dateRangeType === 'custom') {
                    if (!customStartDate || !customEndDate) {
                        this.setLoading(false);
                        return;
                    }
                    // Use custom date range
                    const startDate = new Date(customStartDate);
                    const endDate = new Date(customEndDate);
                    summary = this.analytics.calculateSummaryByDateRange(startDate, endDate, walletId);
                    breakdown = this.analytics.calculateCategoryBreakdownByDateRange(startDate, endDate, walletId);
                    periodLabel = this.analytics.formatDateRangeLabel(startDate, endDate);
                } else {
                    // Use preset date range
                    const dateRange = this.analytics.calculateDateRange(dateRangeType);
                    if (!dateRange) {
                        this.setLoading(false);
                        return;
                    }
                    summary = this.analytics.calculateSummaryByDateRange(dateRange.startDate, dateRange.endDate, walletId);
                    breakdown = this.analytics.calculateCategoryBreakdownByDateRange(dateRange.startDate, dateRange.endDate, walletId);
                    periodLabel = this.analytics.formatDateRangeLabel(dateRange.startDate, dateRange.endDate);
                }
                
                // Update summary cards
                this.ui.updateSummaryCards(summary, periodLabel);
                
                // Update category breakdown
                this.ui.renderCategoryBreakdown(breakdown);
                
                // Update insights (only for period-based for now)
                if (dateRangeType === 'current-period' && periodKey) {
                    const insights = this.analytics.calculateInsights(periodKey, walletId);
                    this.ui.updateInsightsCards(insights);
                }
                
                // Update charts
                await this.updateCharts();
                
                // Cache the data
                this.dataCache.periodSummary = summary;
                this.dataCache.categoryBreakdown = breakdown;
                
            } catch (error) {
                console.error('Error updating analytics:', error);
                this.showAlert('Error updating analytics', 'error');
            } finally {
                this.setLoading(false);
            }
        }

    async updateCharts() {
        const { periodKey, walletId, trendRange, comparisonRange } = this.appState.currentView;
        
        // Update trend chart
        const trendData = this.analytics.calculateTrendData(periodKey, trendRange, walletId);
        this.updateTrendChart(trendData);
        
        // Update category chart
        const breakdown = this.analytics.calculateCategoryBreakdown(periodKey, walletId);
        this.updateCategoryChart(breakdown);
        
        // Update comparison chart
        this.updateComparisonChart(periodKey, comparisonRange, walletId);
    }

    updateTrendChart(trendData) {
            if (!trendData || trendData.periods.length === 0) {
                console.log('No trend data available');
                return;
            }

            const chartData = {
                labels: trendData.labels,
                datasets: [
                    {
                        label: 'Income',
                        data: trendData.income,
                        borderColor: '#10B981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        fill: true,
                        tension: 0.3,
                        pointRadius: 3,
                        borderWidth: 2
                    },
                    {
                        label: 'Expenses',
                        data: trendData.expense,
                        borderColor: '#EF4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        fill: true,
                        tension: 0.3,
                        pointRadius: 3,
                        borderWidth: 2
                    }
                ]
            };

            this.charts.renderLineChart('trendChart', chartData);
            
            const trendChartTitle = document.getElementById('trendChartTitle');
            if (trendChartTitle) {
                trendChartTitle.textContent = `Monthly Trend (Last 12 periods)`;
            }
        }

    updateCategoryChart(breakdown) {
        if (!breakdown.categories || Object.keys(breakdown.categories).length === 0) {
            return;
        }

        const chartData = {
            labels: Object.keys(breakdown.categories),
            values: Object.values(breakdown.categories).map(c => c.total)
        };

        this.charts.renderDoughnutChart('categoryChart', chartData);
    }

    updateComparisonChart(periodKey, periodCount, walletId) {
        try {
            const comparisonData = this.analytics.getDailyComparisonData(
                periodKey, 
                periodCount, 
                walletId
            );
            
            if (!comparisonData || comparisonData.days.length === 0) {
                console.log('No comparison data available');
                return;
            }
            
            const chartData = {
                        labels: comparisonData.days,
                        datasets: [
                            {
                                label: 'Current Month',
                                data: comparisonData.currentMonthCumulative,
                                borderColor: '#EF4444',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                borderWidth: 3,
                                tension: 0.3,
                                fill: true,
                                pointRadius: 0
                            },
                            {
                                label: 'Historical Average',
                                data: comparisonData.historicalAverageCumulative,
                                borderColor: '#9333EA',
                                backgroundColor: 'rgba(147, 51, 234, 0.1)',
                                borderWidth: 3,
                                tension: 0.3,
                                fill: true,
                                pointRadius: 0,
                                borderDash: [5, 5]
                            }
                        ]
                    };
            
            this.charts.renderComparisonChart('comparisonChart', chartData);
            
            const legendItems = [
                { label: 'Current Month', color: '#EF4444' },
                { label: 'Historical Average', color: '#9333EA' }
            ];
            
            this.charts.createComparisonLegend('comparisonLegend', legendItems);
            
        } catch (error) {
            console.error('Error updating comparison chart:', error);
            this.showAlert('Error loading daily trend data', 'error');
        }
    }

    setLoading(isLoading) {
        this.appState.isLoading = isLoading;
        
        if (isLoading) {
            this.ui.showLoading();
        } else {
            this.ui.hideLoading();
        }
    }

    showAlert(message, type = 'info') {
        const alertContainer = document.getElementById('alertContainer');
        if (!alertContainer) return;

        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        const icon = type === 'success' ? 'fa-check-circle' : 
                     type === 'warning' ? 'fa-exclamation-triangle' : 'fa-exclamation-circle';
        
        alert.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
        alertContainer.appendChild(alert);
        
        setTimeout(() => {
            if (alert.parentNode === alertContainer) {
                alertContainer.removeChild(alert);
            }
        }, 4000);
    }

    clearCache() {
        this.dataCache = {
            periodSummary: null,
            categoryBreakdown: null,
            trendData: null,
            comparisonData: null,
            insights: null
        };
    }
}

// Create and export the app instance
let analyticsAppInstance = null;

export const getAnalyticsApp = () => {
    if (!analyticsAppInstance) {
        analyticsAppInstance = new AnalyticsApp();
    }
    return analyticsAppInstance;
};

export const initializeAnalyticsApp = async (supabaseClient) => {
    const app = getAnalyticsApp();
    await app.initialize(supabaseClient);
    return app;
};