// Multi-User Helper Functions
// Utilities for merging default and custom user data

/**
 * Merge default and custom user data from a table
 * @param {Object} supabase - Supabase client instance
 * @param {string} tableName - Name of the table
 * @param {string|null} userId - User ID (null for defaults only)
 * @returns {Promise<Array>} Merged array of data
 */
async function mergeUserData(supabase, tableName, userId) {
    if (!userId) {
        // No user ID provided, return all defaults
        const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .is('user_id', null);

        if (error) throw error;
        return data || [];
    }

    // Get user's custom data
    const { data: customData, error: customError } = await supabase
        .from(tableName)
        .select('*')
        .eq('user_id', userId);

    if (customError) throw customError;

    // Get IDs of items user has customized
    const customIds = (customData || []).map(item => item.id);

    // Get defaults that user hasn't customized
    let defaultQuery = supabase
        .from(tableName)
        .select('*')
        .is('user_id', null);

    if (customIds.length > 0) {
        defaultQuery = defaultQuery.not('id', 'in', `(${customIds.join(',')})`);
    }

    const { data: defaultData, error: defaultError } = await defaultQuery;

    if (defaultError) throw defaultError;

    // Merge custom + defaults
    return [...(customData || []), ...(defaultData || [])];
}

/**
 * Clone a default item for user customization
 * @param {Object} supabase - Supabase client instance
 * @param {string} tableName - Name of the table
 * @param {string} itemId - ID of item to clone
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Cloned item
 */
async function cloneForUser(supabase, tableName, itemId, userId) {
    // Get the default item
    const { data: defaultItem, error: fetchError } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', itemId)
        .is('user_id', null)
        .single();

    if (fetchError) throw new Error('Default item not found');

    // Check if user already has custom version
    const { data: existing, error: checkError } = await supabase
        .from(tableName)
        .select('id')
        .eq('id', itemId)
        .eq('user_id', userId)
        .maybeSingle();

    if (existing) {
        throw new Error('User already has a custom version of this item');
    }

    // Create custom copy
    const customCopy = { ...defaultItem, user_id: userId };
    delete customCopy.created_at; // Let database set new timestamp

    const { data: cloned, error: insertError } = await supabase
        .from(tableName)
        .insert([customCopy])
        .select()
        .single();

    if (insertError) throw insertError;

    return cloned;
}

/**
 * Reset user's custom item to default
 * @param {Object} supabase - Supabase client instance
 * @param {string} tableName - Name of the table
 * @param {string} itemId - ID of item to reset
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
async function resetToDefault(supabase, tableName, itemId, userId) {
    const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', itemId)
        .eq('user_id', userId);

    if (error) throw error;
}

module.exports = {
    mergeUserData,
    cloneForUser,
    resetToDefault
};
