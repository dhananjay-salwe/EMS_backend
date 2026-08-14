const { pool } = require('../config/db');

exports.getParties = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM political_parties ORDER BY id ASC');
    res.json({ success: true, parties: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.addParty = async (req, res) => {
  try {
    const { party_name, party_code, party_icon_url } = req.body;
    await pool.query(
      'INSERT INTO political_parties (party_name, party_code, party_icon_url) VALUES ($1, $2, $3)',
      [party_name, party_code.toUpperCase(), party_icon_url]
    );
    res.json({ success: true, message: 'Political Party created successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateParty = async (req, res) => {
  try {
    const { id } = req.params;
    const { party_name, party_code, party_icon_url } = req.body;
    await pool.query(
      'UPDATE political_parties SET party_name = $1, party_code = $2, party_icon_url = $3 WHERE id = $4',
      [party_name, party_code.toUpperCase(), party_icon_url, id]
    );
    res.json({ success: true, message: 'Political Party updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteParty = async (req, res) => {
  try {
    await pool.query('DELETE FROM political_parties WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Party deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};