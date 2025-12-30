// FAB (Floating Action Button) Module
export function initFAB() {
    
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

        // Show the appropriate form and update modal title
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
        
        // Remove old listeners by cloning
        const newCategorySelect = categorySelect.cloneNode(true);
        categorySelect.parentNode.replaceChild(newCategorySelect, categorySelect);

        // Populate options
        newCategorySelect.innerHTML = '<option value="">Select category</option>';
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.name;
            option.textContent = category.name;
            newCategorySelect.appendChild(option);
        });

        // Debounced update handler for rapid switching
        let updateTimeout = null;  // ✅ Timer instead of boolean flag
        let lastValue = '';

        newCategorySelect.addEventListener('change', function() {
            const selectedCategory = this.value;
            
            // Cancel any pending update (KEY CHANGE!)
            if (updateTimeout) {
                clearTimeout(updateTimeout);  // ✅ Cancel previous timer
            }
            
            // Store the latest selection
            lastValue = selectedCategory;
            
            const subcategorySelect = document.getElementById('fabExpenseSubcategory');
            if (!subcategorySelect) return;

            // Immediate visual feedback - disable subcategory
            subcategorySelect.disabled = true;
            
            // Debounce the actual update
            updateTimeout = setTimeout(() => {  // ✅ Set new timer
                // Close the category dropdown
                newCategorySelect.blur();
                
                // Update subcategory options
                subcategorySelect.innerHTML = '<option value="">Optional</option>';
                
                if (lastValue) {
                    const mainCategory = categories.find(c => c.name === lastValue);
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
                
                // Re-enable after a short delay for iOS to settle
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        subcategorySelect.disabled = false;
                        updateTimeout = null;
                    }, 50);
                });
            }, 200); // ✅ 200ms debounce - waits for user to stop switching
        });
    }

    // Reset FAB forms
    function resetFabForms() {
        // Reset expense form
        const expenseForm = document.getElementById('fabExpenseForm');
        if (expenseForm) {
            expenseForm.reset();
            const subcategorySelect = document.getElementById('fabExpenseSubcategory');
            if (subcategorySelect) {
                subcategorySelect.innerHTML = '<option value="">Optional</option>';
            }
        }
        
        // Reset income form
        const incomeForm = document.getElementById('fabIncomeForm');
        if (incomeForm) {
            incomeForm.reset();
            // Reset reimbursement toggle
            const reimbursementToggle = document.getElementById('fabIncomeIsReimbursement');
            if (reimbursementToggle) {
                reimbursementToggle.checked = false;
            }
            const expenseSelector = document.getElementById('fabIncomeExpenseSelector');
            if (expenseSelector) {
                expenseSelector.classList.add('hidden');
            }
            // Reset selected expenses
            if (window.finTrack && window.finTrack.app) {
                window.finTrack.app.selectedExpensesForReimbursement = [];
                window.finTrack.app.updateSelectedExpensesDisplay();
            }
        }
        
        // Reset wallet form
        const walletForm = document.getElementById('fabWalletForm');
        if (walletForm) {
            walletForm.reset();
        }
        
        // Reset category form
        const categoryForm = document.getElementById('fabCategoryForm');
        if (categoryForm) {
            categoryForm.reset();
            const parentCategoryGroup = document.getElementById('fabParentCategoryGroup');
            if (parentCategoryGroup) {
                parentCategoryGroup.classList.add('hidden');
            }
        }
    }

    // Setup modal close button
    const closeModalBtn = document.getElementById('closeFabQuickAddModal');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            const modal = document.getElementById('fabQuickAddModal');
            modal.classList.remove('active');
            // Reset forms when closing
            setTimeout(() => {
                resetFabForms();
            }, 300); // Wait for modal close animation
        });
    }

    // Also close modal when clicking backdrop
    const fabModal = document.getElementById('fabQuickAddModal');
    if (fabModal) {
        fabModal.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                fabModal.classList.remove('active');
                setTimeout(() => {
                    resetFabForms();
                }, 300);
            }
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
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFAB);
} else {
    // Already loaded, but don't auto-init since it's imported as module
}