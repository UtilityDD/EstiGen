// Admin Panel JavaScript - Data Management for All Tables
// Handles CRUD operations, pagination, search, and filters

const ITEMS_PER_PAGE = 20;
let currentTable = 'structures';
let currentPage = 1;
let totalPages = 1;
let allData = [];
let filteredData = [];
let selectedRows = new Set();

// Table Configurations
const tableConfigs = {
    structures: {
        title: 'Structures',
        apiEndpoint: '/api/structures',
        columns: [
            { key: 'id', label: 'ID', width: '15%', sortable: true },
            { key: 'name', label: 'Name', width: '30%', sortable: true },
            { key: 'voltage', label: 'Voltage', width: '20%', render: renderVoltage },
            { key: 'description', label: 'Description', width: '35%', truncate: true }
        ],
        formFields: [
            { key: 'id', label: 'ID', type: 'text', required: true, hint: 'Unique identifier (no spaces)' },
            { key: 'name', label: 'Name', type: 'text', required: true },
            { key: 'description', label: 'Description', type: 'text' },
            { key: 'voltage', label: 'Voltage', type: 'text', hint: 'e.g., 33 kV, 11 kV, etc.' },
            { key: 'materials', label: 'Materials (JSON)', type: 'textarea', hint: 'Format: index:qty pairs separated by semicolons' },
            { key: 'labour', label: 'Labour (JSON)', type: 'textarea', hint: 'Format: index:qty pairs separated by semicolons' }
        ]
    },
    materials: {
        title: 'Materials',
        apiEndpoint: '/api/admin/materials',
        columns: [
            { key: 'mat_sl', label: 'SL No.', width: '10%', sortable: true },
            { key: 'Materials Code', label: 'Code', width: '15%' },
            { key: 'Description', label: 'Description', width: '40%' },
            { key: 'Unit', label: 'Unit', width: '10%' },
            { key: 'Rate(Rs)', label: 'Rate (₹)', width: '15%', align: 'right', render: (val) => parseFloat(val).toFixed(2) }
        ],
        formFields: [
            { key: 'mat_sl', label: 'Serial Number', type: 'number', required: true },
            { key: 'Materials Code', label: 'Material Code', type: 'text', required: true },
            { key: 'Description', label: 'Description', type: 'text', required: true },
            { key: 'Unit', label: 'Unit', type: 'text', required: true },
            { key: 'Rate(Rs)', label: 'Rate (Rs)', type: 'number', required: true, step: '0.01' }
        ]
    },
    labour: {
        title: 'Labour',
        apiEndpoint: '/api/admin/labour',
        columns: [
            { key: 'lab_sl', label: 'SL No.', width: '10%', sortable: true },
            { key: 'Labour Code', label: 'Code', width: '15%' },
            { key: 'Description', label: 'Description', width: '50%' },
            { key: 'Unit', label: 'Unit', width: '10%' },
            { key: 'Rate (Rs)', label: 'Rate (₹)', width: '15%', align: 'right', render: (val) => parseFloat(val).toFixed(2) }
        ],
        formFields: [
            { key: 'lab_sl', label: 'Serial Number', type: 'number', required: true },
            { key: 'Labour Code', label: 'Labour Code', type: 'text' },
            { key: 'Description', label: 'Description', type: 'text', required: true },
            { key: 'Unit', label: 'Unit', type: 'text', required: true },
            { key: 'Rate (Rs)', label: 'Rate (Rs)', type: 'number', required: true, step: '0.01' }
        ]
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    loadTableData();
});

// Event Listeners
function initializeEventListeners() {
    // Tab Navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const table = e.target.dataset.table;
            switchTable(table);
        });
    });

    // Search
    document.getElementById('search-input').addEventListener('input', debounce(handleSearch, 300));
    document.getElementById('search-btn').addEventListener('click', handleSearch);

    // Toolbar Actions
    document.getElementById('add-new-btn').addEventListener('click', () => openModal());
    document.getElementById('delete-selected-btn').addEventListener('click', deleteSelected);
    document.getElementById('export-btn').addEventListener('click', exportData);
    document.getElementById('refresh-btn').addEventListener('click', () => loadTableData());

    // Pagination
    document.getElementById('prev-page').addEventListener('click', () => changePage(currentPage - 1));
    document.getElementById('next-page').addEventListener('click', () => changePage(currentPage + 1));

    // Modal Save
    document.getElementById('save-record-btn').addEventListener('click', saveRecord);
}

