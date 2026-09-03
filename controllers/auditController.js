const { pool } = require("../config/db");

// FIX: Optimized audit query using correlated subquery and backend filters for paginated list
exports.getSubmissions = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    const { state, lga, ward, search, sort = 'asc' } = req.query;
    const sortDirection = sort.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const whereClauses = [];
    const queryParams = [];

    if (state) {
      queryParams.push(state);
      whereClauses.push(`s.state_name = $${queryParams.length}`);
    }
    if (lga) {
      queryParams.push(lga);
      whereClauses.push(`l.lga_name = $${queryParams.length}`);
    }
    if (ward) {
      queryParams.push(ward);
      whereClauses.push(`w.ward_name = $${queryParams.length}`);
    }
    if (search) {
      queryParams.push(`%${search}%`);
      whereClauses.push(`(o.full_name ILIKE $${queryParams.length} OR b.unique_booth_code ILIKE $${queryParams.length} OR b.booth_name ILIKE $${queryParams.length})`);
    }


    // FIX: Update whereSql to start with WHERE instead of AND since the latest-only filter is removed
    const whereSql = whereClauses.length > 0 ? ' WHERE ' + whereClauses.join(' AND ') : '';

    // FIX: Remove latest-only subquery filter to return full historical submissions list
    const countQuery = `
      SELECT COUNT(*)
      FROM vote_records sub
      JOIN booths b ON sub.booth_id = b.id
      JOIN wards w ON b.ward_id = w.id
      JOIN lgas l ON w.lga_id = l.id
      JOIN states s ON l.state_id = s.id
      JOIN operators o ON sub.operator_id = o.id
      ${whereSql};
    `;

    const countRes = await pool.query(countQuery, queryParams);
    const totalRecords = parseInt(countRes.rows[0].count, 10);
    const totalPages = Math.ceil(totalRecords / limit) || 1;

    queryParams.push(limit, offset);
    const limitPlaceholder = `$${queryParams.length - 1}`;
    const offsetPlaceholder = `$${queryParams.length}`;

    // FIX: Include video_url and remove the single-latest-record subquery limitation to output full audit trail
    const query = `
      SELECT 
        sub.id, 
        sub.tally_sheet_url, 
        sub.video_url,
        sub.created_at,
        b.unique_booth_code, 
        b.booth_name,
        w.ward_name,
        l.lga_name,
        s.state_name,
        o.full_name as operator_name,
        COALESCE(
          (
            SELECT json_agg(json_build_object(
              'candidate_id', c.id,
              'candidate_name', c.candidate_name,
              'party_name', p.party_name,
              'party_code', p.party_code,
              'vote_count', vd.vote_count,
              'moderator_vote_count', vd.moderator_vote_count
            ))
            FROM vote_details vd
            JOIN candidates c ON vd.candidate_id = c.id
            JOIN political_parties p ON c.party_id = p.id
            WHERE vd.vote_record_id = sub.id
          ), '[]'::json
        ) as votes_breakdown
      FROM vote_records sub
      JOIN booths b ON sub.booth_id = b.id
      JOIN wards w ON b.ward_id = w.id
      JOIN lgas l ON w.lga_id = l.id
      JOIN states s ON l.state_id = s.id
      JOIN operators o ON sub.operator_id = o.id
      ${whereSql}
      ORDER BY b.unique_booth_code ${sortDirection}, sub.created_at DESC
      LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder};
    `;

    const result = await pool.query(query, queryParams);

    res.json({
      success: true,
      submissions: result.rows,
      pagination: {
        totalRecords,
        totalPages,
        currentPage: page,
        limit,
      },
    });
  } catch (err) {
    console.error("Audit fetch error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch audit records" });
  }
};

// FEATURE: Save moderator verified vote counts
exports.verifyAudit = async (req, res) => {
  const { record_id } = req.params;
  const { verified_votes } = req.body; // Array of { candidate_id, count }

  try {
    // Loop through the submitted votes and update the specific record
    for (const vote of verified_votes) {
      await pool.query(
        'UPDATE vote_details SET moderator_vote_count = $1 WHERE vote_record_id = $2 AND candidate_id = $3',
        [vote.count, record_id, vote.candidate_id]
      );
    }
    res.json({ success: true, message: 'Verified counts saved.' });
  } catch (err) {
    console.error("Verification save error:", err);
    res.status(500).json({ success: false, message: "Failed to save verified counts" });
  }
};
