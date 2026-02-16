// --- DATA SOURCES ---
let structureLibrary = []; // Will be populated from the server

// --- UI HELPERS ---
function toggleUserDropdown() {
    const dropdown = document.getElementById('user-dropdown');
    if (dropdown) dropdown.classList.toggle('active');
}

// --- APPLICATION STATE ---
const estimate = {
    workCategory: '',
    voltageLevels: [],
    routeLengths: {}, // { voltage: { length: km, conductor: 'size' } }
    structures: {}, // { structureId: quantity }
    workName: '',
    preparedBy: '',
    surveyedBy: '',
    estimateId: '',
    gstPercent: 18,
    contingencyPercent: 3,
    gstOn: 'mat-lab',
    contingencyOn: 'mat-lab',
    supervisionPercent: 5,
    cessPercent: 1,
    supervisionOn: 'mat-lab',
    cessOn: 'mat-lab'
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize User UI
    if (window.currentUser) {
        const user = window.currentUser;
        document.getElementById('user-name').textContent = user.user_metadata?.full_name || user.email.split('@')[0];
        document.getElementById('user-email').textContent = user.email;
        document.getElementById('user-initials').textContent = (user.user_metadata?.full_name || user.email)[0].toUpperCase();

        // Show admin link if email contains admin (or check metadata)
        if (user.email.includes('admin')) {
            document.getElementById('admin-dropdown-link').classList.remove('hidden');
        }
    }

    // Dropdown click outside handler
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('user-dropdown');
        const trigger = document.getElementById('user-profile-trigger');
        if (dropdown && trigger && !trigger.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });

    // Show loading overlay while fetching structure data
    showGlobalLoading('Syncing your structure database...');

    try {
        // Get user ID for multi-user support
        const userId = window.currentUser ? window.currentUser.id : null;

        // Fetch all structures directly from the Supabase-backed API
        const response = await fetch(`/api/structures?userId=${userId}`);
        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}: ${await response.text()}`);
        }
        const rawStructures = await response.json();
        console.log("Total raw structures loaded from API:", rawStructures.length);

        // Process raw structures into the format the app expects
        structureLibrary = rawStructures.map(s => {
            // The data from the API is already structured, but we may need to parse string fields
            const materialsStr = s.materials || '';
            const labourStr = s.labour || '';

            // The voltage from the DB might be a string like "{val1,val2}" or just "val1"
            let voltage = [];
            if (Array.isArray(s.voltage)) {
                // It's already a proper JS array, use it directly
                voltage = s.voltage;
            } else if (typeof s.voltage === 'string') {
                console.log(`Raw voltage for ${s.name}:`, s.voltage); // Debug log

                let cleanStr = s.voltage.trim();

                // Handle potential double stringification or escaped quotes
                // e.g. "{DTR,\"33 kV\"}" -> {DTR,"33 kV"}
                cleanStr = cleanStr.replace(/\\"/g, '"');

                // Remove outer braces { } repeatedly to handle {{...}}
                while (cleanStr.startsWith('{') && cleanStr.endsWith('}')) {
                    cleanStr = cleanStr.slice(1, -1);
                }

                if (cleanStr) {
                    // Split by comma
                    // Note: This simple split assumes no commas INSIDE the voltage values themselves.
                    voltage = cleanStr.split(',').map(item => {
                        let val = item.trim();
                        // Remove surrounding quotes if present
                        if (val.startsWith('"') && val.endsWith('"')) {
                            val = val.slice(1, -1);
                        }
                        // Remove surrounding single quotes if present
                        if (val.startsWith("'") && val.endsWith("'")) {
                            val = val.slice(1, -1);
                        }
                        return val;
                    }).filter(v => v.length > 0);
                }
            } else {
                // It's null, undefined, or some other type (e.g., number)
                voltage = [];
            }

            // Parse materials string "1:1;3:1;5:3" (semicolon separated)
            const materials = materialsStr.split(';')
                .map(pair => {
                    const parts = pair.split(':');
                    if (parts.length < 2) return null;
                    return {
                        index: parseInt(parts[0].trim(), 10),
                        qty: parseFloat(parts[1].trim())
                    };
                })
                .filter(item => item && !isNaN(item.index) && !isNaN(item.qty));

            // Parse labour string (semicolon separated)
            const labour = labourStr.split(';')
                .map(pair => {
                    const parts = pair.split(':');
                    if (parts.length < 2) return null;
                    return {
                        index: parseInt(parts[0].trim(), 10),
                        qty: parseFloat(parts[1].trim())
                    };
                })
                .filter(item => item && !isNaN(item.index) && !isNaN(item.qty));

            return {
                id: s.id || '',
                name: s.name || '',
                description: s.description || '',
                voltage: voltage, // Use the parsed array
                materials: materials,
                labour: labour
            };
        });

        // Sort the library by name
        structureLibrary.sort((a, b) => a.name.localeCompare(b.name));
        console.log("Structure library loaded and processed successfully:", structureLibrary.length, "structures");
        console.log("Sample structure voltages:", structureLibrary.slice(0, 3).map(s => ({ name: s.name, voltage: s.voltage })));

        // Hide loading overlay after successful load
        hideGlobalLoading();

    } catch (error) {
        console.error("Failed to load structure library from API:", error.message);
        hideGlobalLoading();
        alert("Error: Could not load the core structure data from the server. The application may not function correctly.");
    }

    // --- CHECK FOR SAVED ESTIMATE LOAD ---
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('load') === 'true') {
        const savedEstimateStr = sessionStorage.getItem('loadedEstimate');
        if (savedEstimateStr) {
            try {
                const savedEstimate = JSON.parse(savedEstimateStr);
                // Use a tiny delay to ensure the DOM is fully ready for manipulation
                setTimeout(() => loadAndRenderSavedEstimate(savedEstimate), 100);
                sessionStorage.removeItem('loadedEstimate'); // Clean up after loading
            } catch (e) {
                console.error("Error parsing and loading saved estimate:", e);
                alert("Could not load the saved estimate data. It may be corrupt.");
            }
        }
    } else {
        // If not loading a saved estimate, start at step 1
        document.getElementById('step-1').classList.add('active');
        currentStep = 1;
    }

    // --- STEP 1: WORK CATEGORY ---
    document.getElementById('work-category-cards').addEventListener('click', (e) => {
        if (e.target.classList.contains('card')) {
            estimate.workCategory = e.target.dataset.value;
            goToStep(2);
        }
    });

    // --- STEP 2: VOLTAGE LEVELS ---
    document.getElementById('voltage-cards').addEventListener('click', (e) => {
        if (e.target.classList.contains('card')) {
            const card = e.target;
            const value = card.dataset.value;
            card.classList.toggle('selected');
            if (estimate.voltageLevels.includes(value)) {
                estimate.voltageLevels = estimate.voltageLevels.filter(v => v !== value);
            } else {
                estimate.voltageLevels.push(value);
            }
        }
    });
});

// --- UI NAVIGATION ---
let currentStep = 1;

function goToStep(stepNumber) {
    // Smooth scroll to the top of the container
    const container = document.querySelector('.container');
    if (container) {
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (stepNumber === 3) {
        if (estimate.voltageLevels.length === 0) {
            alert("Please select at least one voltage level.");
            return;
        }
        renderStructureList();
    }
    if (stepNumber === 4) {
        // Pre-fill Step 4 fields when navigating to it
        document.getElementById('work-name').value = estimate.workName;
        document.getElementById('prepared-by').value = estimate.preparedBy;
        document.getElementById('surveyed-by').value = estimate.surveyedBy;

        // Auto-focus first field
        setTimeout(() => document.getElementById('work-name')?.focus(), 500);
    }
    if (stepNumber === 4.5) {
        // Step 4.5 is a sub-step, auto-focus GST percent
        setTimeout(() => document.getElementById('gst-percent')?.focus(), 500);
    }
    if (stepNumber === 5) {
        // Capture values from Step 4 and 4.5 and validate
        const workName = document.getElementById('work-name').value.trim();
        const preparedBy = document.getElementById('prepared-by').value.trim();
        const surveyedBy = document.getElementById('surveyed-by').value.trim();

        if (!workName || !preparedBy || !surveyedBy) {
            alert('Please fill out all fields in Step 4: Work Name, Prepared By, and Surveyed By.');
            goToStep(4); // Go back to the form if validation fails
            return;
        }

        estimate.workName = workName;
        estimate.preparedBy = preparedBy;
        estimate.surveyedBy = surveyedBy;

        estimate.gstPercent = parseFloat(document.getElementById('gst-percent').value) || 0;
        estimate.gstOn = document.querySelector('input[name="gst-on"]:checked').value;
        estimate.contingencyPercent = parseFloat(document.getElementById('contingency-percent').value) || 0;
        estimate.contingencyOn = document.querySelector('input[name="contingency-on"]:checked').value;
        estimate.supervisionPercent = parseFloat(document.getElementById('supervision-percent').value) || 0;
        estimate.supervisionOn = document.querySelector('input[name="supervision-on"]:checked').value;
        estimate.cessPercent = parseFloat(document.getElementById('cess-percent').value) || 0;
        estimate.cessOn = document.querySelector('input[name="cess-on"]:checked').value;
        generateEstimate();
    }

    // Update visuals
    document.getElementById(`step-${currentStep}`).classList.remove('active');
    document.getElementById(`step-${stepNumber}`).classList.add('active');

    // Update Stepper
    updateStepper(stepNumber);

    // Auto-focus logic for step 3 (search) or other steps
    if (stepNumber === 3) {
        setTimeout(() => document.getElementById('structure-search')?.focus(), 500);
    }

    currentStep = stepNumber;

    if (stepNumber === 1) { // Reset if going back to start
        resetEstimate();
    }
}

function updateStepper(step) {
    // Determine main step index (4.5 maps to step 4)
    const mainStep = Math.floor(step);

    for (let i = 1; i <= 5; i++) {
        const ind = document.getElementById(`step-ind-${i}`);
        if (!ind) continue;

        ind.classList.remove('active', 'completed');

        if (i < mainStep) {
            ind.classList.add('completed');
        } else if (i === mainStep) {
            ind.classList.add('active');
        }
    }
}

function resetEstimate() {
    estimate.workCategory = '';
    estimate.voltageLevels = [];
    estimate.routeLengths = {};
    estimate.structures = {};
    estimate.workName = '';
    estimate.preparedBy = '';
    estimate.surveyedBy = '';
    estimate.estimateId = '';
    estimate.gstPercent = 18;
    estimate.contingencyPercent = 3;
    estimate.gstOn = 'mat-lab';
    estimate.contingencyOn = 'mat-lab';
    estimate.supervisionPercent = 5;
    estimate.cessPercent = 1;
    estimate.supervisionOn = 'mat-lab';
    estimate.cessOn = 'mat-lab';

    document.querySelectorAll('.card.selected').forEach(c => c.classList.remove('selected'));
    document.getElementById('work-name').value = '';
    document.getElementById('prepared-by').value = '';
    document.getElementById('surveyed-by').value = '';
    document.getElementById('estimate-output').style.display = 'none';
    document.getElementById('export-buttons').style.display = 'none';
    document.getElementById('loader').style.display = 'block';
}


// --- STEP 3: STRUCTURES ---
function filterStructures(query) {
    renderStructureList(query);
}

function renderStructureList(searchTerm = '') {
    const tabsContainer = document.getElementById('structure-tabs-container');
    const query = searchTerm.toLowerCase().trim();

    // Show skeleton loader while rendering if it's the first time or searchTerm is empty
    if (!searchTerm) {
        tabsContainer.innerHTML = createStructureListSkeleton();
    }

    // Use setTimeout to allow skeleton to render before processing
    setTimeout(() => {
        tabsContainer.innerHTML = ''; // Clear skeleton or previous results

        // --- DEBUGGING LOG ---
        console.log("--- Debugging Structure Filter ---");
        console.log("User selected voltage levels:", JSON.stringify(estimate.voltageLevels, null, 2));
        // --- END DEBUGGING LOG ---

        try {
            const relevantStructures = structureLibrary.filter(s => {
                if (!s || !Array.isArray(s.voltage)) return false;

                // Filter by voltage level
                const matchesVoltage = s.voltage.some(v => estimate.voltageLevels.includes(v));
                if (!matchesVoltage) return false;

                // Filter by search term if provided
                if (query) {
                    return s.name.toLowerCase().includes(query) ||
                        String(s.id).toLowerCase().includes(query);
                }

                return true;
            });

            if (relevantStructures.length === 0) {
                tabsContainer.innerHTML = '<p>No structures available for the selected voltage levels.</p>';
                return;
            }

            // Create tab structure
            const tabButtons = document.createElement('div');
            tabButtons.className = 'tab-buttons';
            const tabContent = document.createElement('div');
            tabContent.className = 'tab-content';

            // --- Create R/L (Route Length) Tab ---
            const applicableRLVoltages = ['33 kV', '11 kV', 'LT 3-Ph', 'LT 1-Ph'];
            const rlVoltagesToShow = estimate.voltageLevels.filter(v => applicableRLVoltages.includes(v));

            if (rlVoltagesToShow.length > 0) {
                const rlButton = document.createElement('button');
                rlButton.className = 'tab-button active'; // Make R/L active by default and stay active
                rlButton.textContent = 'R/L';
                rlButton.dataset.voltage = 'RL';
                tabButtons.appendChild(rlButton);

                const rlPane = document.createElement('div');
                rlPane.className = 'tab-pane';
                rlPane.style.display = 'block'; // Show its content
                rlPane.dataset.voltage = 'RL';

                // Conductor options - can be expanded
                const conductorOptions = [
                    'Rabbit', 'Weasel', 'Dog', 'Panther', 'Zebra', // ACSR
                    '3x95+1x50+1x16', '3x150+1x70+1x16', '3x240+1x95+1x16', // LT AB Cable
                    '1x11', '1x16', '1x25', '1x35', '1x50', '1x70', '1x95', '1x120', '1x150', '1x185', '1x240', '1x300', '1x400' // XLPE / PVC Cables
                ];
                const conductorSelectOptions = conductorOptions.map(c => `<option value="${c}">${c}</option>`).join('');

                let rlTableRows = '';
                rlVoltagesToShow.forEach(voltage => {
                    const rlData = estimate.routeLengths[voltage] || { length: 0, conductor: '' };
                    rlTableRows += `
                <tr>
                    <td>${voltage}</td>
                    <td><input type="number" id="rl-length-${voltage}" min="0" step="0.01" value="${rlData.length}" onchange="updateRouteLength('${voltage}', this.value)"></td>
                    <td>
                        <select id="rl-conductor-${voltage}" onchange="updateConductor('${voltage}', this.value)">
                            <option value="">-- Select Size --</option>
                            ${conductorSelectOptions}
                        </select>
                    </td>
                </tr>`;
                });

                rlPane.innerHTML = `
                <table class="rl-table">
                    <thead>
                        <tr>
                            <th>Voltage Level</th>
                            <th>Route Length (km)</th>
                            <th>Conductor / Cable Size</th>
                        </tr>
                    </thead>
                    <tbody>${rlTableRows}</tbody>
                </table>`;

                tabContent.appendChild(rlPane);
            }

            tabsContainer.appendChild(tabButtons);
            tabsContainer.appendChild(tabContent);

            // Group and render
            const groupedStructures = {};
            estimate.voltageLevels.forEach(voltage => {
                groupedStructures[voltage] = relevantStructures.filter(s => s.voltage.includes(voltage));
            });

            // If R/L tab exists, it's already active. If not, make the first voltage tab active.
            let isFirstTab = rlVoltagesToShow.length === 0; // Correctly initialize isFirstTab
            for (const voltage in groupedStructures) {
                const structures = groupedStructures[voltage];


                // Create tab button
                const button = document.createElement('button');
                button.className = 'tab-button';
                button.textContent = voltage;
                button.dataset.voltage = voltage;
                tabButtons.appendChild(button);

                // Create tab pane
                const pane = document.createElement('div');
                pane.className = 'tab-pane';
                pane.dataset.voltage = voltage;

                let structureTableRows = '';
                structures.forEach(structure => {
                    const quantity = estimate.structures[structure.id] || 0;
                    structureTableRows += `
                    <tr>
                        <td>${structure.id}</td>
                        <td>
                            ${structure.user_id ? '<span class="badge badge-custom" title="Customized by you">Custom</span> ' : ''}
                            ${structure.name}
                        </td>
                        <td><input type="number" id="qty-${structure.id}" min="0" value="${quantity}" onchange="updateStructureQuantity('${structure.id}', this.value)" style="text-align: center;"></td>
                        <td style="text-align: center;">
                            <button class="btn btn-secondary btn-sm" onclick="openEditModal('${structure.id}')" title="View Structure Details">👁️ Details</button>
                        </td>
                    </tr>
                `;
                });

                pane.innerHTML = `
                <table class="rl-table">
                    <thead>
                        <tr>
                            <th style="width: 20%;">Structure Code</th>
                            <th style="width: 45%;">Structure Name</th>
                            <th style="width: 15%; text-align: center;">Quantity</th>
                            <th style="width: 20%; text-align: center;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${structureTableRows}
                    </tbody>
                </table>
            `;

                tabContent.appendChild(pane);

                if (isFirstTab) {
                    button.classList.add('active');
                    pane.style.display = 'block';
                    isFirstTab = false;
                    isFirstTab = false;
                }
            }

            // After rendering, set the selected conductor values
            estimate.voltageLevels.forEach(voltage => {
                const rlData = estimate.routeLengths[voltage];
                if (rlData && rlData.conductor) {
                    document.getElementById(`rl-conductor-${voltage}`).value = rlData.conductor;
                }
            });
            // Add event listener for tab clicks
            tabButtons.addEventListener('click', (e) => {
                if (e.target.matches('.tab-button')) {
                    const targetVoltage = e.target.dataset.voltage;

                    // Deactivate all
                    tabButtons.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
                    tabContent.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');

                    // Activate target
                    e.target.classList.add('active');
                    tabContent.querySelector(`.tab-pane[data-voltage="${targetVoltage}"]`).style.display = 'block';
                }
            });
        } catch (error) {
            console.error("Critical error in renderStructureList:", error);
            alert("An error occurred while loading structures. Please check the console for details.");
        }
    }, 100); // Short delay to show skeleton
}

function updateRouteLength(voltage, length) {
    if (!estimate.routeLengths[voltage]) estimate.routeLengths[voltage] = {};
    estimate.routeLengths[voltage].length = parseFloat(length) || 0;
    console.log('Updated Route Lengths:', estimate.routeLengths);
    calculateRunningTotal();
}

function updateConductor(voltage, conductor) {
    if (!estimate.routeLengths[voltage]) estimate.routeLengths[voltage] = {};
    estimate.routeLengths[voltage].conductor = conductor;
    console.log('Updated Conductors:', estimate.routeLengths);
}


function updateStructureQuantity(structureId, quantity) {
    const numQuantity = parseInt(quantity, 10);
    if (numQuantity > 0) {
        estimate.structures[structureId] = numQuantity;
    } else {
        delete estimate.structures[structureId];
    }
    calculateRunningTotal();
}

function calculateRunningTotal() {
    let total = 0;

    // Quick estimate based on structureLibrary data which is already in memory
    for (const sid in estimate.structures) {
        const qty = estimate.structures[sid];
        const struct = structureLibrary.find(s => String(s.id) === String(sid));
        if (!struct) continue;

        // This is a rough estimation for the floating widget
        // since full rates require complex logic. We'll use a simplified version
        // or just rely on items that have pre-calculated rates if available.
        // For now, let's trigger a light version of calculation or just show "Calculating..."
    }

    updateFloatingSummary();
}

async function updateFloatingSummary() {
    const summaryEl = document.getElementById('floating-summary');
    const totalEl = document.getElementById('summary-total');

    if (Object.keys(estimate.structures).length > 0) {
        summaryEl.style.display = 'flex';
        totalEl.textContent = 'Updating...';

        try {
            // Call the same logic used for final generation but keep it lightweight
            const payload = {
                structures: estimate.structures,
                structureLibrary: structureLibrary
            };

            const response = await fetch('/api/generate-estimate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                const { materials, labour } = await response.json();
                let subtotal = 0;
                materials.forEach(m => subtotal += (m.cost || 0));
                labour.forEach(l => subtotal += (l.cost || 0));

                // Add basic GST (18%) for the widget total
                const totalWithTax = subtotal * 1.18;
                totalEl.textContent = `₹${totalWithTax.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
            }
        } catch (e) {
            console.error("Running total error:", e);
        }
    } else {
        summaryEl.style.display = 'none';
    }
}

