const { pool } = require('../config/db');

exports.getParties = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM candidates ORDER BY id ASC');
    res.json({ success: true, parties: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.addParty = async (req, res) => {
  try {
    const { party_name, candidate_name, party_icon_url } = req.body;
    await pool.query(
      'INSERT INTO candidates (party_name, candidate_name, party_icon_url) VALUES ($1, $2, $3)',
      [party_name, candidate_name, party_icon_url]
    );
    res.json({ success: true, message: 'Party added' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteParty = async (req, res) => {
  try {
    await pool.query('DELETE FROM candidates WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Party deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};