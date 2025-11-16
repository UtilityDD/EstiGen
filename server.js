const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
// Use the port provided by the hosting environment (like Render), or default to 3000 for local development.
const PORT = process.env.PORT || 3000;

// In production, data might be on a persistent disk. This uses that path if available.
const DATA_DIR = process.env.DATA_DIR || __dirname;
const STRUCTURES_FILE_PATH = path.join(DATA_DIR, 'structures.json');

// Middleware to parse JSON bodies and serve static files
app.use(express.json()); // Important: This allows us to read JSON from the request body
app.use(express.static(__dirname)); // Serve files like index.html, admin.html, etc.

// API endpoint to GET the current structure data
app.get('/api/structures', (req, res) => {
    fs.readFile(STRUCTURES_FILE_PATH, 'utf8', (err, data) => {
        // If the file doesn't exist (e.g., on first deploy), return an empty array instead of an error.
        if (err && err.code === 'ENOENT') {
            console.log("structures.json not found, returning empty array.");
            return res.json([]);
        }

        if (err) {
            console.error("Error reading structures.json:", err);
            return res.status(500).send('Error reading structure data.');
        }
        res.json(JSON.parse(data));
    });
});

// API endpoint to POST (update) the structure data
app.post('/api/structures/update', (req, res) => {
    const updatedStructures = req.body;

    // Basic validation: ensure we're receiving an array
    if (!Array.isArray(updatedStructures)) {
        return res.status(400).send('Invalid data format. Expected an array of structures.');
    }

    // Write the updated data back to the file. Using JSON.stringify with indentation makes the file readable.
    fs.writeFile(STRUCTURES_FILE_PATH, JSON.stringify(updatedStructures, null, 4), 'utf8', (err) => {
        if (err) {
            console.error("Error writing to structures.json:", err);
            return res.status(500).send('Error saving structure data.');
        }
        res.status(200).json({ message: 'Structures updated successfully!' });
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log('Open your browser and navigate to http://localhost:3000/admin.html to manage structures.');
});