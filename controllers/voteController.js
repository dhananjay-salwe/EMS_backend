const { pool } = require('../config/db');

exports.getDashboardStats = async (req, res) => {
    try {
        const query = `
            SELECT 
                c.id,
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
        console.error("Error fetching stats:", err.message);
        res.status(500).json({ success: false, message: 'Failed to load stats' });
    }
};

exports.submitVotes = async (req, res) => {
    const client = await pool.connect();
    try {
        const { operator_id, booth_id, votes } = req.body;
        const file = req.file;

        if (!operator_id || !booth_id || !votes) {
            return res.status(400).json({ success: false, message: 'Missing required vote fields' });
        }

        // Parse votes payload
        const parsedVotes = typeof votes === 'string' ? JSON.parse(votes) : votes;

        // Image URL handling (If file uploaded, generate placeholder/public link)
        const tallySheetUrl = file 
            ? `https://via.placeholder.com/600x800.png?text=Tally+Sheet+Booth+${booth_id}`
            : 'https://via.placeholder.com/600x800.png?text=No+Image';

        await client.query('BEGIN');

        // 1. Insert vote record entry
        const recordResult = await client.query(
            `INSERT INTO vote_records (booth_id, operator_id, tally_sheet_url) 
             VALUES ($1, $2, $3) RETURNING id`,
            [booth_id, operator_id, tallySheetUrl]
        );
        const voteRecordId = recordResult.rows[0].id;

        // 2. Insert vote details per candidate
        for (const [candidateId, count] of Object.entries(parsedVotes)) {
            const voteCount = parseInt(count, 10) || 0;
            if (voteCount > 0) {
                await client.query(
                    `INSERT INTO vote_details (vote_record_id, candidate_id, vote_count) 
                     VALUES ($1, $2, $3)`,
                    [voteRecordId, candidateId, voteCount]
                );
            }
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'Votes successfully recorded!' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("DB Error in submitVotes:", err.message);
        res.status(500).json({ success: false, message: `Failed to record votes: ${err.message}` });
    } finally {
        client.release();
    }
};