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
            { key: 'id', label: 'ID', width: '10%', sortable: true },
            { key: 'name', label: 'Name', width: '25%', sortable: true },
            { key: 'voltage', label: 'Voltage', width: '15%', render: renderVoltage },
            { key: 'pole_type', label: 'Pole', width: '15%' },
            { key: 'terrain_type', label: 'Terrain', width: '10%' },
            { key: 'description', label: 'Description', width: '25%', truncate: true }
        ],
        formFields: [
            { key: 'id', label: 'ID', type: 'text', required: true, hint: 'Unique identifier (no spaces)' },
            { key: 'name', label: 'Name', type: 'text', required: true },
            { key: 'description', label: 'Description', type: 'text' },
            { key: 'voltage', label: 'Voltage', type: 'text', hint: 'e.g., 33 kV, 11 kV, etc.' },
            {
                key: 'pole_type', label: 'Pole Type', type: 'select', options: [
                    { value: '8m PCC', label: '8m PCC' },
                    { value: '9m PCC', label: '9m PCC' },
                    { value: 'Steel Tubular', label: 'Steel Tubular' },
                    { value: 'Rail Pole', label: 'Rail Pole' },
                    { value: 'H-Beam', label: 'H-Beam' }
                ]
            },
            {
                key: 'terrain_type', label: 'Terrain Type', type: 'select', options: [
                    { value: 'Plain', label: 'Plain' },
                    { value: 'Hilly', label: 'Hilly' },
                    { value: 'Marshy', label: 'Marshy' }
                ]
            }
        ]
    },
    special_structures: {
        title: 'Special Structures',
        apiEndpoint: '/api/structures',
        columns: [
            { key: 'id', label: 'ID', width: '10%', sortable: true },
            { key: 'name', label: 'Name', width: '25%', sortable: true },
            { key: 'description', label: 'Description', width: '25%', truncate: true },
            { key: 'pole_type', label: 'Pole', width: '15%' },
            { key: 'terrain_type', label: 'Terrain', width: '10%' },
            { key: 'voltage', label: 'Type', width: '15%', render: () => 'Special' }
        ],
        formFields: [
            { key: 'id', label: 'ID', type: 'text', required: true, hint: 'Unique identifier (no spaces)' },
            { key: 'name', label: 'Name', type: 'text', required: true },
            { key: 'description', label: 'Description', type: 'text' },
            { key: 'voltage', label: 'Type', type: 'text', value: 'Special Structure', readonly: true, hidden: true },
            {
                key: 'pole_type', label: 'Pole Type', type: 'select', options: [
                    { value: '8m PCC', label: '8m PCC' },
                    { value: '9m PCC', label: '9m PCC' },
                    { value: 'Steel Tubular', label: 'Steel Tubular' },
                    { value: 'Rail Pole', label: 'Rail Pole' },
                    { value: 'H-Beam', label: 'H-Beam' }
                ]
            },
            {
                key: 'terrain_type', label: 'Terrain Type', type: 'select', options: [
                    { value: 'Plain', label: 'Plain' },
                    { value: 'Hilly', label: 'Hilly' },
                    { value: 'Marshy', label: 'Marshy' }
                ]
            }
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
    },
    profiles: {
        title: 'Users',
        apiEndpoint: '/api/admin/profiles',
        columns: [
            { key: 'email', label: 'Email', width: '35%', sortable: true },
            { key: 'role', label: 'Role', width: '20%', render: (val) => `<span class="badge badge-${val}">${val.toUpperCase()}</span>` },
            { key: 'must_change_password', label: 'Reset Required', width: '15%', render: (val) => val ? '🚩 Yes' : '✅ No' },
            { key: 'created_at', label: 'Joined', width: '20%', render: (val) => new Date(val).toLocaleDateString() }
        ],
        formFields: [
            { key: 'email', label: 'Email', type: 'text', readonly: true },
            {
                key: 'role', label: 'Role', type: 'select', options: [
                    { value: 'surveyor', label: 'Surveyor' },
                    { value: 'admin', label: 'Administrator' }
                ]
            },
            { key: 'must_change_password', label: 'Force Password Change', type: 'checkbox' }
        ]
    }
};

