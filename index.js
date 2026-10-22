const express = require('express');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Initialize SQLite Database (creates database.sqlite file automatically)
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        // Create Table if it doesn't exist
        db.run(`CREATE TABLE IF NOT EXISTS internships (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            domain TEXT NOT NULL,
            mode TEXT NOT NULL,
            location TEXT NOT NULL,
            openings INTEGER NOT NULL,
            skills TEXT
        )`, (createErr) => {
            if (!createErr) {
                // Seed initial data if table is empty
                db.get(`SELECT COUNT(*) as count FROM internships`, (countErr, row) => {
                    if (row.count === 0) {
                        const seedData = [
                            ['Frontend Intern', 'Full Stack Development', 'Remote (India)', 'Remote (India)', 3, '["HTML", "CSS", "JavaScript"]'],
                            ['API Engineering Intern', 'Full Stack Development', 'Hybrid (Pune)', 'Pune', 2, '["Node.js", "SQL", "Testing"]'],
                            ['Data Analyst Intern', 'Data Analytics', 'On-site (Bengaluru)', 'Bengaluru', 2, '["Excel", "SQL", "Data visualisation"]']
                        ];
                        const stmt = db.prepare(`INSERT INTO internships (title, domain, mode, location, openings, skills) VALUES (?, ?, ?, ?, ?, ?)`);
                        seedData.forEach(item => stmt.run(item));
                        stmt.finalize();
                        console.log('Database seeded with initial records.');
                    }
                });
            }
        });
    }
});

// --- API ROUTES ---

// 1. GET all internships (with optional domain filter and pagination)
app.get('/api/internships', (req, res) => {
    const { domain, limit = 10, page = 1 } = req.query;
    let query = `SELECT * FROM internships`;
    let params = [];

    if (domain) {
        query += ` WHERE domain = ?`;
        params.push(domain);
    }

    const offset = (page - 1) * limit;
    query += ` LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    db.all(query, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        // Parse skills back into arrays
        const formattedRows = rows.map(row => ({
            ...row,
            skills: row.skills ? JSON.parse(row.skills) : []
        }));
        res.json({ success: true, data: formattedRows });
    });
});

// 2. GET a single internship by ID
app.get('/api/internships/:id', (req, res) => {
    const { id } = req.params;
    db.get(`SELECT * FROM internships WHERE id = ?`, [id], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.status(404).json({ error: 'Internship not found' });
        }
        row.skills = row.skills ? JSON.parse(row.skills) : [];
        res.json({ success: true, data: row });
    });
});

// 3. POST create a new internship
app.post('/api/internships', (req, res) => {
    const { title, domain, mode, location, openings, skills } = req.body;

    // Validation
    if (!title || !domain || !mode || !location || openings === undefined) {
        return res.status(400).json({ error: 'Missing required fields (title, domain, mode, location, openings)' });
    }

    const skillsString = skills ? JSON.stringify(skills) : JSON.stringify([]);
    const query = `INSERT INTO internships (title, domain, mode, location, openings, skills) VALUES (?, ?, ?, ?, ?, ?)`;
    
    db.run(query, [title, domain, mode, location, openings, skillsString], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({
            success: true,
            message: 'Internship created successfully',
            data: { id: this.lastID, title, domain, mode, location, openings, skills: skills || [] }
        });
    });
});

// 4. PUT update an existing internship
app.put('/api/internships/:id', (req, res) => {
    const { id } = req.params;
    const { title, domain, mode, location, openings, skills } = req.body;

    db.get(`SELECT * FROM internships WHERE id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Internship not found' });

        const updatedTitle = title || row.title;
        const updatedDomain = domain || row.domain;
        const updatedMode = mode || row.mode;
        const updatedLocation = location || row.location;
        const updatedOpenings = openings !== undefined ? openings : row.openings;
        const updatedSkills = skills ? JSON.stringify(skills) : row.skills;

        const query = `UPDATE internships SET title = ?, domain = ?, mode = ?, location = ?, openings = ?, skills = ? WHERE id = ?`;
        db.run(query, [updatedTitle, updatedDomain, updatedMode, updatedLocation, updatedOpenings, updatedSkills, id], (updateErr) => {
            if (updateErr) return res.status(500).json({ error: updateErr.message });
            res.json({
                success: true,
                message: 'Internship updated successfully',
                data: { id: Number(id), title: updatedTitle, domain: updatedDomain, mode: updatedMode, location: updatedLocation, openings: updatedOpenings, skills: skills || JSON.parse(row.skills) }
            });
        });
    });
});

// 5. DELETE an internship
app.delete('/api/internships/:id', (req, res) => {
    const { id } = req.params;
    db.get(`SELECT * FROM internships WHERE id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Internship not found' });

        db.run(`DELETE FROM internships WHERE id = ?`, [id], (deleteErr) => {
            if (deleteErr) return res.status(500).json({ error: deleteErr.message });
            res.json({ success: true, message: 'Internship deleted successfully' });
        });
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});