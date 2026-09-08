const { pool } = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

exports.adminLogin = async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query(
            'SELECT id, full_name, email, role, password_hash FROM users WHERE email = $1',
            [email]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
        }

        const user = result.rows[0];

        // Verify password using bcrypt with fallback for existing plain text accounts
        let isMatch = false;
        if (user.password_hash && (user.password_hash.startsWith('$2a$') || user.password_hash.startsWith('$2b$'))) {
            isMatch = await bcrypt.compare(password, user.password_hash);
        } else {
            isMatch = (password === user.password_hash);
            // Seamlessly upgrade legacy plain-text password to bcrypt hash
            if (isMatch) {
                const newHash = await bcrypt.hash(password, 10);
                await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, user.id]);
            }
        }

        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
        }

        // Generate JWT token containing user id and role
        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        delete user.password_hash;

        return res.json({
            success: true,
            token,
            admin: user
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.operatorLogin = async (req, res) => {
    const { username, password } = req.body;
    try {
        // JOIN with booths to get the assigned booth details on login
        const result = await pool.query(
            `SELECT 
                o.id, o.username, o.full_name, o.assigned_booth_id, o.password_hash,
                b.unique_booth_code, b.booth_name 
             FROM operators o
             LEFT JOIN booths b ON o.assigned_booth_id = b.id
             WHERE o.username = $1`,
            [username]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid operator credentials' });
        }

        const operator = result.rows[0];

        // Verify password using bcrypt with fallback for existing plain text accounts
        let isMatch = false;
        if (operator.password_hash && (operator.password_hash.startsWith('$2a$') || operator.password_hash.startsWith('$2b$'))) {
            isMatch = await bcrypt.compare(password, operator.password_hash);
        } else {
            isMatch = (password === operator.password_hash);
            // Seamlessly upgrade legacy plain-text password to bcrypt hash
            if (isMatch) {
                const newHash = await bcrypt.hash(password, 10);
                await pool.query('UPDATE operators SET password_hash = $1 WHERE id = $2', [newHash, operator.id]);
            }
        }

        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid operator credentials' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: operator.id, role: 'operator', assigned_booth_id: operator.assigned_booth_id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        delete operator.password_hash;

        return res.json({
            success: true,
            token,
            operator
        });
    } catch (err) {
        console.error("DB Error in operatorLogin:", err.message);
        res.status(500).json({ success: false, message: `Server error: ${err.message}` });
    }
};