// Switch Table
function switchTable(tableName) {
    currentTable = tableName;
    currentPage = 1;
    selectedRows.clear();

    // Update active tab
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.table === tableName);
    });

    // Update filter options based on table
    updateFilterOptions();

    // Load data
    loadTableData();
}

// Load Table Data
async function loadTableData() {
    showLoading(true);
    try {
        const config = tableConfigs[currentTable];
        const response = await fetch(config.apiEndpoint);

        if (!response.ok) {
            throw new Error(`Failed to fetch ${config.title}`);
        }

        allData = await response.json();

        // Handle paginated response from estimates API
        if (allData.estimates) {
            allData = allData.estimates;
        }

        filteredData = [...allData];
        renderTable();
        showNotification(`Loaded ${allData.length} ${config.title.toLowerCase()}`, 'success');
    } catch (error) {
        console.error('Error loading data:', error);
        showNotification(`Error loading data: ${error.message}`, 'error');
        document.getElementById('table-container').innerHTML = '<p class="text-center" style="padding: 2rem;">Failed to load data</p>';
    } finally {
        showLoading(false);
    }
}

// Render Table
function renderTable() {
    const config = tableConfigs[currentTable];
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIdx = startIdx + ITEMS_PER_PAGE;
    const pageData = filteredData.slice(startIdx, endIdx);

    totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);

    let html = `
        <table class="data-table">
            <thead>
                <tr>
                    ${!config.readOnly ? '<th class="checkbox-cell"><input type="checkbox" id="select-all"></th>' : ''}
                    ${config.columns.map(col => `
                        <th class="${col.sortable ? 'sortable' : ''}" 
                            style="width: ${col.width || 'auto'}; text-align: ${col.align || 'left'}"
                            data-key="${col.key}">
                            ${col.label}
                        </th>
                    `).join('')}
                    <th style="width: 150px;">Actions</th>
                </tr>
            </thead>
            <tbody>
    `;

    if (pageData.length === 0) {
        html += `<tr><td colspan="${config.columns.length + 2}" class="text-center" style="padding: 2rem;">No records found</td></tr>`;
    } else {
        pageData.forEach((row, idx) => {
            const rowId = getRowId(row);
            const isSelected = selectedRows.has(rowId);

            html += `
                <tr class="${isSelected ? 'selected' : ''}" data-id="${rowId}">
                    ${!config.readOnly ? `<td class="checkbox-cell"><input type="checkbox" class="row-checkbox" ${isSelected ? 'checked' : ''}></td>` : ''}
                    ${config.columns.map(col => {
                // Try exact key first, then try case-insensitive match
                let value = row[col.key];
                if (value === undefined || value === null) {
                    // Try to find the key in a case-insensitive way
                    const foundKey = Object.keys(row).find(k => k.toLowerCase() === col.key.toLowerCase());
                    if (foundKey) value = row[foundKey];
                }
                if (col.render) {
                    value = col.render(value, row);
                }
                const classes = col.truncate ? 'truncate' : '';
                const align = col.align || 'left';
                return `<td class="${classes}" style="text-align: ${align}" title="${value}">${value || '-'}</td>`;
            }).join('')}
                    <td class="table-actions">
                        <button class="btn btn-secondary btn-icon" onclick="viewRecord('${rowId}')" title="View">👁️</button>
                        ${!config.readOnly ? `<button class="btn btn-primary btn-icon" onclick="editRecord('${rowId}')" title="Edit">✏️</button>` : ''}
                        ${!config.readOnly ? `<button class="btn btn-danger btn-icon" onclick="deleteRecord('${rowId}')" title="Delete">🗑️</button>` : ''}
                    </td>
                </tr>
            `;
        });
    }

    html += `
            </tbody>
        </table>
    `;

    document.getElementById('table-container').innerHTML = html;

    // Update pagination
    updatePagination();

    // Add event listeners for checkboxes
    if (!config.readOnly) {
        document.getElementById('select-all')?.addEventListener('change', (e) => {
            document.querySelectorAll('.row-checkbox').forEach(cb => {
                cb.checked = e.target.checked;
                const rowId = cb.closest('tr').dataset.id;
                if (e.target.checked) {
                    selectedRows.add(rowId);
                } else {
                    selectedRows.delete(rowId);
                }
            });
            updateDeleteButton();
        });

        document.querySelectorAll('.row-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const rowId = e.target.closest('tr').dataset.id;
                if (e.target.checked) {
                    selectedRows.add(rowId);
                } else {
                    selectedRows.delete(rowId);
                }
                updateDeleteButton();
            });
        });
    }
}