// --- EDIT MODAL FUNCTIONS ---

let currentEditingStructureId = null;
let masterMaterials = [];
let masterLabour = [];

// Fetch master data on load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const [matRes, labRes] = await Promise.all([
            fetch('/api/admin/materials'),
            fetch('/api/admin/labour')
        ]);

        if (matRes.ok) masterMaterials = await matRes.json();
        if (labRes.ok) masterLabour = await labRes.json();

        console.log(`Loaded ${masterMaterials.length} materials and ${masterLabour.length} labour items for editing.`);
    } catch (e) {
        console.error("Failed to load master data for editing:", e);
    }
});

function openEditModal(structureId) {
    const structure = structureLibrary.find(s => s.id === structureId);
    if (!structure) {
        alert("Structure data not found.");
        return;
    }

    currentEditingStructureId = structureId;
    const modal = document.getElementById('edit-structure-modal');
    const modalTitle = document.getElementById('edit-modal-title');
    const modalBody = document.getElementById('edit-modal-body');
    const modalDesc = document.getElementById('edit-modal-desc');

    modalTitle.innerHTML = `<span>👁️</span> Structure Details: ${structure.name}`;
    modalDesc.textContent = structure.description || 'No description available.';

    // Apply view-only mode
    modal.classList.add('view-mode');

    renderStructureEditor(modalBody, structure);

    modal.classList.remove('hidden');
}

