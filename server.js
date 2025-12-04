const express = require('express');
const path = require('path');
const { supabase } = require('./supabase-config');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies and serve static files
app.use(express.json());
app.use(express.static(__dirname));

// --- Supabase Database Functions ---

// API endpoint to GET the current structure data from Supabase (as JSON)
app.get('/api/structures', async (req, res) => {
    try {
        // Fetch from both structure and special_structure tables
        const [structuresResult, specialStructuresResult] = await Promise.all([
            supabase.from('structures').select('*'),
            supabase.from('special_structures').select('*')
        ]);

        if (structuresResult.error) throw structuresResult.error;
        if (specialStructuresResult.error) throw specialStructuresResult.error;

        // Log the count from each table for debugging
        console.log(`Fetched ${structuresResult.data?.length || 0} rows from 'structures' table.`);
        console.log(`Fetched ${specialStructuresResult.data?.length || 0} rows from 'special_structures' table.`);

        // Combine both results
        const allStructures = [
            ...(structuresResult.data || []),
            ...(specialStructuresResult.data || [])
        ];

        res.json(allStructures);
    } catch (error) {
        console.error("Error reading structure data from Supabase. Full error:", error);
        res.status(500).json({ 
            message: 'Error reading structure data from Supabase.', 
            details: error.message,
            code: error.code, // Send back Supabase-specific error code if available
            hint: error.hint // Send back Supabase-specific hint if available
        });
    }
});

// API endpoint to POST (update) the structure data to Supabase
app.post('/api/structures/update', async (req, res) => {
    const updatedStructures = req.body;

    if (!Array.isArray(updatedStructures)) {
        return res.status(400).send('Invalid data format. Expected an array of structures.');
    }

    try {
        // Separate structures into regular and special based on voltage field
        const regularStructures = updatedStructures.filter(s => s.voltage !== 'Special Structure');
        const specialStructures = updatedStructures.filter(s => s.voltage === 'Special Structure');

        // Update regular structures
        if (regularStructures.length > 0) {
            const { error: structError } = await supabase
                .from('structures')
                .upsert(regularStructures, { onConflict: 'id' });

            if (structError) throw structError;
        }

        // Update special structures
        if (specialStructures.length > 0) {
            const { error: specialError } = await supabase
                .from('special_structures')
                .upsert(specialStructures, { onConflict: 'id' });

            if (specialError) throw specialError;
        }

        res.status(200).json({ message: 'Structures updated successfully!' });
    } catch (error) {
        console.error("Error writing structure data to Supabase:", error.message);
        res.status(500).json({ message: 'An error occurred while saving data.', details: error.message });
    }
});

// API endpoint to generate estimate from posted structures and library
app.post('/api/generate-estimate', async (req, res) => {
    try {
        const payload = req.body || {};
        const structures = payload.structures || {};
        const library = payload.structureLibrary || [];

        console.log(`[API] Generating estimate for ${Object.keys(structures).length} structure types...`);

        // Load material and labour master lists from Supabase
        const [materialsResult, labourResult] = await Promise.all([
            supabase.from('materials').select('*'),
            supabase.from('labour').select('*')
        ]);

        if (materialsResult.error) throw materialsResult.error;
        if (labourResult.error) throw labourResult.error;

        const matRows = materialsResult.data || [];
        const labRows = labourResult.data || [];

        // Build lookup maps by mat_sl and lab_sl
        const matBySl = {};
        matRows.forEach(r => {
            const key = r.mat_sl;
            if (key) matBySl[String(key).trim()] = r;
        });
        const labBySl = {};
        labRows.forEach(r => {
            const key = r.lab_sl;
            if (key) labBySl[String(key).trim()] = r;
        });

        console.log(`Loaded ${Object.keys(matBySl).length} materials and ${Object.keys(labBySl).length} labour items from Supabase.`);
        if (matRows.length > 0) console.log('Sample material:', matRows[0]);
        if (labRows.length > 0) console.log('Sample labour:', labRows[0]);

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
            const rate = parseFloat(entry.mat['Rate(Rs)'] || entry.mat['Rate (Rs)'] || 0);
            const totalQty = entry.totalQty;
            const cost = totalQty * rate;
            return {
                mat_sl: k,
                code: entry.mat['Material Code'] || '',
                name: entry.mat.Description || '',
                unit: entry.mat.Unit || '',
                rate: rate,
                totalQty: totalQty,
                cost: cost
            };
        });

        const labour = Object.keys(labourAgg).map(k => {
            const entry = labourAgg[k];
            const rate = parseFloat(entry.lab['Rate (Rs)'] || entry.lab['Rate(Rs)'] || 0);
            const totalQty = entry.totalQty;
            const cost = totalQty * rate;
            return {
                lab_sl: k,
                code: entry.lab['Labour Code'] || '',
                name: entry.lab.Description || '',
                unit: entry.lab.Unit || '',
                rate: rate,
                totalQty: totalQty,
                cost: cost
            };
        });

        console.log(`[API] Estimate generated: ${materials.length} materials, ${labour.length} labour items`);

        res.json({ materials, labour, missingItems });
    } catch (error) {
        console.error("Error during estimate generation. Full error:", error);
        res.status(500).json({ 
            message: 'An error occurred during estimate generation.', 
            details: error.message,
            code: error.code,
            hint: error.hint
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log('Open your browser and navigate to http://localhost:3000 to use the estimator.');
    console.log('Navigate to http://localhost:3000/admin.html to manage structures.');
});