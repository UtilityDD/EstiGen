const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'index.html');
const logicPath = path.join(__dirname, 'new_logic.txt');

try {
    let indexContent = fs.readFileSync(indexPath, 'utf8');
    const newLogic = fs.readFileSync(logicPath, 'utf8');

    const startMarker = '// The voltage from the DB might be a string like "{val1,val2}" or just "val1"';
    const endMarker = '// Parse materials string "1:1;3:1;5:3" (semicolon separated)';

    const startIndex = indexContent.indexOf(startMarker);
    const endIndex = indexContent.indexOf(endMarker);

    if (startIndex === -1) {
        throw new Error('Start marker not found');
    }
    if (endIndex === -1) {
        throw new Error('End marker not found');
    }

    const newContent = indexContent.substring(0, startIndex) + newLogic + indexContent.substring(endIndex);

    fs.writeFileSync(indexPath, newContent, 'utf8');
    console.log('Successfully patched index.html');
} catch (err) {
    console.error('Error applying patch:', err);
    process.exit(1);
}
