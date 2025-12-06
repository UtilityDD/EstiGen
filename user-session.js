// User Session Management
// Simple session-based user identification using localStorage

class UserSession {
    constructor() {
        this.userIdKey = 'estigen_user_id';
        this.init();
    }

    // Initialize or retrieve user ID
    init() {
        let userId = localStorage.getItem(this.userIdKey);

        if (!userId) {
            // Generate unique user ID
            userId = this.generateUserId();
            localStorage.setItem(this.userIdKey, userId);
            console.log('✅ New user session created:', userId);
        } else {
            console.log('✅ Existing user session loaded:', userId);
        }

        return userId;
    }

    // Generate unique user ID
    generateUserId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 15);
        return `user_${timestamp}_${random}`;
    }

    // Get current user ID
    getUserId() {
        return localStorage.getItem(this.userIdKey);
    }

    // Clear user session (for testing/reset)
    clearSession() {
        localStorage.removeItem(this.userIdKey);
        console.log('🗑️ User session cleared');
        return this.init(); // Create new session
    }

    // Set custom user ID (for migration/import)
    setUserId(userId) {
        localStorage.setItem(this.userIdKey, userId);
        console.log('✅ User ID set to:', userId);
    }
}

// Create global instance
const userSession = new UserSession();

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = userSession;
}