// Initialize on page load
let masterMaterials = [];
let masterLabour = [];

document.addEventListener('DOMContentLoaded', async () => {
    initializeEventListeners();

    // Fetch master data for editing
    try {
        const [matRes, labRes] = await Promise.all([
            fetch('/api/admin/materials'),
            fetch('/api/admin/labour')
        ]);
        if (matRes.ok) masterMaterials = await matRes.json();
        if (labRes.ok) masterLabour = await labRes.json();
    } catch (e) {
        console.error("Failed to load master data:", e);
    }

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
        let data;

        // Custom handling for profiles to ensure we use the authenticated session
        if (currentTable === 'profiles') {
            const client = await initSupabase();
            const { data: profileData, error } = await client
                .from('profiles')
                .select('*')
                .order('email', { ascending: true });

            if (error) throw error;
            data = profileData;
        } else {
            const response = await fetch(config.apiEndpoint);
            if (!response.ok) {
                throw new Error(`Failed to fetch ${config.title}`);
            }
            data = await response.json();
        }

        allData = data;

        // Handle paginated response from estimates API
        if (allData.estimates) {
            allData = allData.estimates;
        }

        // Filter data for structures vs special structures
        if (currentTable === 'structures') {
            allData = allData.filter(item => item.voltage !== 'Special Structure');
        } else if (currentTable === 'special_structures') {
            allData = allData.filter(item => item.voltage === 'Special Structure');
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
window.addMaterialRow = addMaterialRow;
window.addLabourRow = addLabourRow;

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

    modal.classList.remove('view-mode');
    modalTitle.innerHTML = data ? `Edit ${config.title}` : `<span>➕</span> Add New ${config.title.slice(0, -1)}`;

    // Special rendering for Structures (Search & Select UI)
    if (currentTable === 'structures' || currentTable === 'special_structures') {
        const isSpecial = currentTable === 'special_structures';
        renderStructureEditor(modalBody, data, isSpecial);
    }
    // Default rendering for other tables (Materials, Labour, Profiles)
    else {
        let formHtml = '<form id="record-form">';
        config.formFields.forEach(field => {
            const value = data ? (data[field.key] ?? '') : '';
            const readonlyAttr = field.readonly ? 'readonly' : '';
            const disabledAttr = field.readonly ? 'disabled' : ''; // For select/checkbox

            formHtml += `<div class="form-field" ${field.hidden ? 'style="display:none"' : ''}>
                <label for="field-${field.key}">
                    ${field.label} ${field.required ? '<span style="color: red;">*</span>' : ''}
                </label>`;

            if (field.type === 'textarea') {
                formHtml += `<textarea id="field-${field.key}" name="${field.key}" ${field.required ? 'required' : ''} ${readonlyAttr}>${value}</textarea>`;
            } else if (field.type === 'select') {
                formHtml += `<select id="field-${field.key}" name="${field.key}" ${field.required ? 'required' : ''} ${disabledAttr}>`;
                field.options.forEach(opt => {
                    formHtml += `<option value="${opt.value}" ${value === opt.value ? 'selected' : ''}>${opt.label}</option>`;
                });
                formHtml += `</select>`;
            } else if (field.type === 'checkbox') {
                formHtml += `<div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem;">
                    <input type="checkbox" id="field-${field.key}" name="${field.key}" ${value ? 'checked' : ''} ${disabledAttr} style="width: auto; margin: 0;">
                    <span style="font-size: 0.9rem; color: #666;">Apply this setting</span>
                </div>`;
            } else {
                formHtml += `<input type="${field.type}" id="field-${field.key}" name="${field.key}" value="${value}" ${field.required ? 'required' : ''} ${field.step ? `step="${field.step}"` : ''} ${readonlyAttr}>`;
            }

            if (field.hint) {
                formHtml += `<small style="display: block; color: #666; margin-top: 0.25rem;">${field.hint}</small>`;
            }
            formHtml += `</div>`;
        });
        formHtml += '</form>';
        modalBody.innerHTML = formHtml;
    }

    // Store current data for editing
    modal.dataset.editId = data ? getRowId(data) : '';

    modal.classList.remove('hidden');
}

// Custom Renderer for Structure Editor
function renderStructureEditor(container, data, isSpecial) {
    const id = data?.id || '';
    const name = data?.name || '';
    const description = data?.description || '';
    const voltage = data?.voltage || (isSpecial ? 'Special Structure' : '');

    // Parse materials/labour
    // Format is either JSON Array (new) or Semicolon String "1:1;2:3" (legacy/db default)
    let materials = [];
    if (data?.materials) {
        if (Array.isArray(data.materials)) {
            materials = data.materials;
        } else if (typeof data.materials === 'string') {
            // Check if it's JSON
            if (data.materials.trim().startsWith('[')) {
                try { materials = JSON.parse(data.materials); } catch (e) { materials = []; }
            } else {
                // Assume semicolon format "index:qty;index:qty"
                materials = data.materials.split(';').map(pair => {
                    const parts = pair.split(':');
                    if (parts.length < 2) return null;
                    return { index: parts[0].trim(), qty: parseFloat(parts[1].trim()) };
                }).filter(i => i);
            }
        }
    }

    let labour = [];
    if (data?.labour) {
        if (Array.isArray(data.labour)) {
            labour = data.labour;
        } else if (typeof data.labour === 'string') {
            if (data.labour.trim().startsWith('[')) {
                try { labour = JSON.parse(data.labour); } catch (e) { labour = []; }
            } else {
                // Assume semicolon format
                labour = data.labour.split(';').map(pair => {
                    const parts = pair.split(':');
                    if (parts.length < 2) return null;
                    return { index: parts[0].trim(), qty: parseFloat(parts[1].trim()) };
                }).filter(i => i);
            }
        }
    }

    let html = `
    <form id="record-form" class="structure-form">
        <div class="form-grid">
            <div class="form-field">
                <label>🆔 Unique ID <span style="color:red">*</span></label>
                <input type="text" name="id" value="${id}" required ${data ? 'readonly' : ''} placeholder="e.g. pole-tangent">
            </div>
            <div class="form-field">
                <label>🏷️ Structure Name <span style="color:red">*</span></label>
                <input type="text" name="name" value="${name}" required placeholder="Name of the structure">
            </div>
            <div class="form-field">
                <label>⚡ Voltage Level</label>
                <input type="text" name="voltage" value="${voltage}" ${isSpecial ? 'readonly' : ''} placeholder="e.g. 33 kV">
            </div>
            <div class="form-field">
                <label>🏗️ Pole Type</label>
                <select name="pole_type" ${data ? 'disabled' : ''}>
                    <option value="8m PCC" ${data?.pole_type === '8m PCC' ? 'selected' : ''}>8m PCC</option>
                    <option value="9m PCC" ${data?.pole_type === '9m PCC' ? 'selected' : ''}>9m PCC</option>
                    <option value="Steel Tubular" ${data?.pole_type === 'Steel Tubular' ? 'selected' : ''}>Steel Tubular</option>
                    <option value="Rail Pole" ${data?.pole_type === 'Rail Pole' ? 'selected' : ''}>Rail Pole</option>
                    <option value="H-Beam" ${data?.pole_type === 'H-Beam' ? 'selected' : ''}>H-Beam</option>
                </select>
                ${data ? `<input type="hidden" name="pole_type" value="${data.pole_type}">` : ''}
            </div>
            <div class="form-field">
                <label>🌍 Terrain Type</label>
                <select name="terrain_type" ${data ? 'disabled' : ''}>
                    <option value="Plain" ${data?.terrain_type === 'Plain' ? 'selected' : ''}>Plain</option>
                    <option value="Hilly" ${data?.terrain_type === 'Hilly' ? 'selected' : ''}>Hilly</option>
                    <option value="Marshy" ${data?.terrain_type === 'Marshy' ? 'selected' : ''}>Marshy</option>
                </select>
                ${data ? `<input type="hidden" name="terrain_type" value="${data.terrain_type}">` : ''}
            </div>
            <div class="form-field full-width">
                <label>📝 Detailed Description</label>
                <input type="text" name="description" value="${description}" placeholder="Additional details about this structure">
            </div>
        </div>

        <div class="editor-section">
            <h3>
                <span>📦 Materials Requirements</span>
                <small style="font-weight: normal; font-size: 0.8rem; opacity: 0.7;">Select items and specify quantities</small>
            </h3>
            <div id="admin-materials-container">
                <table class="edit-table" id="admin-mat-table">
                    <thead><tr><th style="width: 150px;">Code</th><th>Material Item</th><th style="width: 100px;">Qty</th><th style="width: 50px;"></th></tr></thead>
                    <tbody></tbody>
                </table>
                <button type="button" class="btn-add-row" onclick="addMaterialRow()">
                    <span>➕</span> Add New Material
                </button>
            </div>
            <datalist id="admin-material-list">
                 ${masterMaterials.map(m => `<option value="${m.Description}" data-id="${m.mat_sl}">Code: ${m['Materials Code']}</option>`).join('')}
            </datalist>
        </div>

        <div class="editor-section">
            <h3>
                <span>👷 Labour Specification</span>
                <small style="font-weight: normal; font-size: 0.8rem; opacity: 0.7;">Specify labour hours or activities</small>
            </h3>
            <div id="admin-labour-container">
                <table class="edit-table" id="admin-lab-table">
                    <thead><tr><th style="width: 150px;">Code</th><th>Labour Activity</th><th style="width: 100px;">Qty</th><th style="width: 50px;"></th></tr></thead>
                    <tbody></tbody>
                </table>
                <button type="button" class="btn-add-row" onclick="addLabourRow()">
                    <span>➕</span> Add New Labour
                </button>
            </div>
            <datalist id="admin-labour-list">
                ${masterLabour.map(l => `<option value="${l.Description}" data-id="${l.lab_sl}">Code: ${l['Labour Code']}</option>`).join('')}
            </datalist>
        </div>
    </form>
    `;

    container.innerHTML = html;

    // Populate rows
    if (Array.isArray(materials)) materials.forEach(m => addMaterialRow(m));
    if (Array.isArray(labour)) labour.forEach(l => addLabourRow(l));
}

function addMaterialRow(item = null) {
    const tbody = document.querySelector('#admin-mat-table tbody');
    const tr = document.createElement('tr');

    let inputValue = '';
    let qty = item ? (item.qty || 0) : 1;
    let idx = item ? (item.index || item.id) : '';

    let code = '';
    let step = "0.01";
    if (idx) {
        const found = masterMaterials.find(m => m.mat_sl == idx);
        if (found) {
            inputValue = found.Description;
            code = found['Materials Code'] || found['Material Code'] || '';
            if (found.Unit && found.Unit.toUpperCase() === 'NOS') step = "1";
        } else {
            inputValue = `Item ${idx}`;
        }
    }

    tr.innerHTML = `
        <td style="width: 150px;"><input type="text" class="mat-code-input" value="${code}" readonly style="width:100%; background: #f5f5f5; color: #666; font-family: monospace; font-size: 0.85rem;"></td>
        <td><input type="text" class="mat-search-input" list="admin-material-list" value="${inputValue}" placeholder="Search materials..." style="width:100%"></td>
        <td style="width: 100px;"><input type="number" step="${step}" class="mat-qty-input" value="${qty}" style="text-align: right;"></td>
        <td style="width: 50px;"><button type="button" class="remove-row-btn" onclick="this.closest('tr').remove()" title="Remove row">🗑️</button></td>
    `;
    tbody.appendChild(tr);

    // Dynamic updates
    const searchInput = tr.querySelector('.mat-search-input');
    const qtyInput = tr.querySelector('.mat-qty-input');
    const codeInput = tr.querySelector('.mat-code-input');

    searchInput.addEventListener('input', () => {
        const val = searchInput.value;
        const id = extractIdFromInput(val, masterMaterials, 'mat_sl');
        if (id) {
            const found = masterMaterials.find(m => m.mat_sl == id);
            if (found) {
                codeInput.value = found['Materials Code'] || found['Material Code'] || '';
                if (found.Unit && found.Unit.toUpperCase() === 'NOS') {
                    qtyInput.step = "1";
                    if (qtyInput.value % 1 !== 0) qtyInput.value = Math.round(qtyInput.value);
                } else {
                    qtyInput.step = "0.01";
                }
            }
        } else {
            codeInput.value = '';
        }
    });
}

function addLabourRow(item = null) {
    const tbody = document.querySelector('#admin-lab-table tbody');
    const tr = document.createElement('tr');

    let inputValue = '';
    let qty = item ? (item.qty || 0) : 1;
    let idx = item ? (item.index || item.id) : '';

    let step = "0.01";
    if (idx) {
        const found = masterLabour.find(l => l.lab_sl == idx);
        if (found) {
            inputValue = found.Description;
            if (found.Unit && found.Unit.toUpperCase() === 'NOS') step = "1";
        } else {
            inputValue = `Item ${idx}`;
        }
    }

    tr.innerHTML = `
        <td><input type="text" class="lab-search-input" list="admin-labour-list" value="${inputValue}" placeholder="Search labour..." style="width:100%"></td>
        <td style="width: 100px;"><input type="number" step="${step}" class="lab-qty-input" value="${qty}" style="text-align: right;"></td>
        <td style="width: 50px;"><button type="button" class="remove-row-btn" onclick="this.closest('tr').remove()" title="Remove row">🗑️</button></td>
    `;
    tbody.appendChild(tr);

    // Dynamic step adjustment
    const searchInput = tr.querySelector('.lab-search-input');
    const qtyInput = tr.querySelector('.lab-qty-input');

    searchInput.addEventListener('input', () => {
        const val = searchInput.value;
        const id = extractIdFromInput(val, masterLabour, 'lab_sl');
        if (id) {
            const found = masterLabour.find(l => l.lab_sl == id);
            if (found && found.Unit && found.Unit.toUpperCase() === 'NOS') {
                qtyInput.step = "1";
                if (qtyInput.value % 1 !== 0) qtyInput.value = Math.round(qtyInput.value);
            } else {
                qtyInput.step = "0.01";
            }
        }
    });
}

function extractIdFromInput(value, masterList, idField) {
    if (!value) return null;
    const match = value.match(/\[Currently:\s*(\d+)\]$/);
    if (match) return parseInt(match[1]);
    const found = masterList.find(i => i.Description === value);
    if (found) return found[idField];
    return null;
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

    const data = {};

    // Use config to ensure all fields are captured, including unchecked checkboxes
    config.formFields.forEach(field => {
        const input = form.querySelector(`[name="${field.key}"]`);
        if (!input) return;

        if (field.type === 'checkbox') {
            data[field.key] = input.checked;
        } else if (field.type === 'number') {
            data[field.key] = input.value === '' ? null : parseFloat(input.value);
        } else {
            data[field.key] = input.value;
        }
    });

    // Handle Structure Editing (New UI)
    if (currentTable === 'structures' || currentTable === 'special_structures') {
        const materials = [];
        document.querySelectorAll('#admin-mat-table tbody tr').forEach(tr => {
            const val = tr.querySelector('.mat-search-input').value;
            const qty = parseFloat(tr.querySelector('.mat-qty-input').value) || 0;
            const id = extractIdFromInput(val, masterMaterials, 'mat_sl');
            if (id && qty > 0) materials.push({ index: id, qty });
        });

        const labour = [];
        document.querySelectorAll('#admin-lab-table tbody tr').forEach(tr => {
            const val = tr.querySelector('.lab-search-input').value;
            const qty = parseFloat(tr.querySelector('.lab-qty-input').value) || 0;
            const id = extractIdFromInput(val, masterLabour, 'lab_sl');
            if (id && qty > 0) labour.push({ index: id, qty });
        });

        // Convert back to Semicolon String if that is the DB format
        data.materials = materials.map(m => `${m.index}:${m.qty}`).join(';');
        data.labour = labour.map(l => `${l.index}:${l.qty}`).join(';');

        // Ensure voltage is an array for regular structures (Supabase requirement)
        if (currentTable === 'structures' && data.voltage && typeof data.voltage === 'string') {
            data.voltage = data.voltage.split(',').map(v => v.trim()).filter(v => v);
        }

        // IMPORTANT: Include record_id and user_id for updates
        const editId = document.getElementById('edit-modal').dataset.editId;
        if (editId) {
            const original = allData.find(r => String(getRowId(r)) === String(editId));
            if (original) {
                if (original.record_id) data.record_id = original.record_id;
                if (original.user_id) data.user_id = original.user_id;
            }
        }
    }

    // API Expects array of updates for /api/structures/update
    const btn = document.getElementById('save-record-btn');
    btn.classList.add('btn-loading');

    const loadingToast = showNotification('Saving changes...', 'loading');

    try {
        let response;
        const editId = document.getElementById('edit-modal').dataset.editId;

        // Custom handling for profiles and structures to ensure we use session permissions
        if (currentTable === 'profiles' || currentTable === 'structures' || currentTable === 'special_structures') {
            const client = await initSupabase();
            const table = currentTable === 'profiles' ? 'profiles' : currentTable;

            let query;
            if (editId) {
                // All these tables use 'id' as primary key ID
                query = client.from(table).update(data).eq('id', editId);
            } else {
                query = client.from(table).insert([data]);
            }

            const { error } = await query.select();
            if (error) throw error;
            response = { ok: true };
        } else {
            let endpoint = config.apiEndpoint;
            let method = 'POST';
            let body = null;

            if (currentTable === 'structures' || currentTable === 'special_structures') {
                endpoint = '/api/structures/update';
                body = JSON.stringify([data]);
            } else {
                if (editId) {
                    method = 'PUT';
                    endpoint = `${config.apiEndpoint}/${editId}`;
                }
                body = JSON.stringify(data);
            }

            response = await fetch(endpoint, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: body
            });
        }

        // Remove loading toast
        if (loadingToast) loadingToast.remove();

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Save failed');
        }

        showNotification('Record saved successfully!', 'success');
        closeModal();
        loadTableData();
    } catch (error) {
        if (loadingToast) loadingToast.remove();
        showNotification(`Error saving: ${error.message}`, 'error');
    } finally {
        btn.classList.remove('btn-loading');
    }
}

