const { pool } = require('../config/db');

exports.adminLogin = async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query(
            'SELECT id, username, role FROM admins WHERE username = $1 AND password_hash = $2',
            [username, password]
        );
        
        if (result.rows.length > 0) {
            res.json({ success: true, admin: result.rows[0] });
        } else {
            res.status(401).json({ success: false, message: 'Invalid admin credentials' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ... existing adminLogin function ...

exports.operatorLogin = async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query(
            'SELECT id, username, full_name FROM operators WHERE username = $1 AND password_hash = $2',
            [username, password]
        );
        
        if (result.rows.length > 0) {
            res.json({ success: true, operator: result.rows[0] });
        } else {
            res.status(401).json({ success: false, message: 'Invalid operator credentials' });
        }
    } catch (err) {
        console.error("DB Error in operatorLogin:", err.message);
        res.status(500).json({ success: false, message: `Server error: ${err.message}` });
    }
};