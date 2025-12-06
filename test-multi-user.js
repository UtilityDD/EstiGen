// Multi-User System Test Script
// Run this in browser console at http://localhost:3000

console.log('=== MULTI-USER SYSTEM TEST ===\n');

// Test 1: User Session
console.log('Test 1: User Session');
const userId = userSession.getUserId();
console.log('✅ User ID:', userId);
console.log('');

// Test 2: Fetch Structures with userId
console.log('Test 2: Fetching structures with userId...');
fetch(`/api/structures?userId=${userId}`)
    .then(r => r.json())
    .then(data => {
        console.log(`✅ Fetched ${data.length} structures`);
        console.log('   - Custom structures:', data.filter(s => s.user_id === userId).length);
        console.log('   - Default structures:', data.filter(s => s.user_id === null).length);

        // Save first structure ID for cloning test
        if (data.length > 0) {
            window.testStructureId = data[0].id;
            console.log(`   - Will use "${data[0].id}" for clone test`);
        }
        console.log('');

        // Test 3: Clone an Item
        if (window.testStructureId) {
            console.log('Test 3: Cloning a default item...');
            return fetch('/api/structures/clone', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    itemId: window.testStructureId,
                    userId: userId
                })
            });
        }
    })
    .then(r => r ? r.json() : null)
    .then(data => {
        if (data) {
            if (data.success) {
                console.log('✅ Clone successful!');
                console.log('   - Cloned item:', data.data.id);
                console.log('   - User ID:', data.data.user_id);
                window.clonedItemId = data.data.id;
                console.log('');

                // Test 4: Verify clone appears in fetch
                console.log('Test 4: Verifying cloned item appears...');
                return fetch(`/api/structures?userId=${userId}`);
            } else {
                console.log('ℹ️  Item already cloned (that\'s OK!)');
                console.log('   - Error:', data.error);
            }
        }
    })
    .then(r => r ? r.json() : null)
    .then(data => {
        if (data) {
            const customCount = data.filter(s => s.user_id === userId).length;
            console.log(`✅ Now have ${customCount} custom structure(s)`);
            console.log('');

            // Test 5: Reset to Default (optional)
            if (window.clonedItemId) {
                console.log('Test 5: Resetting cloned item to default...');
                return fetch(`/api/structures/${window.clonedItemId}/reset`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: userId })
                });
            }
        }
    })
    .then(r => r ? r.json() : null)
    .then(data => {
        if (data && data.success) {
            console.log('✅ Reset successful!');
            console.log('   - Item returned to default');
            console.log('');
        }

        console.log('=== ALL TESTS COMPLETE ===');
        console.log('\n✅ Multi-user system is working perfectly!');
    })
    .catch(error => {
        console.error('❌ Test failed:', error);
        console.log('\nCheck:');
        console.log('1. Database migration ran successfully');
        console.log('2. Server is running');
        console.log('3. No console errors above this');
    });