function renderStructureEditor(container, data) {
    const { id, name, voltage, description, materials, labour } = data;

    let html = `
    <div class="admin-only-notice">
        <span>⚠️</span>
        <div><strong>Read-Only View:</strong> Structure specifications can only be modified by administrators via the Admin Portal.</div>
    </div>
    <form id="record-form" class="structure-form">
        <div class="form-grid">
            <div class="form-field">
                <label>🆔 Unique ID</label>
                <input type="text" name="id" value="${id}" readonly>
            </div>
            <div class="form-field">
                <label>🏷️ Structure Name</label>
                <input type="text" name="name" value="${name}" readonly>
            </div>
            <div class="form-field">
                <label>⚡ Voltage Level</label>
                <input type="text" name="voltage" value="${voltage || ''}" readonly>
            </div>
        </div>

        <div class="editor-section">
            <h3>
                <span>📦 Materials Requirements</span>
                <small style="font-weight: normal; font-size: 0.8rem; opacity: 0.7;">Customize items and quantities</small>
            </h3>
            <div id="admin-materials-container">
                <table class="edit-table" id="material-edit-table">
                    <thead><tr><th>Material Item</th><th style="width: 100px;">Qty</th><th style="width: 50px;"></th></tr></thead>
                    <tbody></tbody>
                </table>
                <button type="button" class="btn-add-row" onclick="addMaterialRow()">
                    <span>➕</span> Add New Material
                </button>
            </div>
            <datalist id="material-list">
                 ${masterMaterials.map(m => `<option value="${m.Description} [Currently: ${m.mat_sl}]" data-id="${m.mat_sl}">Code: ${m['Material Code']}</option>`).join('')}
            </datalist>
        </div>

        <div class="editor-section">
            <h3>
                <span>👷 Labour Specification</span>
                <small style="font-weight: normal; font-size: 0.8rem; opacity: 0.7;">Customize labour activities</small>
            </h3>
            <div id="admin-labour-container">
                <table class="edit-table" id="labour-edit-table">
                    <thead><tr><th>Labour Activity</th><th style="width: 100px;">Qty</th><th style="width: 50px;"></th></tr></thead>
                    <tbody></tbody>
                </table>
                <button type="button" class="btn-add-row" onclick="addLabourRow()">
                    <span>➕</span> Add New Labour
                </button>
            </div>
            <datalist id="labour-list">
                ${masterLabour.map(l => `<option value="${l.Description} [Currently: ${l.lab_sl}]" data-id="${l.lab_sl}">Code: ${l['Labour Code']}</option>`).join('')}
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
    const tbody = document.querySelector('#material-edit-table tbody');
    if (!tbody) return;
    const tr = document.createElement('tr');

    let inputValue = '';
    let qtyValue = item ? item.qty : 1;
    let step = "0.01";

    if (item) {
        const found = masterMaterials.find(m => m.mat_sl == item.index);
        if (found) {
            inputValue = `${found.Description} [Currently: ${found.mat_sl}]`;
            if (found.Unit && found.Unit.toUpperCase() === 'NOS') step = "1";
        }
    }

    tr.innerHTML = `
        <td><input type="text" class="mat-search-input" list="material-list" value="${inputValue}" placeholder="Search materials..." style="width:100%"></td>
        <td style="width: 100px;"><input type="number" step="${step}" class="mat-qty-input" value="${qtyValue}" style="text-align: right;"></td>
        <td style="width: 50px;"><button type="button" class="remove-row-btn" onclick="this.closest('tr').remove()" title="Remove row">🗑️</button></td>
    `;
    tbody.appendChild(tr);

    // Dynamic step adjustment
    const searchInput = tr.querySelector('.mat-search-input');
    const qtyInput = tr.querySelector('.mat-qty-input');
    searchInput.addEventListener('input', () => {
        const val = searchInput.value;
        const id = extractIdFromInput(val, masterMaterials, 'mat_sl');
        if (id) {
            const found = masterMaterials.find(m => m.mat_sl == id);
            if (found && found.Unit && found.Unit.toUpperCase() === 'NOS') {
                qtyInput.step = "1";
                if (qtyInput.value % 1 !== 0) qtyInput.value = Math.round(qtyInput.value);
            } else {
                qtyInput.step = "0.01";
            }
        }
    });
}

function addLabourRow(item = null) {
    const tbody = document.querySelector('#labour-edit-table tbody');
    if (!tbody) return;
    const tr = document.createElement('tr');

    let inputValue = '';
    let qtyValue = item ? item.qty : 1;
    let step = "0.01";

    if (item) {
        const found = masterLabour.find(l => l.lab_sl == item.index);
        if (found) {
            inputValue = `${found.Description} [Currently: ${found.lab_sl}]`;
            if (found.Unit && found.Unit.toUpperCase() === 'NOS') step = "1";
        }
    }

    tr.innerHTML = `
        <td><input type="text" class="lab-search-input" list="labour-list" value="${inputValue}" placeholder="Search labour..." style="width:100%"></td>
        <td style="width: 100px;"><input type="number" step="${step}" class="lab-qty-input" value="${qtyValue}" style="text-align: right;"></td>
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

function closeEditModal() {
    const modal = document.getElementById('edit-structure-modal');
    modal.classList.add('hidden');
    currentEditingStructureId = null;
}

// Helper to extract ID from input value "Description [Currently: ID]"
function extractIdFromInput(value, masterList, idField) {
    // 1. Try to parse " [Currently: ID]" format
    const match = value.match(/\[Currently:\s*(\d+)\]$/);
    if (match) return parseInt(match[1]);

    // 2. Try to find exact name match
    const found = masterList.find(i => i.Description === value);
    if (found) return found[idField];

    return null;
}

async function saveStructureEdits() {
    if (!currentEditingStructureId) return;

    const saveBtn = document.getElementById('save-structure-btn');
    saveBtn.classList.add('btn-loading');

    // Use server-side auth check or valid user ID logic
    let userId = null;
    try {
        if (typeof auth !== 'undefined' && auth.getCurrentUser) {
            const user = await auth.getCurrentUser();
            userId = user ? user.id : null;
        }

        if (!userId && typeof userSession !== 'undefined') {
            userId = userSession.getUserId();
        }
    } catch (e) {
        console.warn("Auth check failed, trying session fallback", e);
    }

    if (!userId) {
        alert("User session error. Please reload or log in.");
        saveBtn.classList.remove('btn-loading');
        return;
    }

    // Gather Data
    const materials = [];
    const matRows = document.querySelectorAll('#material-edit-table tbody tr');
    for (const tr of matRows) {
        const val = tr.querySelector('.mat-search-input').value;
        const qty = parseFloat(tr.querySelector('.mat-qty-input').value) || 0;

        const id = extractIdFromInput(val, masterMaterials, 'mat_sl');
        if (id && qty > 0) {
            materials.push({ index: id, qty });
        }
    }

    const labour = [];
    const labRows = document.querySelectorAll('#labour-edit-table tbody tr');
    for (const tr of labRows) {
        const val = tr.querySelector('.lab-search-input').value;
        const qty = parseFloat(tr.querySelector('.lab-qty-input').value) || 0;

        const id = extractIdFromInput(val, masterLabour, 'lab_sl');
        if (id && qty > 0) {
            labour.push({ index: id, qty });
        }
    }

    try {
        const response = await fetch('/api/structures/fork-and-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                structureId: currentEditingStructureId,
                userId: userId,
                changes: { materials, labour }
            })
        });

        const result = await response.json();

        if (result.success) {
            alert("Changes saved! This customized structure is now yours.");
            closeEditModal();
            window.location.reload();
        } else {
            alert("Failed to save changes: " + result.error);
        }

    } catch (error) {
        console.error("Save error:", error);
        alert("An error occurred while saving.");
    } finally {
        saveBtn.classList.remove('btn-loading');
    }
}

