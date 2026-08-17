const { pool } = require('../config/db');

exports.getSubmissions = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    const countRes = await pool.query('SELECT COUNT(*) FROM vote_records');
    const totalRecords = parseInt(countRes.rows[0].count, 10);
    const totalPages = Math.ceil(totalRecords / limit) || 1;

    const query = `
      SELECT 
        vr.id, 
        vr.tally_sheet_url, 
        vr.created_at,
        b.unique_booth_code, 
        b.booth_name,
        o.full_name as operator_name,
        COALESCE(
          (
            SELECT json_agg(json_build_object(
              'candidate_name', c.candidate_name,
              'party_name', p.party_name,
              'party_code', p.party_code,
              'vote_count', vd.vote_count
            ))
            FROM vote_details vd
            JOIN candidates c ON vd.candidate_id = c.id
            JOIN political_parties p ON c.party_id = p.id
            WHERE vd.vote_record_id = vr.id
          ), '[]'::json
        ) as votes_breakdown
      FROM vote_records vr
      JOIN booths b ON vr.booth_id = b.id
      JOIN operators o ON vr.operator_id = o.id
      ORDER BY vr.created_at DESC
      LIMIT $1 OFFSET $2;
    `;
    const result = await pool.query(query, [limit, offset]);

    res.json({
      success: true,
      submissions: result.rows,
      pagination: {
        totalRecords,
        totalPages,
        currentPage: page,
        limit
      }
    });
  } catch (err) {
    console.error('Audit fetch error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch audit records' });
  }
};