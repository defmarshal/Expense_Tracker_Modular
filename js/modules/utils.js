// js/modules/utils.js

/**
 * UTILITY FUNCTIONS MODULE
 * Pure helper functions with no side effects
 */

// Currency formatting utilities
export const currencyUtils = {
  formatCurrency(value) {
    const numericValue = value.replace(/\D/g, '');
    return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  },

  parseCurrency(formattedValue) {
    return parseInt(formattedValue.replace(/\./g, '')) || 0;
  },

  formatDisplayCurrency(amount) {
    return `Rp ${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
  }
};

// Validation utilities
export const validationUtils = {
  isValidUUID(str) {
    if (!str) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  },

  validatePassword(password) {
    const requirements = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password)
    };
    
    return {
      isValid: Object.values(requirements).every(Boolean),
      strength: Object.values(requirements).filter(Boolean).length,
      requirements
    };
  },

  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
};

// Date utilities
export const dateUtils = {
  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  },

  getCurrentMonthYear() {
    const now = new Date();
    return {
      month: now.getMonth(),
      year: now.getFullYear(),
      monthName: now.toLocaleString('default', { month: 'long' })
    };
  },

  getMonthName(monthIndex) {
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    return monthNames[monthIndex];
  }
};

// DOM utilities
export const domUtils = {
  createElement(tag, className = '', attributes = {}) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
    return element;
  },

  hideElement(element) {
    if (element) element.classList.add('hidden');
  },

  showElement(element) {
    if (element) element.classList.remove('hidden');
  },

  toggleElement(element) {
    if (element) element.classList.toggle('hidden');
  },

  scrollToElement(element, options = { behavior: 'smooth' }) {
    element?.scrollIntoView(options);
  }
};

// Async utilities
export const asyncUtils = {
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  async retry(fn, retries = 3, delayMs = 1000) {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === retries - 1) throw error;
        await this.delay(delayMs * (i + 1));
      }
    }
  }
};

// Storage utilities
export const storageUtils = {
  setItem(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('LocalStorage set error:', error);
      return false;
    }
  },

  getItem(key) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error('LocalStorage get error:', error);
      return null;
    }
  },

  removeItem(key) {
    localStorage.removeItem(key);
  },

  clear() {
    localStorage.clear();
  }
};