const { pool } = require('../config/db');

// --- 1. DASHBOARD ENGINE (INDIAN ELECTION STYLE) ---
exports.getElectionSummary = async (req, res) => {
  try {
    const wardVotesQuery = `
      SELECT 
        w.id as ward_id, w.ward_name, l.lga_name, s.state_name,
        c.id as candidate_id, c.candidate_name,
        p.id as party_id, p.party_name, p.party_code, p.party_icon_url,
        COALESCE(SUM(vd.vote_count), 0) as total_votes
      FROM wards w
      JOIN lgas l ON w.lga_id = l.id
      JOIN states s ON l.state_id = s.id
      JOIN candidates c ON c.ward_id = w.id
      JOIN political_parties p ON c.party_id = p.id
      LEFT JOIN vote_details vd ON vd.candidate_id = c.id
      GROUP BY w.id, w.ward_name, l.lga_name, s.state_name, c.id, c.candidate_name, p.id, p.party_name, p.party_code, p.party_icon_url
      ORDER BY w.id, total_votes DESC;
    `;
    const wardVotesRes = await pool.query(wardVotesQuery);
    const partiesRes = await pool.query('SELECT * FROM political_parties ORDER BY party_name ASC');
    
    const wardsMap = {};
    wardVotesRes.rows.forEach(row => {
      if (!wardsMap[row.ward_id]) {
        wardsMap[row.ward_id] = {
          ward_id: row.ward_id, ward_name: row.ward_name, lga_name: row.lga_name, state_name: row.state_name,
          candidates: []
        };
      }
      wardsMap[row.ward_id].candidates.push({
        candidate_id: row.candidate_id, candidate_name: row.candidate_name,
        party_id: row.party_id, party_name: row.party_name, party_code: row.party_code, party_icon_url: row.party_icon_url,
        total_votes: parseInt(row.total_votes, 10)
      });
    });

    const partyStats = {};
    partiesRes.rows.forEach(p => {
      partyStats[p.id] = {
        party_id: p.id, party_name: p.party_name, party_code: p.party_code, party_icon_url: p.party_icon_url,
        seats_won: 0, total_popular_votes: 0, won_wards: []
      };
    });

    let totalSeatsContested = Object.keys(wardsMap).length;
    let totalOverallVotes = 0;

    Object.values(wardsMap).forEach(ward => {
      ward.candidates.sort((a, b) => b.total_votes - a.total_votes);
      ward.candidates.forEach(c => {
        if (partyStats[c.party_id]) {
          partyStats[c.party_id].total_popular_votes += c.total_votes;
        }
        totalOverallVotes += c.total_votes;
      });

      const leadingCandidate = ward.candidates[0];
      if (leadingCandidate && leadingCandidate.total_votes > 0) {
        if (partyStats[leadingCandidate.party_id]) {
          partyStats[leadingCandidate.party_id].seats_won += 1;
          partyStats[leadingCandidate.party_id].won_wards.push({
            ward_name: ward.ward_name, lga_name: ward.lga_name, state_name: ward.state_name,
            candidate_name: leadingCandidate.candidate_name,
            margin_votes: leadingCandidate.total_votes - (ward.candidates[1]?.total_votes || 0),
            candidate_votes: leadingCandidate.total_votes
          });
        }
      }
    });

    const partyLeaderboard = Object.values(partyStats).sort((a, b) => b.seats_won - a.seats_won || b.total_popular_votes - a.total_popular_votes);

    res.json({
      success: true, total_seats: totalSeatsContested, total_votes: totalOverallVotes,
      leaderboard: partyLeaderboard, ward_details: Object.values(wardsMap)
    });
  } catch (err) {
    console.error("Dashboard calculation error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// --- 2. MOBILE APP SUBMISSION ENGINE ---
exports.submitVotes = async (req, res) => {
    const client = await pool.connect();
    try {
        const { operator_id, booth_id, votes } = req.body;
        const file = req.file;

        if (!operator_id || !booth_id || !votes) {
            return res.status(400).json({ success: false, message: 'Missing required vote fields' });
        }

        const parsedVotes = typeof votes === 'string' ? JSON.parse(votes) : votes;
        const tallySheetUrl = file 
            ? `https://via.placeholder.com/600x800.png?text=Tally+Sheet+Booth+${booth_id}`
            : 'https://via.placeholder.com/600x800.png?text=No+Image';

        await client.query('BEGIN');

        const recordResult = await client.query(
            `INSERT INTO vote_records (booth_id, operator_id, tally_sheet_url) VALUES ($1, $2, $3) RETURNING id`,
            [booth_id, operator_id, tallySheetUrl]
        );
        const voteRecordId = recordResult.rows[0].id;

        for (const [candidateId, count] of Object.entries(parsedVotes)) {
            const voteCount = parseInt(count, 10) || 0;
            if (voteCount > 0) {
                await client.query(
                    `INSERT INTO vote_details (vote_record_id, candidate_id, vote_count) VALUES ($1, $2, $3)`,
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