// Update Pagination
function updatePagination() {
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE + 1;
    const endIdx = Math.min(currentPage * ITEMS_PER_PAGE, filteredData.length);

    document.getElementById('showing-start').textContent = filteredData.length > 0 ? startIdx : 0;
    document.getElementById('showing-end').textContent = endIdx;
    document.getElementById('total-records').textContent = filteredData.length;

    // Update buttons
    document.getElementById('prev-page').disabled = currentPage === 1;
    document.getElementById('next-page').disabled = currentPage === totalPages || totalPages === 0;

    // Render page numbers
    let pageNumbersHtml = '';
    const maxPages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPages / 2));
    let endPage = Math.min(totalPages, startPage + maxPages - 1);

    if (endPage - startPage < maxPages - 1) {
        startPage = Math.max(1, endPage - maxPages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        pageNumbersHtml += `<button class="${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
    }

    document.getElementById('page-numbers').innerHTML = pageNumbersHtml;
}

// Change Page
function changePage(page) {
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderTable();
    window.scrollTo(0, 0);
}

// Expose functions globally for onclick handlers
window.changePage = changePage;
window.viewRecord = viewRecord;
window.editRecord = editRecord;
window.deleteRecord = deleteRecord;
window.closeModal = closeModal;

// Search Handler
function handleSearch() {
    const query = document.getElementById('search-input').value.toLowerCase().trim();

    if (!query) {
        filteredData = [...allData];
    } else {
        filteredData = allData.filter(row => {
            return Object.values(row).some(val => {
                if (val === null || val === undefined) return false;
                return String(val).toLowerCase().includes(query);
            });
        });
    }

    currentPage = 1;
    renderTable();
}

// Update Filter Options
function updateFilterOptions() {
    const filterSelect = document.getElementById('filter-select');
    // Clear and add default option
    filterSelect.innerHTML = '<option value="">All Categories</option>';

    // Add filters based on table type
    // This can be expanded based on requirements
}

// Open Modal for Add/Edit
function openModal(data = null) {
    const config = tableConfigs[currentTable];
    const modal = document.getElementById('edit-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    modalTitle.textContent = data ? `Edit ${config.title}` : `Add New ${config.title.slice(0, -1)}`;

    // Build form
    let formHtml = '<form id="record-form">';

    config.formFields.forEach(field => {
        const value = data ? (data[field.key] || '') : '';
        formHtml += `
            <div class="form-field">
                <label for="field-${field.key}">
                    ${field.label} ${field.required ? '<span style="color: red;">*</span>' : ''}
                </label>
                ${field.type === 'textarea'
                ? `<textarea id="field-${field.key}" name="${field.key}" ${field.required ? 'required' : ''}>${value}</textarea>`
                : `<input type="${field.type}" id="field-${field.key}" name="${field.key}" value="${value}" ${field.required ? 'required' : ''} ${field.step ? `step="${field.step}"` : ''}>`
            }
                ${field.hint ? `<small style="color: #666;">${field.hint}</small>` : ''}
            </div>
        `;
    });

    formHtml += '</form>';
    modalBody.innerHTML = formHtml;

    // Store current data for editing
    modal.dataset.editId = data ? getRowId(data) : '';

    modal.classList.remove('hidden');
}

// Close Modal
function closeModal() {
    document.getElementById('edit-modal').classList.add('hidden');
}

// Save Record
async function saveRecord() {
    const config = tableConfigs[currentTable];
    const form = document.getElementById('record-form');

    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const formData = new FormData(form);
    const data = {};

    for (let [key, value] of formData.entries()) {
        data[key] = value;
    }

    // For structures, handle special formatting
    if (currentTable === 'structures') {
        // Materials and labour should be formatted properly
        // This is a placeholder - adjust based on your API requirements
    }

    showNotification('Saving...', 'warning');

    try {
        // This is a placeholder - implement actual save logic
        console.log('Saving data:', data);
        showNotification('Record saved successfully!', 'success');
        closeModal();
        loadTableData();
    } catch (error) {
        showNotification(`Error saving: ${error.message}`, 'error');
    }
}

// View Record
function viewRecord(id) {
    const record = allData.find(r => String(getRowId(r)) === String(id));
    if (record) {
        openModal(record);
        // Disable form fields for view mode
        setTimeout(() => {
            document.querySelectorAll('#record-form input, #record-form textarea').forEach(field => {
                field.disabled = true;
            });
            document.getElementById('save-record-btn').style.display = 'none';
        }, 100);
    } else {
        showNotification('Record not found', 'error');
    }
}

// Edit Record
function editRecord(id) {
    const record = allData.find(r => String(getRowId(r)) === String(id));
    if (record) {
        openModal(record);
        // Ensure save button is visible
        setTimeout(() => {
            document.getElementById('save-record-btn').style.display = 'inline-block';
        }, 100);
    } else {
        showNotification('Record not found', 'error');
    }
}

// Delete Record
async function deleteRecord(id) {
    if (!confirm('Are you sure you want to delete this record? This action cannot be undone.')) {
        return;
    }

    try {
        showNotification('Deleting...', 'warning');
        // Placeholder - implement actual delete logic
        console.log('Deleting record:', id);
        showNotification('Record deleted successfully!', 'success');
        loadTableData();
    } catch (error) {
        showNotification(`Error deleting: ${error.message}`, 'error');
    }
}

// Delete Selected
async function deleteSelected() {
    if (selectedRows.size === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedRows.size} selected record(s)? This action cannot be undone.`)) {
        return;
    }

    try {
        showNotification('Deleting selected records...', 'warning');
        // Placeholder - implement bulk delete
        console.log('Deleting records:', Array.from(selectedRows));
        showNotification(`${selectedRows.size} records deleted successfully!`, 'success');
        selectedRows.clear();
        loadTableData();
    } catch (error) {
        showNotification(`Error deleting: ${error.message}`, 'error');
    }
}

