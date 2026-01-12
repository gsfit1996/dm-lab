
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;
const DB_FILE = path.join(__dirname, 'db.json');

app.use(cors());
app.use(bodyParser.json());

// Initialize DB if not exists
if (!fs.existsSync(DB_FILE)) {
    const initialData = {
        experiments: [],
        dailyLogs: [],
        offers: [],
        settings: { theme: 'dark' }
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
}

// Helper to read/write
const readDB = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
const writeDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

// Endpoints
app.get('/api/data', (req, res) => {
    try {
        const data = readDB();
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/save', (req, res) => {
    try {
        const newData = req.body;
        // Merge or replace? For simplicity, we replaced the whole state in the frontend logic usually, 
        // but let's assume the frontend sends the *entire* app state to save.
        // Wait, DMLabContext sends full state on save? 
        // Let's support saving individual collections or full state.
        // For "saveData" usually it's full state.

        writeDB(newData);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`SERVER RUNNING ON http://localhost:${PORT}`);
});