function toggleDescription(element) {
    element.classList.toggle('expanded');
}

function handleStep3Next() {
    const tabsContainer = document.getElementById('structure-tabs-container');
    const tabButtons = tabsContainer.querySelectorAll('.tab-button');
    const activeTabButton = tabsContainer.querySelector('.tab-button.active');

    if (!activeTabButton) {
        goToStep(4); // Should not happen if tabs are rendered, but as a fallback
        return;
    }

    const currentIndex = Array.from(tabButtons).indexOf(activeTabButton);

    if (currentIndex < tabButtons.length - 1) {
        tabButtons[currentIndex + 1].click(); // Simulate click on the next tab
    } else {
        goToStep(4); // All tabs viewed, proceed to next step
    }
}

// --- STEP 5: ESTIMATE GENERATION ---
async function generateEstimate() {
    // Update loader message
    const loaderElement = document.getElementById('loader');
    const loaderMessage = loaderElement.querySelector('p');
    if (loaderMessage) {
        loaderMessage.innerHTML = 'Generating your estimate<span class="loading-dots"></span>';
    }

    try {
        // 1. Prepare payload for the API
        const payload = {
            structures: estimate.structures, // { structureId: quantity }
            structureLibrary: structureLibrary // The full library, so the backend can find structure details
        };

        // 2. Call the backend API to generate the estimate
        const response = await fetch('/api/generate-estimate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'API request failed');
        }

        const { materials, labour, missingItems } = await response.json();

        // 3. The backend now returns processed data, so we need to adjust renderOutput
        // The new `renderOutput` expects objects with calculated costs. Let's adapt.
        const consolidatedMaterials = {};
        materials.forEach(item => {
            consolidatedMaterials[item.mat_sl] = {
                code: item.code,
                name: item.name,
                unit: item.unit,
                rate: item.rate,
                totalQty: item.totalQty
            };
        });

        const consolidatedLabour = {};
        labour.forEach(item => {
            consolidatedLabour[item.lab_sl] = {
                name: item.name,
                unit: item.unit,
                rate: item.rate,
                totalQty: item.totalQty
            };
        });

        // 4. Render Output with data from the API
        renderOutput(consolidatedMaterials, consolidatedLabour, missingItems);

    } catch (error) {
        console.error("Failed to generate estimate via API:", error);
        document.getElementById('estimate-output').innerHTML = `<div class="error-message"><strong>Error:</strong> ${error.message}. Please check the console for more details.</div>`;
    } finally {
        document.getElementById('loader').style.display = 'none';
        const outputElement = document.getElementById('estimate-output');
        outputElement.style.display = 'block';
        outputElement.classList.add('fade-in-up');
        document.getElementById('export-buttons').style.display = 'block';
    }
}

