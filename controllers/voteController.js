const { pool } = require('../config/db');

exports.getDashboardStats = async (req, res) => {
    try {
        const query = `
            SELECT 
                c.party_name, 
                c.candidate_name,
                c.party_icon_url,
                COALESCE(SUM(vd.vote_count), 0) as total_votes
            FROM candidates c
            LEFT JOIN vote_details vd ON c.id = vd.candidate_id
            GROUP BY c.id, c.party_name, c.candidate_name, c.party_icon_url
            ORDER BY total_votes DESC;
        `;
        const result = await pool.query(query);
        res.json({ success: true, leaderboard: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to load stats' });
    }
};