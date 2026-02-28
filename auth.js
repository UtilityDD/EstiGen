
// Wrapper for Supabase Auth

var supabaseClient = null;

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

/**
 * Core login function
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<Object>} The authenticated user data
 */
async function loginUser(email, password) {
    const client = await initSupabase();
    if (!client) throw new Error('Authentication system is currently unavailable.');

    const { data, error } = await client.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) throw error;
    return data;
}

// Legacy alias for admin login (to be safe)
async function login(email, password) {
    const data = await loginUser(email, password);
    // Fetch profile to verify status
    if (data.user) {
        const profile = await getUserProfile(data.user.id);

        // 1. Forced change priority
        if (profile && profile.must_change_password) {
            window.location.href = 'change-password.html';
            return data;
        }

        // 2. Role redirection
        if (profile && profile.role === 'admin') {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'index.html';
        }
    }
    return data;
}

// Logout function
async function logout() {
    const client = await initSupabase();
    if (!client) return;

    await client.auth.signOut();
    // Redirect to the surveyor login by default as it's the main entry point
    window.location.href = 'user-login.html';
}

// Get current session/user
async function getCurrentUser() {
    const client = await initSupabase();
    if (!client) return null;

    const { data: { session }, error } = await client.auth.getSession();
    if (error || !session) return null;

    return session.user;
}

/**
 * Fetch the user's profile/role from the profiles table
 * @param {string} userId
 */
async function getUserProfile(userId) {
    const client = await initSupabase();
    if (!client || !userId) return null;

    const { data, error } = await client.from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) {
        console.warn('Profile not found for user:', userId);
        return null;
    }
    return data;
}

// Protect Page Guard - redirects to login if not authenticated
async function checkAuth(customRedirect = 'user-login.html') {
    const user = await getCurrentUser();
    if (!user) {
        window.location.href = customRedirect;
        return null;
    }

    // Check if password change is required
    const profile = await getUserProfile(user.id);
    if (profile && profile.must_change_password) {
        // If they are not already on the change-password page, redirect them
        if (!window.location.pathname.includes('change-password.html')) {
            window.location.href = 'change-password.html';
            return null;
        }
    } else if (window.location.pathname.includes('change-password.html')) {
        // If they don't need to change password but are on the change page, send to index
        window.location.href = 'index.html';
        return null;
    }

    return user;
}

/**
 * Update user's password and clear the reset flag
 * @param {string} newPassword 
 */
async function updatePassword(newPassword) {
    const client = await initSupabase();
    if (!client) throw new Error('System unavailable');

    // 1. Update Auth Password
    const { error: authError } = await client.auth.updateUser({
        password: newPassword
    });
    if (authError) throw authError;

    // 2. Clear flag in profile
    const user = await getCurrentUser();
    const { error: profileError } = await client.from('profiles')
        .update({ must_change_password: false })
        .eq('id', user.id);

    if (profileError) throw profileError;
    return true;
}

// Export as a global object as well for convenience
window.auth = {
    loginUser,
    login,
    logout,
    getCurrentUser,
    getUserProfile,
    updatePassword,
    checkAuth,
    initSupabase
};

// Global helpers (to be used directly in HTML/other scripts)
window.loginUser = loginUser;
window.getCurrentUser = getCurrentUser;
window.checkAuth = checkAuth;
window.logout = logout;
window.getUserProfile = getUserProfile;
window.updatePassword = updatePassword;
