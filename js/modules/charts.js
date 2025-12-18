// js/modules/charts.js

import { currencyUtils } from './utils.js';

/**
 * Chart rendering and management module
 */
class ChartService {
    constructor() {
        this.charts = new Map();
        this.chartConfigs = this.getDefaultConfigs();
    }

    getDefaultConfigs() {
        return {
            doughnut: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { boxWidth: 10, font: { size: 10 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${currencyUtils.formatDisplayCurrency(value)} (${percentage}%)`;
                            }
                        }
                    }
                }
            },
            line: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { 
                        labels: { boxWidth: 10, font: { size: 10 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${currencyUtils.formatDisplayCurrency(context.raw || 0)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { 
                            callback: (v) => currencyUtils.formatDisplayCurrency(v), 
                            font: { size: 9 } 
                        }
                    }
                }
            }
        };
    }

    // Create or update doughnut chart
    renderDoughnutChart(canvasId, data) {
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) return null;

        // Destroy existing chart
        if (this.charts.has(canvasId)) {
            this.charts.get(canvasId).destroy();
        }

        // Generate colors
        const backgroundColors = data.labels.map((_, index) => {
            const hue = (index * 137.5) % 360;
            return `hsl(${hue}, 65%, 60%)`;
        });

        const chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.labels,
                datasets: [{
                    data: data.values,
                    backgroundColor: backgroundColors,
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: this.chartConfigs.doughnut
        });

        this.charts.set(canvasId, chart);
        return chart;
    }

    // Create or update line chart
    renderLineChart(canvasId, data) {
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) return null;

        if (this.charts.has(canvasId)) {
            this.charts.get(canvasId).destroy();
        }

        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: data.datasets
            },
            options: this.chartConfigs.line
        });

        this.charts.set(canvasId, chart);
        return chart;
    }

// Create or update bar chart
    renderBarChart(canvasId, data) {
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) return null;

        if (this.charts.has(canvasId)) {
            this.charts.get(canvasId).destroy();
        }

        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: data.datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { 
                        labels: { boxWidth: 10, font: { size: 10 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${currencyUtils.formatDisplayCurrency(context.raw || 0)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { 
                            callback: (v) => currencyUtils.formatDisplayCurrency(v), 
                            font: { size: 9 } 
                        }
                    },
                    x: {
                        ticks: {
                            font: { size: 9 }
                        }
                    }
                }
            }
        });

        this.charts.set(canvasId, chart);
        return chart;
    }

    
    // Create comparison chart (multiple lines)
    renderComparisonChart(canvasId, data) {
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) return null;

        if (this.charts.has(canvasId)) {
            this.charts.get(canvasId).destroy();
        }

        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: data.datasets.map(dataset => ({
                    ...dataset,
                    borderWidth: 2,
                    tension: 0.3,
                    fill: false,
                    pointRadius: 0
                }))
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { 
                        beginAtZero: true, 
                        ticks: { 
                            callback: (v) => currencyUtils.formatDisplayCurrency(v), 
                            font: { size: 9 } 
                        } 
                    }
                }
            }
        });

        this.charts.set(canvasId, chart);
        return chart;
    }

    // Update chart data
    updateChartData(canvasId, newData) {
        const chart = this.charts.get(canvasId);
        if (!chart) return false;

        chart.data.labels = newData.labels || chart.data.labels;
        
        if (newData.datasets) {
            chart.data.datasets = newData.datasets;
        } else if (newData.values) {
            chart.data.datasets[0].data = newData.values;
        }
        
        chart.update();
        return true;
    }

    // Destroy a specific chart
    destroyChart(canvasId) {
        if (this.charts.has(canvasId)) {
            this.charts.get(canvasId).destroy();
            this.charts.delete(canvasId);
        }
    }

    // Destroy all charts
    destroyAllCharts() {
        this.charts.forEach(chart => chart.destroy());
        this.charts.clear();
    }

    // Create comparison legend
    createComparisonLegend(containerId, items) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';
        
        items.forEach(item => {
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';
            
            const colorBox = document.createElement('div');
            colorBox.className = 'legend-color';
            colorBox.style.backgroundColor = item.color;
            
            const labelText = document.createElement('span');
            labelText.textContent = item.label;
            
            legendItem.appendChild(colorBox);
            legendItem.appendChild(labelText);
            container.appendChild(legendItem);
        });
    }
}

// Singleton instance
let chartInstance = null;

export const getChartService = () => {
    if (!chartInstance) {
        chartInstance = new ChartService();
    }
    return chartInstance;
};