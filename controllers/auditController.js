const { pool } = require("../config/db");

// OLD CODE:
// exports.getSubmissions = async (req, res) => {
//   try {
//     const page = parseInt(req.query.page, 10) || 1;
//     const limit = parseInt(req.query.limit, 10) || 10;
//     const offset = (page - 1) * limit;
// 
//     // const countRes = await pool.query('SELECT COUNT(*) FROM vote_records');
// 
//     // Counts distinct booths/operators so pagination matches latest-only submissions
//     const countRes = await pool.query(
//       "SELECT COUNT(DISTINCT booth_id) FROM vote_records"
//     );
// 
//     const totalRecords = parseInt(countRes.rows[0].count, 10);
//     const totalPages = Math.ceil(totalRecords / limit) || 1;
// 
// const query = `
//       SELECT 
//         sub.id, 
//         sub.tally_sheet_url, 
//         sub.created_at,
//         b.unique_booth_code, 
//         b.booth_name,
//         w.ward_name,
//         l.lga_name,
//         s.state_name,
//         o.full_name as operator_name,
//         COALESCE(
//           (
//             SELECT json_agg(json_build_object(
//               'candidate_name', c.candidate_name,
//               'party_name', p.party_name,
//               'party_code', p.party_code,
//               'vote_count', vd.vote_count
//             ))
//             FROM vote_details vd
//             JOIN candidates c ON vd.candidate_id = c.id
//             JOIN political_parties p ON c.party_id = p.id
//             WHERE vd.vote_record_id = sub.id
//           ), '[]'::json
//         ) as votes_breakdown
//       FROM (
//         SELECT DISTINCT ON (booth_id) 
//           id, booth_id, operator_id, tally_sheet_url, created_at
//         FROM vote_records
//         ORDER BY booth_id, created_at DESC
//       ) sub
//       JOIN booths b ON sub.booth_id = b.id
//       JOIN wards w ON b.ward_id = w.id
//       JOIN lgas l ON w.lga_id = l.id
//       JOIN states s ON l.state_id = s.id
//       JOIN operators o ON sub.operator_id = o.id
//       ORDER BY sub.created_at DESC
//       LIMIT $1 OFFSET $2;
//     `;
//     const result = await pool.query(query, [limit, offset]);
// 
//     res.json({
//       success: true,
//       submissions: result.rows,
//       pagination: {
//         totalRecords,
//         totalPages,
//         currentPage: page,
//         limit,
//       },
//     });
//   } catch (err) {
//     console.error("Audit fetch error:", err);
//     res
//       .status(500)
//       .json({ success: false, message: "Failed to fetch audit records" });
//   }
// };

// FIX: Optimized audit query using correlated subquery and backend filters for paginated list
exports.getSubmissions = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    const { state, lga, ward, search } = req.query;

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

    const whereSql = whereClauses.length > 0 ? ' AND ' + whereClauses.join(' AND ') : '';

    const countQuery = `
      SELECT COUNT(*)
      FROM vote_records sub
      JOIN booths b ON sub.booth_id = b.id
      JOIN wards w ON b.ward_id = w.id
      JOIN lgas l ON w.lga_id = l.id
      JOIN states s ON l.state_id = s.id
      JOIN operators o ON sub.operator_id = o.id
      WHERE sub.id = (
        SELECT id FROM vote_records vr
        WHERE vr.booth_id = sub.booth_id
        ORDER BY vr.created_at DESC
        LIMIT 1
      )${whereSql};
    `;

    const countRes = await pool.query(countQuery, queryParams);
    const totalRecords = parseInt(countRes.rows[0].count, 10);
    const totalPages = Math.ceil(totalRecords / limit) || 1;

    queryParams.push(limit, offset);
    const limitPlaceholder = `$${queryParams.length - 1}`;
    const offsetPlaceholder = `$${queryParams.length}`;

    const query = `
      SELECT 
        sub.id, 
        sub.tally_sheet_url, 
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
              'candidate_name', c.candidate_name,
              'party_name', p.party_name,
              'party_code', p.party_code,
              'vote_count', vd.vote_count
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
      WHERE sub.id = (
        SELECT id FROM vote_records vr
        WHERE vr.booth_id = sub.booth_id
        ORDER BY vr.created_at DESC
        LIMIT 1
      )${whereSql}
      ORDER BY sub.created_at DESC
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