function openSldPage() {
    window.open('sld.html', '_blank');
}

// Function to download estimate as PDF using html2pdf.js
function downloadEstimatePDF() {
    const element = document.getElementById('estimate-output');

    // Apply compact PDF mode
    element.classList.add('pdf-mode');

    // Create a filename based on work name and estimate ID
    const sanitizedWorkName = estimate.workName.replace(/[^a-z0-9]/gi, '_');
    const filename = `${sanitizedWorkName}_${estimate.estimateId}.pdf`;

    // Configure PDF options
    const options = {
        margin: [8, 8, 8, 8], // top, left, bottom, right in mm (reduced for compact look)
        filename: filename,
        image: {
            type: 'jpeg',
            quality: 0.98
        },
        html2canvas: {
            scale: 2,  // Higher scale for better quality
            useCORS: true,
            letterRendering: true,
            logging: false,
            scrollY: 0,
            scrollX: 0,
            windowHeight: element.scrollHeight
        },
        jsPDF: {
            unit: 'mm',
            format: 'a4',
            orientation: 'portrait',
            compress: true
        },
        pagebreak: {
            mode: ['css', 'legacy'],
            avoid: ['tr', '.no-break']
        }
    };

    // Generate and download the PDF, then remove compact mode
    html2pdf().set(options).from(element).save().then(() => {
        element.classList.remove('pdf-mode');
    }).catch((error) => {
        console.error('PDF generation failed:', error);
        element.classList.remove('pdf-mode');
    });
}

