const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { body, param, validationResult } = require('express-validator');
const { mergeUserData, cloneForUser, resetToDefault, forkStructure } = require('./multi-user-helpers');
const { supabase } = require('./supabase-config');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust Vercel's proxy for accurate rate limiting by IP
app.set('trust proxy', 1);

// ============================================
// VALIDATION ERROR HANDLER MIDDLEWARE
// ============================================

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array().map(err => ({
                field: err.path,
                message: err.msg,
                value: err.value
            }))
        });
    }
    next();
};

// ============================================
// SECURITY HEADERS (Helmet.js)
// ============================================

// Apply Helmet security headers
app.use(helmet({
    // Content Security Policy - controls what resources can be loaded
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                "'unsafe-inline'", // Needed for inline scripts in HTML
                "https://cdnjs.cloudflare.com", // For html2pdf.js
                "https://cdn.jsdelivr.net" // For Supabase JS
            ],
            scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers like onclick
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: [
                "'self'",
                process.env.SUPABASE_URL || "https://*.supabase.co", // Allow Supabase API calls
                "https://cdnjs.cloudflare.com" // Allow fetching source maps
            ],
            fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [] // Force HTTPS in production
        }
    },
    // Prevent clickjacking by disallowing the site to be embedded in frames
    frameguard: { action: 'deny' },
    // Hide X-Powered-By header (don't reveal we use Express)
    hidePoweredBy: true,
    // Prevent MIME type sniffing
    noSniff: true,
    // Enable XSS filter in older browsers
    xssFilter: true
}));

console.log('🛡️  Helmet security headers enabled');

// ============================================
// RATE LIMITING CONFIGURATION
// ============================================

// General API rate limiter - applies to all /api/* routes
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests',
        message: 'You have exceeded the rate limit. Please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    // Skip rate limiting for successful responses to allow more legitimate traffic
    skipSuccessfulRequests: false,
});

// Strict limiter for data modification operations (POST, PUT, DELETE)
const strictLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // Limit each IP to 10 requests per minute
    message: {
        error: 'Too many requests',
        message: 'You are making too many changes. Please wait a moment.',
        retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Very strict limiter for expensive operations like estimate generation
const generateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute window
    max: 30, // Relaxed to 30 per minute to accommodate live cost updates
    message: {
        error: 'Rate limit exceeded',
        message: 'You are generating estimates too quickly. Please wait a moment.',
        retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Rate limit exceeded',
            message: 'You are generating estimates too quickly. Please wait a moment.',
            retryAfter: 5 // seconds
        });
    }
});

// Middleware to parse JSON bodies
app.use(express.json());

// Move express.static AFTER API routes to avoid path collisions
// app.use(express.static(__dirname)); // Moved to the end

// Apply general rate limiter to all API routes
app.use('/api', apiLimiter);

// --- API Routes ---

// Import and use estimates routes
const estimatesRoutes = require('./routes/estimates');
app.use('/api/estimates', estimatesRoutes(supabase));

// --- Supabase Database Functions ---