// Export Data
function exportData() {
    const config = tableConfigs[currentTable];
    const dataStr = JSON.stringify(filteredData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', `${currentTable}_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification('Data exported successfully!', 'success');
}

// Utility Functions
function getRowId(row) {
    // Return appropriate ID based on table
    if (currentTable === 'structures') return row.id;
    if (currentTable === 'materials') return row.mat_sl;
    if (currentTable === 'labour') return row.lab_sl;
    if (currentTable === 'estimates') return row.id;
    return row.id;
}

function renderVoltage(value) {
    if (Array.isArray(value)) {
        return value.join(', ');
    }
    if (typeof value === 'string') {
        // Clean up voltage string
        return value.replace(/[{}'"]/g, '').trim();
    }
    return value || '-';
}

function formatCurrency(value) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2
    }).format(value || 0);
}

function showLoading(show) {
    document.getElementById('loading-state').classList.toggle('hidden', !show);
    document.getElementById('table-container').classList.toggle('hidden', show);
}

function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : '⚠️';
    notification.textContent = `${icon} ${message}`;
    notification.className = `notification ${type}`;

    setTimeout(() => {
        notification.classList.add('hidden');
    }, 4000);
}

function updateDeleteButton() {
    const btn = document.getElementById('delete-selected-btn');
    btn.disabled = selectedRows.size === 0;
    btn.textContent = selectedRows.size > 0 ? `🗑️ Delete Selected (${selectedRows.size})` : '🗑️ Delete Selected';
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