function renderOutput(materials, labour, missingItems) {
    estimate.estimateId = `EST-${Date.now()}`;
    const outputContainer = document.getElementById('estimate-output');

    let totalMaterialCost = 0;
    let totalLabourCost = 0;

    const formatCurrency = (num) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(num);
    const currentDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    // Save data to session storage for the SLD page
    sessionStorage.setItem('estimateDataForSLD', JSON.stringify(estimate));
    sessionStorage.setItem('structureLibraryForSLD', JSON.stringify(structureLibrary));

    // Print header template for each page
    const printHeader = `
            <div class="print-header">
                <div class="print-header-content">
                    <h3>${estimate.workName}</h3>
                    <div class="print-header-info">
                        <span><strong>ID:</strong> ${estimate.estimateId}</span>
                        <span><strong>Date:</strong> ${currentDate}</span>
                        <span><strong>Category:</strong> ${estimate.workCategory}</span>
                    </div>
                </div>
            </div>
        `;

    // Material Table with serial numbers
    let slNo = 1;
    let materialRows = Object.values(materials).map(item => {
        const amount = item.totalQty * item.rate;
        totalMaterialCost += amount;
        return `
                <tr>
                    <td style="text-align: center;">${slNo++}</td>
                    <td>${item.code}</td>
                    <td>${item.name}</td>
                    <td style="text-align: center;">${item.unit}</td>
                    <td style="text-align: right;">${item.totalQty.toFixed(2)}</td>
                    <td style="text-align: right;">${item.rate.toFixed(2)}</td>
                    <td style="text-align: right;">${amount.toFixed(2)}</td>
                </tr>
            `;
    }).join('');

    // Add total row to materials
    materialRows += `
            <tfoot>
                <td colspan="6" style="text-align: right;">Total Material Cost</td>
                <td style="text-align: right;">${formatCurrency(totalMaterialCost)}</td>
            </tfoot>
        `;

    // Labour Table with serial numbers
    let slNoLab = 1;
    let labourRows = Object.values(labour).map(item => {
        const amount = item.totalQty * item.rate;
        totalLabourCost += amount;
        return `
                <tr>
                    <td style="text-align: center;">${slNoLab++}</td>
                    <td>${item.name}</td>
                    <td style="text-align: center;">${item.unit}</td>
                    <td style="text-align: right;">${item.totalQty.toFixed(2)}</td>
                    <td style="text-align: right;">${item.rate.toFixed(2)}</td>
                    <td style="text-align: right;">${amount.toFixed(2)}</td>
                </tr>
            `;
    }).join('');

    // Add total row to labour
    labourRows += `
            <tfoot>
                <td colspan="5" style="text-align: right;">Total Labour Cost</td>
                <td style="text-align: right;">${formatCurrency(totalLabourCost)}</td>
            </tfoot>
        `;

    const subTotal = totalMaterialCost + totalLabourCost;

    const getBase = (type) => {
        if (type === 'mat') return totalMaterialCost;
        if (type === 'lab') return totalLabourCost;
        return subTotal; // 'mat-lab'
    };

    const getLabel = (type) => {
        if (type === 'mat') return 'on Material';
        if (type === 'lab') return 'on Labour';
        return 'on Mat+Lab';
    }

    const gstBase = getBase(estimate.gstOn);
    const gstAmount = gstBase * (estimate.gstPercent / 100);
    const gstLabel = getLabel(estimate.gstOn);

    const contingencyBase = getBase(estimate.contingencyOn);
    const contingencyAmount = contingencyBase * (estimate.contingencyPercent / 100);
    const contingencyLabel = getLabel(estimate.contingencyOn);

    const supervisionBase = getBase(estimate.supervisionOn);
    const supervisionAmount = supervisionBase * (estimate.supervisionPercent / 100);
    const supervisionLabel = getLabel(estimate.supervisionOn);

    const cessBase = getBase(estimate.cessOn);
    const cessAmount = cessBase * (estimate.cessPercent / 100);
    const cessLabel = getLabel(estimate.cessOn);

    // Calculate grand total
    const grandTotal = subTotal + gstAmount + contingencyAmount + supervisionAmount + cessAmount;
    // Convert grand total to words
    const grandTotalInWords = convertNumberToWordsINR(grandTotal);


    const missingItemsHtml = missingItems.length > 0
        ? `<div class="error-message"><strong>Warning:</strong> The following items were not found in the master sheets and have been excluded:<ul>${missingItems.map(i => `<li>${i}</li>`).join('')}</ul></div>`
        : '';

    const outputHTML = `
            ${missingItemsHtml}
            <div class="estimate-header">
                <h2>${estimate.workName}</h2>
                <div class="header-details">
                    <p><strong>Estimate ID:</strong> ${estimate.estimateId}</p>
                    <p><strong>Work Category:</strong> ${estimate.workCategory}</p>
                    <p><strong>Date:</strong> ${currentDate}</p>
                    <p><strong>Voltage Levels:</strong> ${estimate.voltageLevels.join(', ')}</p>
                </div>
            </div>

            <div class="estimate-summary">
                ${printHeader}
                <h3> Material Schedule</h3>
                <table class="estimate-table">
                    <thead>
                        <tr>
                            <th style="text-align: center; width: 5%;">Sl.No</th>
                            <th>Code</th>
                            <th>Item Description</th>
                            <th style="text-align: center; width: 8%;">Unit</th>
                            <th style="text-align: right; width: 10%;">Quantity</th>
                            <th style="text-align: right; width: 12%;">Rate (₹)</th>
                            <th style="text-align: right; width: 15%;">Amount (₹)</th>
                        </tr>
                    </thead>
                    <tbody>${materialRows}</tbody>
                </table>
            </div>

            <div class="estimate-summary">
                ${printHeader}
                <h3>👷 Labour Schedule</h3>
                <table class="estimate-table">
                    <thead>
                        <tr>
                            <th style="text-align: center; width: 5%;">Sl.No</th>
                            <th>Labour Activity</th>
                            <th style="text-align: center; width: 8%;">Unit</th>
                            <th style="text-align: right; width: 10%;">Quantity</th>
                            <th style="text-align: right; width: 12%;">Rate (₹)</th>
                            <th style="text-align: right; width: 15%;">Amount (₹)</th>
                        </tr>
                    </thead>
                    <tbody>${labourRows}</tbody>
                </table>
            </div>

            <div class="estimate-totals">
                ${printHeader}
                <h3>💰 Cost Summary</h3>
                <table class="totals-table">
                    <tbody>
                        <tr>
                            <td>Total Material Cost</td>
                            <td>${formatCurrency(totalMaterialCost)}</td>
                        </tr>
                        <tr>
                            <td>Total Labour Cost</td>
                            <td>${formatCurrency(totalLabourCost)}</td>
                        </tr>
                        <tr>
                            <td><strong>Sub-Total (Material + Labour)</strong></td>
                            <td><strong>${formatCurrency(subTotal)}</strong></td>
                        </tr>
                        <tr>
                            <td>GST (${estimate.gstPercent}% ${gstLabel})</td>
                            <td>${formatCurrency(gstAmount)}</td>
                        </tr>
                        <tr>
                            <td>Contingency (${estimate.contingencyPercent}% ${contingencyLabel})</td>
                            <td>${formatCurrency(contingencyAmount)}</td>
                        </tr>
                        <tr>
                            <td>Supervision (${estimate.supervisionPercent}% ${supervisionLabel})</td>
                            <td>${formatCurrency(supervisionAmount)}</td>
                        </tr>
                        <tr>
                            <td>Cess (${estimate.cessPercent}% ${cessLabel})</td>
                            <td>${formatCurrency(cessAmount)}</td>
                        </tr>
                        <tr>
                            <td>Grand Total</td>
                            <td>${formatCurrency(grandTotal)}</td>
                        </tr>
                    </tbody>
                </table>
                <div class="totals-in-words">
                    <strong>In Words:</strong> Rupees ${grandTotalInWords} Only
                </div>

                <div class="signatures">
                    <div>
                        <p><strong>Survey Done By:</strong></p><p>${estimate.surveyedBy}</p>
                    </div>
                    <div>
                        <p><strong>Estimate Prepared By:</strong></p><p>${estimate.preparedBy}</p>
                    </div>
                </div>
            </div>
        `;

    outputContainer.innerHTML = outputHTML;

    // --- EXPORT DATA FOR SAVING ---
    // These variables are defined in save-estimate.js or will be attached to window
    window.lastGeneratedMaterials = materials;
    window.lastGeneratedLabour = labour;
    window.lastTotalMaterialCost = totalMaterialCost;
    window.lastTotalLabourCost = totalLabourCost;
    window.lastGrandTotal = grandTotal;
}