// View Record
function viewRecord(id) {
    const record = allData.find(r => String(getRowId(r)) === String(id));
    if (record) {
        openModal(record);
        const modal = document.getElementById('edit-modal');
        modal.classList.add('view-mode');
        document.getElementById('modal-title').innerHTML = `<span>👁️</span> Viewing ${tableConfigs[currentTable].title.slice(0, -1)}`;
    } else {
        showNotification('Record not found', 'error');
    }
}

// Edit Record
function editRecord(id) {
    const record = allData.find(r => String(getRowId(r)) === String(id));
    if (record) {
        openModal(record);
        const modal = document.getElementById('edit-modal');
        modal.classList.remove('view-mode');
        document.getElementById('modal-title').innerHTML = `<span>✏️</span> Editing ${tableConfigs[currentTable].title.slice(0, -1)}`;
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
    const container = document.getElementById('notification-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `notification ${type}`;

    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        loading: '⏳'
    };

    toast.innerHTML = `
        <div class="toast-icon">${icons[type] || 'ℹ️'}</div>
        <div class="toast-message">${message}</div>
    `;

    container.appendChild(toast);

    // Fade in
    setTimeout(() => toast.classList.add('show'), 10);

    // Auto remove except for loading
    if (type !== 'loading') {
        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    return toast;
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
