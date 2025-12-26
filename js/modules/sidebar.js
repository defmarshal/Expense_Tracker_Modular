// js/modules/sidebar.js

/**
 * SIDEBAR NAVIGATION MODULE
 * Handles both desktop sidebar and mobile bottom navigation
 */

export function initializeSidebar(state) {
    
    // Setup navigation event listeners
    setupSidebarNavigation(state);
    setupBottomNavigation(state);
    
    // Initialize with active tab
    updateNavigationUI(state.getActiveTab());
}

/**
 * Setup desktop sidebar navigation
 */
function setupSidebarNavigation(state) {
    const sidebarItems = document.querySelectorAll('.sidebar-nav-item');
    
    sidebarItems.forEach(item => {
        const tabId = item.getAttribute('data-tab');
        
        item.addEventListener('click', (e) => {
            e.preventDefault();
            state.setActiveTab(tabId);
            updateNavigationUI(tabId);
        });
    });
}

/**
 * Setup mobile bottom navigation
 */
function setupBottomNavigation(state) {
    const bottomNavItems = document.querySelectorAll('.bottom-nav-item');
    
    bottomNavItems.forEach(item => {
        const tabId = item.getAttribute('data-tab');
        
        item.addEventListener('click', (e) => {
            e.preventDefault();
            state.setActiveTab(tabId);
            updateNavigationUI(tabId);
        });
    });
}

/**
 * Update both sidebar and bottom nav UI
 */
function updateNavigationUI(activeTab) {
    
    // Update sidebar items
    const sidebarItems = document.querySelectorAll('.sidebar-nav-item');
    sidebarItems.forEach(item => {
        if (item.getAttribute('data-tab') === activeTab) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    // Update bottom nav items
    const bottomNavItems = document.querySelectorAll('.bottom-nav-item');
    bottomNavItems.forEach(item => {
        if (item.getAttribute('data-tab') === activeTab) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

/**
 * Get current active tab from navigation
 */
export function getCurrentTab() {
    const activeItem = document.querySelector('.sidebar-nav-item.active, .bottom-nav-item.active');
    return activeItem ? activeItem.getAttribute('data-tab') : 'overview';
}