// API endpoint to GET the current structure data from Supabase (as JSON)
app.get('/api/structures', async (req, res) => {
    try {
        const userId = req.query.userId || null;

        // Merge default + custom data for user
        const [structures, specialStructures] = await Promise.all([
            mergeUserData(supabase, 'structures', userId),
            mergeUserData(supabase, 'special_structures', userId)
        ]);

        // Explicitly label special structures
        const labeledSpecialStructures = specialStructures.map(s => ({
            ...s,
            voltage: 'Special Structure'
        }));

        const allStructures = [...structures, ...labeledSpecialStructures];

        console.log(`Fetched ${allStructures.length} structures for ${userId || 'default'} (${structures.filter(s => s.user_id).length} custom)`);

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

// API endpoint to get public Supabase config for frontend
app.get('/api/config', (req, res) => {
    res.json({
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY
    });
});

// ============================================
// MULTI-USER ENDPOINTS (Clone & Reset)
// ============================================

// Clone a default item for user customization
app.post('/api/:table/clone',
    [
        param('table').isIn(['structures', 'special_structures', 'materials', 'labour']).withMessage('Invalid table name'),
        body('itemId').notEmpty().withMessage('Item ID required'),
        body('userId').notEmpty().withMessage('User ID required')
    ],
    handleValidationErrors,
    async (req, res) => {
        try {
            const { table } = req.params;
            const { itemId, userId } = req.body;

            const cloned = await cloneForUser(supabase, table, itemId, userId);

            console.log(`✅ Cloned ${table}/${itemId} for user ${userId}`);
            res.json({ success: true, message: 'Item cloned successfully', data: cloned });
        } catch (error) {
            console.error('Error cloning item:', error);
            res.status(400).json({ success: false, error: error.message });
        }
    }
);

// Reset custom item to default
app.delete('/api/:table/:id/reset',
    [
        param('table').isIn(['structures', 'special_structures', 'materials', 'labour']).withMessage('Invalid table name'),
        param('id').notEmpty().withMessage('Item ID required'),
        body('userId').notEmpty().withMessage('User ID required')
    ],
    handleValidationErrors,
    async (req, res) => {
        try {
            const { table, id } = req.params;
            const { userId } = req.body;

            await resetToDefault(supabase, table, id, userId);

            console.log(`🔄 Reset ${table}/${id} to default for user ${userId}`);
            res.json({ success: true, message: 'Item reset to default' });
        } catch (error) {
            console.error('Error resetting item:', error);
            res.status(400).json({ success: false, error: error.message });
        }
    }
);

// Fork and update a structure (In-App Edit)
app.post('/api/structures/fork-and-update',
    [
        body('structureId').notEmpty().withMessage('Structure ID required'),
        body('userId').notEmpty().withMessage('User ID required'),
        body('changes').isObject().withMessage('Changes object required')
    ],
    handleValidationErrors,
    async (req, res) => {
        try {
            const { structureId, userId, changes } = req.body;

            const updatedStructure = await forkStructure(supabase, structureId, userId, changes);

            console.log(`✅ User ${userId} forked/updated structure ${structureId}`);
            res.json({ success: true, data: updatedStructure });
        } catch (error) {
            console.error('Error in fork-and-update:', error);
            res.status(400).json({ success: false, error: error.message });
        }
    }
);

// API endpoint to POST (update) the structure data to Supabase with validation
app.post('/api/structures/update',
    strictLimiter,
    [
        body().isArray({ min: 1 }).withMessage('Must be a non-empty array'),
        body('*.id').notEmpty().withMessage('Structure ID required'),
        body('*.name').trim().notEmpty().isLength({ max: 200 }).withMessage('Name required (max 200 chars)'),
        body('*.voltage').notEmpty().withMessage('Voltage required')
    ],
    handleValidationErrors,
    async (req, res) => {
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
                console.log(`Processing ${regularStructures.length} regular structures...`);
                for (const s of regularStructures) {
                    const { updated_at, created_at, ...rest } = s;

                    // Handle voltage: ensure it's an array for the 'structures' table
                    if (rest.voltage && !Array.isArray(rest.voltage)) {
                        if (typeof rest.voltage === 'string') {
                            rest.voltage = rest.voltage.split(',').map(v => v.trim()).filter(v => v);
                        } else {
                            rest.voltage = [rest.voltage];
                        }
                    }

                    if (rest.record_id) {
                        const { error: structError } = await supabase
                            .from('structures')
                            .update(rest)
                            .eq('record_id', rest.record_id);
                        if (structError) {
                            console.error(`Error updating structure ${rest.id}:`, structError);
                            throw structError;
                        }
                    } else {
                        const { error: structError } = await supabase
                            .from('structures')
                            .insert([rest]);
                        if (structError) {
                            console.error(`Error inserting structure ${rest.id}:`, structError);
                            throw structError;
                        }
                    }
                }
            }

            // Update special structures
            if (specialStructures.length > 0) {
                console.log(`Processing ${specialStructures.length} special structures...`);
                for (const s of specialStructures) {
                    const { updated_at, created_at, ...rest } = s;

                    if (rest.record_id) {
                        const { error: specialError } = await supabase
                            .from('special_structures')
                            .update(rest)
                            .eq('record_id', rest.record_id);
                        if (specialError) {
                            console.error(`Error updating special structure ${rest.id}:`, specialError);
                            throw specialError;
                        }
                    } else {
                        const { error: specialError } = await supabase
                            .from('special_structures')
                            .insert([rest]);
                        if (specialError) {
                            console.error(`Error inserting special structure ${rest.id}:`, specialError);
                            throw specialError;
                        }
                    }
                }
            }

            res.status(200).json({ message: 'Structures updated successfully!' });
        } catch (error) {
            console.error("Error writing structure data to Supabase:", error.message || error);
            res.status(500).json({
                message: 'An error occurred while saving data.',
                details: error.message || 'Unknown error',
                hint: error.hint || ''
            });
        }
    });

// API endpoint to generate estimate from posted structures and library
app.post('/api/generate-estimate', generateLimiter, async (req, res) => {
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
                code: entry.mat['Materials Code'] || '',
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

// Get all materials with optional search
app.get('/api/admin/materials', async (req, res) => {
    try {
        const { search = '' } = req.query;

        let query = supabase.from('materials').select('*');

        // Add search if provided
        if (search) {
            query = query.or(`Description.ilike.%${search}%,"Material Code".ilike.%${search}%`);
        }

        const { data, error } = await query;

        if (error) throw error;

        console.log(`📦 Fetched ${data.length} materials`);
        res.json(data);
    } catch (error) {
        console.error('Error fetching materials:', error);
        res.status(500).json({ message: 'Error fetching materials', details: error.message });
    }
});

// Get all labour with optional search
app.get('/api/admin/labour', async (req, res) => {
    try {
        const { search = '' } = req.query;

        let query = supabase.from('labour').select('*');

        // Add search if provided
        if (search) {
            query = query.or(`Description.ilike.%${search}%,"Labour Code".ilike.%${search}%`);
        }

        const { data, error } = await query;

        if (error) throw error;

        console.log(`👷 Fetched ${data.length} labour items`);
        res.json(data);
    } catch (error) {
        console.error('Error fetching labour:', error);
        res.status(500).json({ message: 'Error fetching labour', details: error.message });
    }
});

// Update material (single record)
app.put('/api/admin/materials/:id', strictLimiter, async (req, res) => {
    try {
        const { id } = req.params;
        const updatedData = req.body;

        const { data, error } = await supabase
            .from('materials')
            .update(updatedData)
            .eq('mat_sl', id)
            .select()
            .single();

        if (error) throw error;

        res.json({ message: 'Material updated successfully', data });
    } catch (error) {
        console.error('Error updating material:', error);
        res.status(500).json({ message: 'Error updating material', details: error.message });
    }
});

// Update labour (single record)
app.put('/api/admin/labour/:id', strictLimiter, async (req, res) => {
    try {
        const { id } = req.params;
        const updatedData = req.body;

        const { data, error } = await supabase
            .from('labour')
            .update(updatedData)
            .eq('lab_sl', id)
            .select()
            .single();

        if (error) throw error;

        res.json({ message: 'Labour updated successfully', data });
    } catch (error) {
        console.error('Error updating labour:', error);
        res.status(500).json({ message: 'Error updating labour', details: error.message });
    }
});

// Delete material
app.delete('/api/admin/materials/:id', strictLimiter, async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('materials')
            .delete()
            .eq('mat_sl', id);

        if (error) throw error;

        res.json({ message: 'Material deleted successfully' });
    } catch (error) {
        console.error('Error deleting material:', error);
        res.status(500).json({ message: 'Error deleting material', details: error.message });
    }
});

// Delete labour
app.delete('/api/admin/labour/:id', strictLimiter, async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('labour')
            .delete()
            .eq('lab_sl', id);

        if (error) throw error;

        res.json({ message: 'Labour deleted successfully' });
    } catch (error) {
        console.error('Error deleting labour:', error);
        res.status(500).json({ message: 'Error deleting labour', details: error.message });
    }
});

// --- STATIC FILES ---
// Serve static files after all API routes
app.use(express.static(path.join(__dirname, '..')));

// Export the app for Vercel
module.exports = app;

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
        console.log('Open your browser and navigate to http://localhost:3000 to use the estimator.');
        console.log('Navigate to http://localhost:3000/admin.html to manage structures.');
    });
}
