// Saved Estimates Viewer
let allEstimates = [];

// Load estimates on page load
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Auth Guard
    const user = await checkAuth('user-login.html');
    if (!user) return;

    window.currentUser = user;

    // 2. Initialize User UI
    if (window.currentUser) {
        const user = window.currentUser;
        document.getElementById('user-name').textContent = user.user_metadata?.full_name || user.email.split('@')[0];
        document.getElementById('user-email').textContent = user.email;
        document.getElementById('user-initials').textContent = (user.user_metadata?.full_name || user.email)[0].toUpperCase();
    }

    // 3. Add dropdown click handler
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('user-dropdown');
        const trigger = document.getElementById('user-profile-trigger');
        if (dropdown && trigger && !trigger.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });

    loadEstimates();
    setupSearch();
});

// UI Helper functions
function toggleUserDropdown() {
    const dropdown = document.getElementById('user-dropdown');
    if (dropdown) dropdown.classList.toggle('active');
}

// Fetch estimates from API
async function loadEstimates() {
    // Don't show loader immediately - wait a bit to avoid flash on fast loads
    const loaderTimeout = setTimeout(() => {
        showLoader(true);
    }, 200); // Only show loader if request takes > 200ms

    try {
        const userId = window.currentUser ? window.currentUser.id : '';
        const response = await fetch(`/api/estimates?userId=${userId}`);
        if (!response.ok) throw new Error('Failed to fetch estimates');

        allEstimates = await response.json();
        clearTimeout(loaderTimeout); // Cancel loader if we loaded fast
        renderEstimates(allEstimates);
        showLoader(false);
    } catch (error) {
        clearTimeout(loaderTimeout);
        console.error('Error loading estimates:', error);
        alert('❌ Failed to load estimates: ' + error.message);
        showLoader(false);
    }
}

// Render estimates table
function renderEstimates(estimates) {
    const tbody = document.getElementById('estimatesBody');
    const emptyState = document.getElementById('emptyState');
    const tableContainer = document.querySelector('.table-responsive');

    if (!estimates || estimates.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        if (tableContainer) tableContainer.style.display = 'none';
        return;
    }

    emptyState.style.display = 'none';
    if (tableContainer) tableContainer.style.display = 'block';

    // Sort by created date (newest first)
    estimates.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    tbody.innerHTML = estimates.map(est => `
        <tr>
            <td><strong>${est.estimate_id}</strong></td>
            <td>${est.work_name}</td>
            <td>${est.work_category}</td>
            <td>${formatDate(est.created_at)}</td>
            <td class="text-right">₹${formatNumber(est.grand_total)}</td>
            <td class="action-btn-group">
                <button class="btn btn-primary btn-icon" onclick="viewEstimate('${est.id}')" title="View">👁️</button>
                <button class="btn btn-danger btn-icon" onclick="deleteEstimate('${est.id}', '${est.estimate_id}')" title="Delete">🗑️</button>
            </td>
        </tr>
    `).join('');
}

// View/Open an estimate
async function viewEstimate(id) {
    try {
        const response = await fetch(`/api/estimates/${id}`);
        if (!response.ok) throw new Error('Failed to fetch estimate');

        const estimate = await response.json();

        // Store estimate data in sessionStorage to load in main page
        sessionStorage.setItem('loadedEstimate', JSON.stringify(estimate));

        // Redirect to main page
        window.location.href = 'index.html?load=true';
    } catch (error) {
        console.error('Error loading estimate:', error);
        alert('❌ Failed to load estimate: ' + error.message);
    }
}

// Delete an estimate
async function deleteEstimate(id, estimateId) {
    if (!confirm(`Are you sure you want to delete estimate ${estimateId}?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/estimates/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete estimate');

        alert('✅ Estimate deleted successfully');
        loadEstimates(); // Refresh list
    } catch (error) {
        console.error('Error deleting estimate:', error);
        alert('❌ Failed to delete estimate: ' + error.message);
    }
}

// Refresh estimates list
function refreshEstimates() {
    loadEstimates();
}

// Setup search functionality
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = allEstimates.filter(est =>
            est.estimate_id.toLowerCase().includes(query) ||
            est.work_name.toLowerCase().includes(query) ||
            est.work_category.toLowerCase().includes(query)
        );
        renderEstimates(filtered);
    });
}

// Show/hide loader with smooth transitions
function showLoader(show) {
    const loader = document.getElementById('loader');
    if (show) {
        loader.style.display = 'flex';
        // Trigger reflow to enable transition
        loader.offsetHeight;
        loader.style.opacity = '1';
    } else {
        loader.style.opacity = '0';
        setTimeout(() => {
            loader.style.display = 'none';
        }, 200); // Match CSS transition duration
    }
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Format number with commas
function formatNumber(num) {
    if (!num) return '0.00';
    return parseFloat(num).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}
