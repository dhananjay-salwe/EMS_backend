const { pool } = require('../config/db');

exports.getAdmins = async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, role, created_at FROM admins ORDER BY id ASC');
    res.json({ success: true, admins: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.addAdmin = async (req, res) => {
  try {
    const { username, password, role } = req.body;
    await pool.query(
      'INSERT INTO admins (username, password_hash, role) VALUES ($1, $2, $3)',
      [username, password, role]
    );
    res.json({ success: true, message: 'Admin added' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Username might already exist.' });
  }
};

exports.deleteAdmin = async (req, res) => {
  try {
    await pool.query('DELETE FROM admins WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Admin deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};