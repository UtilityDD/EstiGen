const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies and serve static files
app.use(express.json());
app.use(express.static(__dirname));
// Serve the data folder from the parent directory at the /data route
app.use('/data', express.static(path.join(__dirname, '..', 'data')));

// --- File Paths ---
const STRUCTURE_FILE = path.join(__dirname, '..', 'data', 'structure.csv');

// --- CSV Parser Utility ---
function parseCSV(text) {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        // Handle quoted values with commas inside
        const values = parseCSVLine(lines[i]);
        if (values.length === headers.length) {
            const row = {};
            for (let j = 0; j < headers.length; j++) {
                row[headers[j]] = values[j];
            }
            rows.push(row);
        }
    }
    return rows;
}

function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current.trim());
    return values;
}

// --- CSV Generator Utility ---
function generateCSV(structures) {
    const headers = ['id', 'name', 'description', 'voltage', 'materials', 'labour'];
    const lines = [headers.join(',')];
    
    structures.forEach(s => {
        const row = [
            s.id,
            `"${s.name}"`,
            `"${s.description}"`,
            `"${s.voltage}"`,
            `"${s.materials}"`,
            `"${s.labour}"`
        ];
        lines.push(row.join(','));
    });
    
    return lines.join('\n');
}

// API endpoint to GET the current structure data (as JSON)
app.get('/api/structures', (req, res) => {
    try {
        const csvText = fs.readFileSync(STRUCTURE_FILE, 'utf-8');
        const structures = parseCSV(csvText);
        
        // Convert to the format expected by the app
        const formattedStructures = structures.map(s => ({
            id: s.id,
            name: s.name,
            description: s.description,
            voltage: s.voltage,
            materials: s.materials,
            labour: s.labour
        }));
        
        res.json(formattedStructures);
    } catch (error) {
        console.error("Error reading structure file:", error.message);
        res.status(500).json({ message: 'Error reading structure data.', details: error.message });
    }
});

// API endpoint to POST (update) the structure data
app.post('/api/structures/update', (req, res) => {
    const updatedStructures = req.body;

    if (!Array.isArray(updatedStructures)) {
        return res.status(400).send('Invalid data format. Expected an array of structures.');
    }

    try {
        const csvContent = generateCSV(updatedStructures);
        fs.writeFileSync(STRUCTURE_FILE, csvContent, 'utf-8');
        res.status(200).json({ message: 'Structures updated successfully!' });
    } catch (error) {
        console.error("Error writing structure file:", error.message);
        res.status(500).json({ message: 'An error occurred while saving data.', details: error.message });
    }
});

// API endpoint to generate estimate from posted structures and library
app.post('/api/generate-estimate', (req, res) => {
    try {
        const payload = req.body || {};
        const structures = payload.structures || {};
        const library = payload.structureLibrary || [];

        // Load material and labour master lists
        const matText = fs.readFileSync(path.join(__dirname, '..', 'data', 'mat.csv'), 'utf-8');
        const labText = fs.readFileSync(path.join(__dirname, '..', 'data', 'lab.csv'), 'utf-8');
        const matRows = parseCSV(matText);
        const labRows = parseCSV(labText);

        // Build lookup maps by mat_sl and lab_sl
        const matBySl = {};
        matRows.forEach(r => {
            const key = r.mat_sl || r['mat_sl'];
            if (key) matBySl[String(key).trim()] = r;
        });
        const labBySl = {};
        labRows.forEach(r => {
            const key = r.lab_sl || r['lab_sl'];
            if (key) labBySl[String(key).trim()] = r;
        });

        const materialsAgg = {}; // key = mat_sl
        const labourAgg = {}; // key = lab_sl
        const missingItems = [];

        // structures is expected as { structureId: quantity }
        for (const sid of Object.keys(structures)) {
            const qty = Number(structures[sid]) || 0;
            if (qty <= 0) continue;
            const struct = library.find(s => String(s.id) === String(sid));
            if (!struct) continue;

            // struct.materials expected as array of { index, qty }
            const mats = struct.materials || [];
            mats.forEach(m => {
                const matKey = String(m.index);
                const perQty = Number(m.qty) || 0;
                const totalQty = perQty * qty;
                if (!matBySl[matKey]) {
                    if (!missingItems.includes(matKey)) missingItems.push(matKey);
                    return;
                }
                if (!materialsAgg[matKey]) materialsAgg[matKey] = { mat: matBySl[matKey], totalQty: 0 };
                materialsAgg[matKey].totalQty += totalQty;
            });

            const labs = struct.labour || [];
            labs.forEach(l => {
                const labKey = String(l.index);
                const perQty = Number(l.qty) || 0;
                const totalQty = perQty * qty;
                if (!labBySl[labKey]) {
                    if (!missingItems.includes(labKey)) missingItems.push(labKey);
                    return;
                }
                if (!labourAgg[labKey]) labourAgg[labKey] = { lab: labBySl[labKey], totalQty: 0 };
                labourAgg[labKey].totalQty += totalQty;
            });
        }

        // Convert aggregates to arrays with costs
        const materials = Object.keys(materialsAgg).map(k => {
            const entry = materialsAgg[k];
            const rate = parseFloat(entry.mat['Rate(Rs)'] || entry.mat.Rate || 0);
            const totalQty = entry.totalQty;
            const cost = totalQty * rate;
            return {
                mat_sl: k,
                code: entry.mat['Materials Code'] || entry.mat.code || '',
                name: entry.mat.Description || '',
                unit: entry.mat.Unit || '',
                rate: rate,
                totalQty: totalQty,
                cost: cost
            };
        });

        const labour = Object.keys(labourAgg).map(k => {
            const entry = labourAgg[k];
            const rate = parseFloat(entry.lab['Rate(Rs)'] || entry.lab.Rate || 0);
            const totalQty = entry.totalQty;
            const cost = totalQty * rate;
            return {
                lab_sl: k,
                code: entry.lab['Labour Code'] || entry.lab.lab_code || '',
                name: entry.lab.Description || '',
                unit: entry.lab.Unit || '',
                rate: rate,
                totalQty: totalQty,
                cost: cost
            };
        });

        res.json({ materials, labour, missingItems });
    } catch (error) {
        console.error('generate-estimate error', error);
        res.status(500).json({ message: 'Internal server error during estimate generation', details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log('Open your browser and navigate to http://localhost:3000 to use the estimator.');
    console.log('Navigate to http://localhost:3000/admin.html to manage structures.');
});