// Function to convert numbers to words (Indian Rupees)
function convertNumberToWordsINR(num) {
    if (num === 0) return "Zero";

    const a = [
        '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
        'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
        'Eighteen', 'Nineteen'
    ];
    const b = [
        '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
    ];
    const c = [
        '', 'Hundred', 'Thousand', 'Lakh', 'Crore'
    ];

    let n = Math.round(num * 100) / 100; // Round to 2 decimal places
    let integerPart = Math.floor(n);
    let decimalPart = Math.round((n - integerPart) * 100);

    let words = '';

    function convertChunk(val) {
        let chunkWords = '';
        if (val < 20) {
            chunkWords = a[val];
        } else {
            chunkWords = b[Math.floor(val / 10)];
            if (val % 10 !== 0) {
                chunkWords += ' ' + a[val % 10];
            }
        }
        return chunkWords;
    }

    // Convert integer part
    let i = 0;
    let tempNum = integerPart;
    while (tempNum > 0) {
        let chunk;
        if (i === 0) { // Hundreds and tens/units
            chunk = tempNum % 1000;
            tempNum = Math.floor(tempNum / 1000);
            let hundreds = Math.floor(chunk / 100);
            let tensUnits = chunk % 100;
            let currentChunkWords = '';
            if (hundreds > 0) {
                currentChunkWords += a[hundreds] + ' Hundred';
            }
            if (tensUnits > 0) {
                if (hundreds > 0) currentChunkWords += ' and ';
                currentChunkWords += convertChunk(tensUnits);
            }
            if (currentChunkWords) {
                words = currentChunkWords + words;
            }
        } else { // Thousands, Lakhs, Crores
            chunk = tempNum % 100; // Take two digits for Lakhs and Crores
            tempNum = Math.floor(tempNum / 100);
            if (chunk > 0) {
                words = convertChunk(chunk) + ' ' + c[i] + ' ' + words;
            }
        }
        i++;
    }

    if (words.trim() === '') words = 'Zero';

    // Add decimal part
    if (decimalPart > 0) {
        words += ' and ' + convertChunk(decimalPart) + ' Paisa';
    }

    return words.trim();
}
// Save Estimate to Database
// This file contains functions for persisting estimates to Supabase

