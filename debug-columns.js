const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkColumns() {
    const { data, error } = await supabase
        .from('estimates')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching estimates:', error);
    } else {
        console.log('Columns in estimates table:', data.length > 0 ? Object.keys(data[0]) : 'Table is empty');

        // Try to query specifically for user_id to see if it exists
        const { error: queryError } = await supabase
            .from('estimates')
            .select('user_id')
            .limit(1);

        if (queryError) {
            console.log('❌ user_id column does NOT exist');
            console.error(queryError.message);
        } else {
            console.log('✅ user_id column exists');
        }
    }
}

checkColumns();
