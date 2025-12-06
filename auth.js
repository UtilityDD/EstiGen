
// Wrapper for Supabase Auth

let supabaseClient = null;

// Initialize Supabase
async function initSupabase() {
    if (supabaseClient) return supabaseClient;

    try {
        const response = await fetch('/api/config');
        if (!response.ok) throw new Error('Failed to load config');

        const config = await response.json();
        if (!config.supabaseUrl || !config.supabaseAnonKey) {
            throw new Error('Supabase configuration missing');
        }

        supabaseClient = supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
        return supabaseClient;
    } catch (error) {
        console.error('Failed to initialize Supabase:', error);
        return null;
    }
}

// Login function
async function login(email, password) {
    const client = await initSupabase();
    if (!client) throw new Error('Auth system not initialized');

    const { data, error } = await client.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) throw error;

    // Successful login - redirect
    window.location.href = 'admin.html';
    return data;
}

// Logout function
async function logout() {
    const client = await initSupabase();
    if (!client) return;

    await client.auth.signOut();
    window.location.href = 'login.html';
}

// Get current user (session check)
async function getCurrentUser() {
    const client = await initSupabase();
    if (!client) return null;

    const { data: { session }, error } = await client.auth.getSession();
    if (error || !session) return null;

    return session.user;
}

// Protect Page Guard
async function checkAuth() {
    const user = await getCurrentUser();
    if (!user) {
        // Not authenticated, redirect to login
        window.location.href = 'login.html';
        return null;
    }
    return user;
}
