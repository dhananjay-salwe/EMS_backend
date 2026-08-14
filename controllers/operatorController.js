const { pool } = require('../config/db');

exports.getOperators = async (req, res) => {
  try {
    const query = `
      SELECT 
        o.id, 
        o.username, 
        o.full_name, 
        o.assigned_booth_id,
        o.created_at,
        b.unique_booth_code, 
        b.booth_name,
        w.ward_name,
        l.lga_name,
        s.state_name
      FROM operators o
      LEFT JOIN booths b ON o.assigned_booth_id = b.id
      LEFT JOIN wards w ON b.ward_id = w.id
      LEFT JOIN lgas l ON w.lga_id = l.id
      LEFT JOIN states s ON l.state_id = s.id
      ORDER BY o.created_at DESC;
    `;
    const result = await pool.query(query);
    res.json({ success: true, operators: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.addOperator = async (req, res) => {
  try {
    const { username, password, full_name, assigned_booth_id } = req.body;
    await pool.query(
      'INSERT INTO operators (username, password_hash, full_name, assigned_booth_id) VALUES ($1, $2, $3, $4)',
      [username, password, full_name, assigned_booth_id || null]
    );
    res.json({ success: true, message: 'Operator created successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: `Failed to add operator: ${err.message}` });
  }
};

exports.updateOperator = async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, username, password, assigned_booth_id } = req.body;
    
    if (password && password.trim() !== '') {
      await pool.query(
        'UPDATE operators SET full_name = $1, username = $2, password_hash = $3, assigned_booth_id = $4 WHERE id = $5',
        [full_name, username, password, assigned_booth_id || null, id]
      );
    } else {
      await pool.query(
        'UPDATE operators SET full_name = $1, username = $2, assigned_booth_id = $3 WHERE id = $4',
        [full_name, username, assigned_booth_id || null, id]
      );
    }
    res.json({ success: true, message: 'Operator updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteOperator = async (req, res) => {
  try {
    await pool.query('DELETE FROM operators WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Operator deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};