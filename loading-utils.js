// ============================================
// LOADING STATE UTILITIES
// ============================================

/**
 * Show global loading overlay
 * @param {string} message - Loading message to display
 */
function showGlobalLoading(message = 'Loading...') {
    let overlay = document.querySelector('.global-loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'global-loading-overlay';
        overlay.innerHTML = `
            <div class="spinner"></div>
            <p class="loading-message">${message}</p>
        `;
        document.body.appendChild(overlay);
    } else {
        overlay.querySelector('.loading-message').textContent = message;
    }

    // Force reflow for transition
    overlay.offsetHeight;
    overlay.classList.add('active');
}

/**
 * Hide global loading overlay
 */
function hideGlobalLoading() {
    const overlay = document.querySelector('.global-loading-overlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
}

/**
 * Show button loading state
 * @param {HTMLElement} button - Button element to show loading state
 */
function setButtonLoading(button, loading = true) {
    if (loading) {
        button.classList.add('btn-loading');
        button.disabled = true;
        button.dataset.originalText = button.textContent;
    } else {
        button.classList.remove('btn-loading');
        button.disabled = false;
        if (button.dataset.originalText) {
            button.textContent = button.dataset.originalText;
            delete button.dataset.originalText;
        }
    }
}

/**
 * Create skeleton loader for structure list
 */
function createStructureListSkeleton() {
    return `
        <div class="structure-list-skeleton">
            <div class="skeleton skeleton-header"></div>
            <div class="skeleton-tabs">
                <div class="skeleton skeleton-tab"></div>
                <div class="skeleton skeleton-tab"></div>
                <div class="skeleton skeleton-tab"></div>
            </div>
            <div class="skeleton skeleton-table">
                <div class="skeleton-table-header">
                    <div class="skeleton skeleton-text"></div>
                </div>
                <div class="skeleton-table-body">
                    <div class="skeleton skeleton-table-row"></div>
                    <div class="skeleton skeleton-table-row"></div>
                    <div class="skeleton skeleton-table-row"></div>
                    <div class="skeleton skeleton-table-row"></div>
                    <div class="skeleton skeleton-table-row"></div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Show page loading state
 * @param {HTMLElement} container - Container to show loading state
 * @param {string} message - Loading message
 */
function showPageLoading(container, message = 'Loading...') {
    container.innerHTML = `
        <div class="page-loading">
            <div class="spinner"></div>
            <p>${message}</p>
        </div>
    `;
}

// Export utility functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        showGlobalLoading,
        hideGlobalLoading,
        setButtonLoading,
        createStructureListSkeleton,
        showPageLoading
    };
}
