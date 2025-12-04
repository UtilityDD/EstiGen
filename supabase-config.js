require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Load Supabase configuration from environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Validate that required environment variables are present
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('ERROR: Missing required Supabase environment variables.');
    console.error('Please ensure SUPABASE_URL and SUPABASE_ANON_KEY are set in your .env file.');
    process.exit(1);
}

// Create a single supabase client for interacting with your database
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('✓ Supabase client initialized successfully');

module.exports = { supabase };
