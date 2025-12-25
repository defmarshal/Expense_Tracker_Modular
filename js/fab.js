// FAB (Floating Action Button) Module
export function initFAB() {
    console.log('Initializing FAB...');
    
    const fabButton = document.getElementById('fabButton');
    const fabMenu = document.getElementById('fabMenu');
    const fabBackdrop = document.getElementById('fabBackdrop');
    const fabMenuItems = document.querySelectorAll('.fab-menu-item');

    if (!fabButton || !fabMenu || !fabBackdrop) {
        console.warn('FAB elements not found', {
            fabButton: !!fabButton,
            fabMenu: !!fabMenu,
            fabBackdrop: !!fabBackdrop
        });
        return;
    }
    
    console.log('FAB elements found, setting up listeners...');

    // Toggle FAB menu
    function toggleFAB(show) {
        const isActive = fabMenu.classList.contains('active');
        
        if (show === undefined) {
            show = !isActive;
        }

        if (show) {
            fabButton.classList.add('active');
            fabMenu.classList.add('active');
            fabBackdrop.classList.add('active');
        } else {
            fabButton.classList.remove('active');
            fabMenu.classList.remove('active');
            fabBackdrop.classList.remove('active');
        }
    }

    // Close FAB menu
    function closeFAB() {
        toggleFAB(false);
    }

    // FAB button click
    fabButton.addEventListener('click', (e) => {
        console.log('FAB button clicked');
        e.stopPropagation();
        toggleFAB();
    });

    // Backdrop click
    fabBackdrop.addEventListener('click', closeFAB);

    // Menu item clicks
    fabMenuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = item.dataset.action;
            console.log('FAB menu item clicked:', action);
            
            // Close FAB menu
            closeFAB();

            // Perform action after a small delay for smooth animation
            setTimeout(() => {
                handleFABAction(action);
            }, 200);
        });
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && fabMenu.classList.contains('active')) {
            closeFAB();
        }
    });

    // Handle FAB actions - Open modal instead
    function handleFABAction(action) {
        console.log('Handling FAB action:', action);
        
        const modal = document.getElementById('fabQuickAddModal');
        const modalTitle = document.getElementById('fabModalTitle');
        const modalSubtitle = document.getElementById('fabModalSubtitle');
        
        if (!modal) {
            console.error('FAB Quick Add Modal not found');
            return;
        }

        // Hide all forms
        document.querySelectorAll('.fab-form').forEach(form => {
            form.style.display = 'none';
        });

        // Show the appropriate form and update modal title (v5.2)
        let formId = '';
        switch (action) {
            case 'expense':
                formId = 'fabExpenseForm';
                modalTitle.textContent = 'Add Expense';
                modalSubtitle.textContent = 'Quick expense entry';
                break;
            case 'income':
                formId = 'fabIncomeForm';
                modalTitle.textContent = 'Add Income';
                modalSubtitle.textContent = 'Quick income entry';
                break;
            case 'wallet':
                formId = 'fabWalletForm';
                modalTitle.textContent = 'Add Wallet';
                modalSubtitle.textContent = 'Create new wallet';
                break;
            case 'category':
                formId = 'fabCategoryForm';
                modalTitle.textContent = 'Add Category';
                modalSubtitle.textContent = 'Create new category';
                break;
            case 'budget':
                if (window.finTrack && window.finTrack.ui) {
                    window.finTrack.ui.openBudgetModal();
                }
                return;
        }

        const form = document.getElementById(formId);
        if (form) {
            form.style.display = 'block';
            
            // Set default date for expense/income forms
            const today = new Date().toISOString().split('T')[0];
            if (action === 'expense') {
                document.getElementById('fabExpenseDate').value = today;
                // Populate categories
                populateFabCategories();
            } else if (action === 'income') {
                document.getElementById('fabIncomeDate').value = today;
            }
            
            // Open modal
            modal.classList.add('active');
            
            // Focus first input
            setTimeout(() => {
                const firstInput = form.querySelector('input[type="text"]');
                if (firstInput) firstInput.focus();
            }, 100);
        }
    }

    // Populate categories in FAB form
    function populateFabCategories() {
        const categorySelect = document.getElementById('fabExpenseCategory');
        if (!categorySelect || !window.finTrack) return;

        const categories = window.finTrack.state.getMainCategories();
        categorySelect.innerHTML = '<option value="">Select category</option>';
        
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.name;
            option.textContent = category.name;
            categorySelect.appendChild(option);
        });

        // Update subcategories when category changes
        categorySelect.addEventListener('change', function() {
            const subcategorySelect = document.getElementById('fabExpenseSubcategory');
            if (!subcategorySelect) return;

            subcategorySelect.innerHTML = '<option value="">Optional</option>';
            
            if (this.value) {
                const mainCategory = categories.find(c => c.name === this.value);
                if (mainCategory) {
                    const subcategories = window.finTrack.state.getSubcategories(mainCategory.id);
                    subcategories.forEach(subcat => {
                        const option = document.createElement('option');
                        option.value = subcat.name;
                        option.textContent = subcat.name;
                        subcategorySelect.appendChild(option);
                    });
                }
            }
        });
    }

    // Setup modal close button
    const closeModalBtn = document.getElementById('closeFabQuickAddModal');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            document.getElementById('fabQuickAddModal').classList.remove('active');
        });
    }

    // Show pulse animation on first visit (optional)
    setTimeout(() => {
        const hasSeenFAB = localStorage.getItem('fab_seen');
        if (!hasSeenFAB) {
            fabButton.classList.add('pulse');
            setTimeout(() => {
                fabButton.classList.remove('pulse');
                localStorage.setItem('fab_seen', 'true');
            }, 4000);
        }
    }, 2000);

    console.log('FAB initialized successfully');
}

// Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFAB);
} else {
    // DOM already loaded, but don't auto-init since we're using module import
    console.log('FAB module loaded, waiting for manual init');
}