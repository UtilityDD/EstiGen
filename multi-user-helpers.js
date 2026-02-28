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
        // IDs are strings (e.g. 'LT-BARE'); use standard Supabase 'in' filter with array.
        // The Supabase JS client handles the underlying PostgREST syntax automatically.
        defaultQuery = defaultQuery.not('id', 'in', customIds);
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
    resetToDefault,
    forkStructure
};

/**
 * Fork a structure for a user and apply updates immediately.
 * Handles both "First Fork" and "Update Existing Fork".
 * @param {Object} supabase - Supabase client instance
 * @param {string} structureId - Logical ID of the structure (e.g. 'pole-1')
 * @param {string} userId - User ID
 * @param {Object} changes - Object containing changes (materials, labour)
 * @returns {Promise<Object>} The updated structure
 */
async function forkStructure(supabase, structureId, userId, changes) {
    // 1. Get the existing definition (either Custom or Default)
    // We prioritize Custom if it exists, to merge changes incrementally if needed.
    // For now, we assume 'changes' contains the FULL new lists for materials/labour, 
    // but fetching helps preserve other fields like Name/Description.

    // Try to get user's existing custom row
    let { data: existingCustom } = await supabase
        .from('structures')
        .select('*')
        .eq('id', structureId)
        .eq('user_id', userId)
        .maybeSingle();

    let baseItem = existingCustom;

    // If no custom row, get the default row
    if (!baseItem) {
        const { data: defaultItem, error: defError } = await supabase
            .from('structures')
            .select('*')
            .eq('id', structureId)
            .is('user_id', null)
            .maybeSingle();

        if (defError || !defaultItem) throw new Error(`Structure '${structureId}' not found.`);
        baseItem = defaultItem;
    }

    // 2. Prepare the new/updated record
    // We start with the base item, override with changes, and force user_id
    const newRecord = {
        ...baseItem,
        user_id: userId,
        materials: changes.materials || baseItem.materials,
        labour: changes.labour || baseItem.labour
    };

    // Remove system fields we don't want to copy/write manually
    delete newRecord.created_at;
    delete newRecord.updated_at;

    // IMPORTANT: If this is a FORK (not an update to existing custom), 
    // we MUST remove the record_id of the default item so it inserts a new row.
    if (!existingCustom) {
        delete newRecord.record_id;
    }

    // 3. Upsert based on Primary Key (record_id)
    // If record_id is present, it updates. If missing, it inserts.
    // The DB unique index structures_id_user_idx protects us from logical duplicates.
    const { data: upserted, error: upsertError } = await supabase
        .from('structures')
        .upsert(newRecord)
        .select()
        .single();

    if (upsertError) throw upsertError;

    return upserted;
}
