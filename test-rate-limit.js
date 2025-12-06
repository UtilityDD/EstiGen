// TEST RATE LIMITING
// Quick test script to verify rate limiting is working
// Run this in browser console at http://localhost:3000

console.log('🧪 Testing Rate Limiting (1 estimate per minute)...\n');

async function testRateLimiting() {
    console.log('📊 Sending 3 rapid requests to /api/generate-estimate...\n');

    for (let i = 1; i <= 3; i++) {
        try {
            const response = await fetch('/api/generate-estimate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    structures: {},
                    structureLibrary: []
                })
            });

            const remainingRequests = response.headers.get('RateLimit-Remaining');
            const limitReset = response.headers.get('RateLimit-Reset');

            if (response.status === 200 || response.status === 500) {
                console.log(`✅ Request ${i}: SUCCESS (${response.status})`);
                console.log(`   Remaining: ${remainingRequests}/1 requests`);
            } else if (response.status === 429) {
                const data = await response.json();
                console.log(`❌ Request ${i}: BLOCKED (429 - Rate Limited)`);
                console.log(`   Message: ${data.message}`);
                console.log(`   Retry after: ${data.retryAfter} seconds`);
            }
            console.log('');

        } catch (error) {
            console.error(`❌ Request ${i}: ERROR - ${error.message}\n`);
        }
    }

    console.log('✅ Test Complete!');
    console.log('Expected: First request succeeds, requests 2-3 blocked with 429');
    console.log('\n⚠️ NOTE: Only 1 estimate allowed per minute (VERY STRICT)');
}

testRateLimiting();
