const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkStructures() {
    const { data, error } = await supabase
        .from('structures')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching structures:', error);
    } else {
        console.log('Columns in structures table:', data.length > 0 ? Object.keys(data[0]) : 'Table is empty');

        const { error: queryError } = await supabase
            .from('structures')
            .select('user_id')
            .limit(1);

        if (queryError) {
            console.log('❌ user_id column does NOT exist in structures');
        } else {
            console.log('✅ user_id column exists in structures');
        }
    }
}

checkStructures();
