const { pool } = require('../config/db');

exports.addOperator = async (req, res) => {
  try {
    const { username, password, full_name } = req.body;
    
    // In a real production app, always hash the password using bcrypt here!
    const query = `
      INSERT INTO operators (username, password_hash, full_name) 
      VALUES ($1, $2, $3) RETURNING id
    `;
    await pool.query(query, [username, password, full_name]);
    
    res.json({ success: true, message: 'Booth Operator registered successfully!' });
  } catch (err) {
    console.error("DB Error in addOperator:", err.message);
    res.status(500).json({ success: false, message: `Failed to add operator: ${err.message}` });
  }
};

exports.getOperators = async (req, res) => {
  try {
    const query = `SELECT id, username, full_name, created_at FROM operators ORDER BY created_at DESC`;
    const result = await pool.query(query);
    res.json({ success: true, operators: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch operators' });
  }
};