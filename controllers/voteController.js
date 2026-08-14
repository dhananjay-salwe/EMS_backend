const { pool } = require('../config/db');

exports.getElectionSummary = async (req, res) => {
  try {
    // 1. Fetch total votes for every candidate grouped by Ward
    const wardVotesQuery = `
      SELECT 
        w.id as ward_id,
        w.ward_name,
        l.lga_name,
        s.state_name,
        c.id as candidate_id,
        c.candidate_name,
        p.id as party_id,
        p.party_name,
        p.party_code,
        p.party_icon_url,
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

    // 2. Fetch all parties to initialize the seat scorecard
    const partiesRes = await pool.query('SELECT * FROM political_parties ORDER BY party_name ASC');
    
    // Group results by Ward to determine the winner of each seat
    const wardsMap = {};
    wardVotesRes.rows.forEach(row => {
      if (!wardsMap[row.ward_id]) {
        wardsMap[row.ward_id] = {
          ward_id: row.ward_id,
          ward_name: row.ward_name,
          lga_name: row.lga_name,
          state_name: row.state_name,
          candidates: []
        };
      }
      wardsMap[row.ward_id].candidates.push({
        candidate_id: row.candidate_id,
        candidate_name: row.candidate_name,
        party_id: row.party_id,
        party_name: row.party_name,
        party_code: row.party_code,
        party_icon_url: row.party_icon_url,
        total_votes: parseInt(row.total_votes, 10)
      });
    });

    // Scorecard for Parties: Seats Won, Total Votes
    const partyStats = {};
    partiesRes.rows.forEach(p => {
      partyStats[p.id] = {
        party_id: p.id,
        party_name: p.party_name,
        party_code: p.party_code,
        party_icon_url: p.party_icon_url,
        seats_won: 0,
        total_popular_votes: 0,
        won_wards: []
      };
    });

    let totalSeatsContested = Object.keys(wardsMap).length;
    let totalOverallVotes = 0;

    Object.values(wardsMap).forEach(ward => {
      // Sort candidates in this ward descending by total votes
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
            ward_name: ward.ward_name,
            lga_name: ward.lga_name,
            state_name: ward.state_name,
            candidate_name: leadingCandidate.candidate_name,
            margin_votes: leadingCandidate.total_votes - (ward.candidates[1]?.total_votes || 0),
            candidate_votes: leadingCandidate.total_votes
          });
        }
      }
    });

    const partyLeaderboard = Object.values(partyStats).sort((a, b) => b.seats_won - a.seats_won || b.total_popular_votes - a.total_popular_votes);

    res.json({
      success: true,
      total_seats: totalSeatsContested,
      total_votes: totalOverallVotes,
      leaderboard: partyLeaderboard,
      ward_details: Object.values(wardsMap)
    });
  } catch (err) {
    console.error("Dashboard calculation error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};