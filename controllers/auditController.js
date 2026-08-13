const { pool } = require('../config/db');

exports.getSubmissions = async (req, res) => {
  try {
    // Fetches the vote submission records, joining the booth and operator details
    const query = `
      SELECT 
        vr.id, 
        vr.tally_sheet_url, 
        vr.created_at,
        b.unique_booth_code, 
        b.booth_name,
        o.full_name as operator_name
      FROM vote_records vr
      JOIN booths b ON vr.booth_id = b.id
      JOIN operators o ON vr.operator_id = o.id
      ORDER BY vr.created_at DESC;
    `;
    const result = await pool.query(query);
    res.json({ success: true, submissions: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch audit records' });
  }
};