
const testStrings = [
    "{DTR,\"33 kV\",\"11 kV\",\"LT 3-Ph\",\"LT 1-Ph\"}", // User's example (interpreted as string)
    "{{DTR,\"33 kV\",\"11 kV\",\"LT 3-Ph\",\"LT 1-Ph\"}}", // Double braces
    "{\"DTR\",\"33 kV\",\"11 kV\",\"LT 3-Ph\",\"LT 1-Ph\"}", // JSON-like?
    "{DTR, 33 kV, 11 kV}", // Simple no quotes
    "{DTR, \"33 kV\"}", // Mixed
    "{DTR,\\\"33 kV\\\"}", // Literal backslashes before quotes
];

function parseVoltage(voltageStr) {
    console.log(`\nTesting: ${voltageStr}`);
    let voltage = [];
    if (typeof voltageStr === 'string') {
        if (voltageStr.startsWith('{') && voltageStr.endsWith('}')) {
            const content = voltageStr.slice(1, -1);
            console.log(`  Content: ${content}`);
            if (content) {
                voltage = content.split(',').map(item => {
                    const trimmedItem = item.trim();
                    console.log(`    Item: ${trimmedItem}`);
                    if (trimmedItem.startsWith('"') && trimmedItem.endsWith('"')) {
                        return trimmedItem.slice(1, -1);
                    }
                    return trimmedItem;
                });
            }
        } else {
            voltage = [voltageStr.trim()];
        }
    }
    console.log(`  Result:`, voltage);
    return voltage;
}

testStrings.forEach(parseVoltage);
