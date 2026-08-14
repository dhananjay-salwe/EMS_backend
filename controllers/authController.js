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
        // JOIN with booths to get the assigned booth details on login
        const result = await pool.query(
            `SELECT 
                o.id, o.username, o.full_name, o.assigned_booth_id, 
                b.unique_booth_code, b.booth_name 
             FROM operators o
             LEFT JOIN booths b ON o.assigned_booth_id = b.id
             WHERE o.username = $1 AND o.password_hash = $2`,
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