// Estimates API Routes
// Handles saving, retrieving, and managing saved estimates

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const router = express.Router();

// Validation error handler middleware
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array().map(err => ({
                field: err.path,
                message: err.msg
            }))
        });
    }
    next();
};

module.exports = (supabase) => {

    // Save a new estimate with validation
    router.post('/',
        [
            // Validate estimateData
            body('estimateData').exists().withMessage('estimateData is required'),
            body('estimateData.work_name').trim().notEmpty().withMessage('Work name is required')
                .isLength({ min: 3, max: 300 }).withMessage('Work name must be 3-300 characters'),
            body('estimateData.work_category').trim().notEmpty().withMessage('Work category is required'),
            body('estimateData.voltage_levels').isArray({ min: 1 }).withMessage('At least one voltage level required'),

            // Validate percentages (0-100)
            body('estimateData.gst_percent').isFloat({ min: 0, max: 100 }).withMessage('GST must be 0-100%'),
            body('estimateData.contingency_percent').isFloat({ min: 0, max: 100 }).withMessage('Contingency must be 0-100%'),
            body('estimateData.supervision_percent').isFloat({ min: 0, max: 100 }).withMessage('Supervision must be 0-100%'),
            body('estimateData.cess_percent').isFloat({ min: 0, max: 100 }).withMessage('Cess must be 0-100%'),

            // Validate calculatedResults
            body('calculatedResults').exists().withMessage('calculatedResults is required'),
            body('calculatedResults.total_material_cost').isFloat({ min: 0 }).withMessage('Material cost must be >= 0'),
            body('calculatedResults.total_labour_cost').isFloat({ min: 0 }).withMessage('Labour cost must be >= 0'),
            body('calculatedResults.grand_total').isFloat({ min: 0 }).withMessage('Grand total must be >= 0')
        ],
        handleValidationErrors,
        async (req, res) => {
            try {
                const { estimateData, calculatedResults } = req.body;

                if (!estimateData || !calculatedResults) {
                    return res.status(400).json({ error: 'Missing required data' });
                }

                const { data, error } = await supabase
                    .from('estimates')
                    .insert([{
                        estimate_id: estimateData.estimate_id,
                        work_name: estimateData.work_name,
                        work_category: estimateData.work_category,
                        voltage_levels: estimateData.voltage_levels,
                        prepared_by: estimateData.prepared_by,
                        surveyed_by: estimateData.surveyed_by,
                        structures: estimateData.structures,
                        route_lengths: estimateData.route_lengths || {},
                        gst_percent: estimateData.gst_percent,
                        gst_on: estimateData.gst_on,
                        contingency_percent: estimateData.contingency_percent,
                        contingency_on: estimateData.contingency_on,
                        supervision_percent: estimateData.supervision_percent,
                        supervision_on: estimateData.supervision_on,
                        cess_percent: estimateData.cess_percent,
                        cess_on: estimateData.cess_on,
                        materials: calculatedResults.materials,
                        labour: calculatedResults.labour,
                        total_material_cost: calculatedResults.total_material_cost,
                        total_labour_cost: calculatedResults.total_labour_cost,
                        grand_total: calculatedResults.grand_total
                    }])
                    .select()
                    .single();

                if (error) {
                    console.error('Supabase error saving estimate:', error);
                    throw error;
                }

                console.log(`✅ Estimate saved: ${data.estimate_id}`);
                res.json({ success: true, estimate_id: data.estimate_id, id: data.id });
            } catch (error) {
                console.error('Error saving estimate:', error);
                res.status(500).json({ error: error.message || 'Failed to save estimate' });
            }
        });

    // Get list of estimates with optional filtering
    router.get('/', async (req, res) => {
        try {
            const { limit = 50, offset = 0, category } = req.query;

            let query = supabase
                .from('estimates')
                .select('id, estimate_id, work_name, work_category, grand_total, created_at', { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

            if (category && category !== 'all') {
                query = query.eq('work_category', category);
            }

            const { data, error, count } = await query;

            if (error) {
                console.error('Supabase error fetching estimates:', error);
                throw error;
            }

            console.log(`📋 Fetched ${data.length} estimates (total: ${count})`);
            // Return data array directly instead of nested object
            res.json(data || []);
        } catch (error) {
            console.error('Error fetching estimates:', error);
            res.status(500).json({ error: error.message || 'Failed to fetch estimates' });
        }
    });

    // Get a single estimate by ID with validation
    router.get('/:id',
        [
            param('id').isInt({ min: 1 }).withMessage('Invalid estimate ID - must be a positive integer')
        ],
        handleValidationErrors,
        async (req, res) => {
            try {
                const { id } = req.params;

                const { data, error } = await supabase
                    .from('estimates')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) {
                    if (error.code === 'PGRST116') {
                        return res.status(404).json({ error: 'Estimate not found' });
                    }
                    throw error;
                }

                console.log(`📄 Fetched estimate: ${data.estimate_id}`);
                res.json(data);
            } catch (error) {
                console.error('Error fetching estimate:', error);
                res.status(500).json({ error: error.message || 'Failed to fetch estimate' });
            }
        });

    // Delete an estimate with validation
    router.delete('/:id',
        [
            param('id').isInt({ min: 1 }).withMessage('Invalid estimate ID - must be a positive integer')
        ],
        handleValidationErrors,
        async (req, res) => {
            try {
                const { id } = req.params;

                const { error } = await supabase
                    .from('estimates')
                    .delete()
                    .eq('id', id);

                if (error) throw error;

                console.log(`🗑️ Deleted estimate: ${id}`);
                res.json({ success: true, message: 'Estimate deleted successfully' });
            } catch (error) {
                console.error('Error deleting estimate:', error);
                res.status(500).json({ error: error.message || 'Failed to delete estimate' });
            }
        });

    return router;
};
