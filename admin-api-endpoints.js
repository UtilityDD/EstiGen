
// --- Admin API Endpoints for Materials and Labour ---
// Add these before the app.listen() call in server.js

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
app.put('/api/admin/materials/:id', async (req, res) => {
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
app.put('/api/admin/labour/:id', async (req, res) => {
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
app.delete('/api/admin/materials/:id', async (req, res) => {
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
app.delete('/api/admin/labour/:id', async (req, res) => {
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
