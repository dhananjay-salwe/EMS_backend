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

    // Count total booths matching filters
    const countQuery = `
      SELECT COUNT(*)
      FROM booths b
      JOIN wards w ON b.ward_id = w.id
      JOIN lgas l ON w.lga_id = l.id
      JOIN states s ON l.state_id = s.id
      LEFT JOIN LATERAL (
        SELECT *
        FROM vote_records vr
        WHERE vr.booth_id = b.id
        ORDER BY vr.created_at DESC
        LIMIT 1
      ) sub ON true
      LEFT JOIN operators o ON sub.operator_id = o.id
      ${whereSql};
    `;

    const countRes = await pool.query(countQuery, queryParams);
    const totalRecords = parseInt(countRes.rows[0].count, 10);
    const totalPages = Math.ceil(totalRecords / limit) || 1;

    queryParams.push(limit, offset);
    const limitPlaceholder = `$${queryParams.length - 1}`;
    const offsetPlaceholder = `$${queryParams.length}`;

    // Select primarily from booths with LEFT JOIN to vote_records and operators
    const query = `
      SELECT 
        b.id AS booth_id,
        sub.id, 
        sub.tally_sheet_url, 
        sub.video_url,
        sub.created_at,
        b.unique_booth_code, 
        b.booth_name,
        w.id AS ward_id,
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
      FROM booths b
      JOIN wards w ON b.ward_id = w.id
      JOIN lgas l ON w.lga_id = l.id
      JOIN states s ON l.state_id = s.id
      LEFT JOIN LATERAL (
        SELECT *
        FROM vote_records vr
        WHERE vr.booth_id = b.id
        ORDER BY vr.created_at DESC
        LIMIT 1
      ) sub ON true
      LEFT JOIN operators o ON sub.operator_id = o.id
      ${whereSql}
      ORDER BY b.booth_name ASC
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

// FEATURE: Save moderator verified vote counts with upsert support
exports.verifyAudit = async (req, res) => {
  const { record_id } = req.params;
  const { verified_votes, booth_id } = req.body; // Array of { candidate_id, count }

  try {
    let targetRecordId = null;
    const parsedId = parseInt(record_id, 10);

    // 1. Check if valid record_id passed
    if (parsedId && !isNaN(parsedId) && parsedId > 0) {
      const recRes = await pool.query('SELECT id FROM vote_records WHERE id = $1', [parsedId]);
      if (recRes.rows.length > 0) {
        targetRecordId = recRes.rows[0].id;
      }
    }

    // 2. Fallback: check if vote_records exists for booth_id or create placeholder
    if (!targetRecordId && booth_id) {
      const existing = await pool.query(
        'SELECT id FROM vote_records WHERE booth_id = $1 ORDER BY created_at DESC LIMIT 1',
        [booth_id]
      );
      if (existing.rows.length > 0) {
        targetRecordId = existing.rows[0].id;
      } else {
        // Insert placeholder record into vote_records (with null media)
        const opRes = await pool.query('SELECT id FROM operators WHERE assigned_booth_id = $1 LIMIT 1', [booth_id]);
        let opId = opRes.rows[0]?.id;
        if (!opId) {
          const anyOp = await pool.query('SELECT id FROM operators ORDER BY id ASC LIMIT 1');
          opId = anyOp.rows[0]?.id || 1;
        }

        const newRec = await pool.query(
          `INSERT INTO vote_records (booth_id, operator_id, tally_sheet_url, video_url, created_at)
           VALUES ($1, $2, NULL, NULL, NOW()) RETURNING id`,
          [booth_id, opId]
        );
        targetRecordId = newRec.rows[0].id;
      }
    }

    if (!targetRecordId) {
      return res.status(400).json({ success: false, message: 'Invalid record or booth reference' });
    }

    // 3. Upsert into vote_details
    for (const vote of (verified_votes || [])) {
      const count = parseInt(vote.count, 10) || 0;
      const detailRes = await pool.query(
        'SELECT id FROM vote_details WHERE vote_record_id = $1 AND candidate_id = $2',
        [targetRecordId, vote.candidate_id]
      );
      if (detailRes.rows.length > 0) {
        await pool.query(
          'UPDATE vote_details SET moderator_vote_count = $1 WHERE id = $2',
          [count, detailRes.rows[0].id]
        );
      } else {
        await pool.query(
          'INSERT INTO vote_details (vote_record_id, candidate_id, vote_count, moderator_vote_count) VALUES ($1, $2, 0, $3)',
          [targetRecordId, vote.candidate_id, count]
        );
      }
    }

    res.json({ success: true, message: 'Verified counts saved.' });
  } catch (err) {
    console.error("Verification save error:", err);
    res.status(500).json({ success: false, message: "Failed to save verified counts" });
  }
};