// Global variables to store the last generated estimate data
let lastGeneratedMaterials = [];
let lastGeneratedLabour = [];
let lastTotalMaterialCost = 0;
let lastTotalLabourCost = 0;
let lastGrandTotal = 0;

// Function to save the current estimate to database
async function saveEstimate() {
    try {
        // Check if we have estimate data to save
        if (!estimate.estimateId) {
            alert('⚠️ No estimate to save. Please generate an estimate first.');
            return;
        }

        // Show saving indicator
        const saveButton = event.target;
        const originalText = saveButton.textContent;
        saveButton.disabled = true;
        saveButton.textContent = '💾 Saving...';

        // Prepare payload
        const payload = {
            estimateData: {
                estimate_id: estimate.estimateId,
                work_name: estimate.workName,
                work_category: estimate.workCategory,
                voltage_levels: estimate.voltageLevels,
                prepared_by: estimate.preparedBy,
                surveyed_by: estimate.surveyedBy,
                structures: estimate.structures,
                route_lengths: estimate.routeLengths,
                gst_percent: estimate.gstPercent,
                gst_on: estimate.gstOn,
                contingency_percent: estimate.contingencyPercent,
                contingency_on: estimate.contingencyOn,
                supervision_percent: estimate.supervisionPercent,
                supervision_on: estimate.supervisionOn,
                cess_percent: estimate.cessPercent,
                cess_on: estimate.cessOn
            },
            calculatedResults: {
                materials: lastGeneratedMaterials,
                labour: lastGeneratedLabour,
                total_material_cost: lastTotalMaterialCost,
                total_labour_cost: lastTotalLabourCost,
                grand_total: lastGrandTotal
            }
        };

        // Send to API
        const response = await fetch('/api/estimates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to save estimate');
        }

        // Success!
        alert(`✅ Estimate saved successfully!\n\nEstimate ID: ${result.estimate_id}`);
        saveButton.textContent = '✅ Saved';

        // Reset button after 2 seconds
        setTimeout(() => {
            saveButton.textContent = originalText;
            saveButton.disabled = false;
        }, 2000);

    } catch (error) {
        console.error('Error saving estimate:', error);
        alert('❌ Failed to save estimate: ' + error.message);

        // Reset button
        const saveButton = event.target;
        saveButton.textContent = '💾 Save Estimate';
        saveButton.disabled = false;
    }
}

// Function to populate application state from saved estimate and render it directly
function loadAndRenderSavedEstimate(savedData) {
    console.log("Loading saved estimate to view:", savedData);

    // 1. Populate the global 'estimate' object so renderOutput and other functions have access to it
    estimate.estimateId = savedData.estimate_id;
    estimate.workName = savedData.work_name;
    estimate.workCategory = savedData.work_category;
    estimate.voltageLevels = savedData.voltage_levels;
    estimate.preparedBy = savedData.prepared_by;
    estimate.surveyedBy = savedData.surveyed_by;
    estimate.structures = savedData.structures;
    estimate.routeLengths = savedData.route_lengths;
    estimate.gstPercent = savedData.gst_percent;
    estimate.gstOn = savedData.gst_on;
    estimate.contingencyPercent = savedData.contingency_percent;
    estimate.contingencyOn = savedData.contingency_on;
    estimate.supervisionPercent = savedData.supervision_percent;
    estimate.supervisionOn = savedData.supervision_on;
    estimate.cessPercent = savedData.cess_percent;
    estimate.cessOn = savedData.cess_on;

    // 2. Directly call renderOutput with the saved materials and labour data
    renderOutput(savedData.materials || {}, savedData.labour || {}, []);

    // 3. Switch the view directly to the final step
    // We do this manually to avoid triggering the logic inside goToStep(5)
    document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
    document.getElementById('step-5').classList.add('active');
    currentStep = 5;

    // 4. Ensure loader is hidden and output is shown
    document.getElementById('loader').style.display = 'none';
    document.getElementById('estimate-output').style.display = 'block';
    document.getElementById('export-buttons').style.display = 'block';
}
