const { pool } = require('../config/db');

// Create State -> LGA -> Ward -> Booth Hierarchy
exports.addLocationHierarchy = async (req, res) => {
  const client = await pool.connect();
  try {
    const { state_name, lga_name, ward_name, booth_name, unique_booth_code } = req.body;

    await client.query('BEGIN');

    // 1. Insert or get State
    const stateRes = await client.query(
      `INSERT INTO locations_state (state_name) VALUES ($1) 
       ON CONFLICT (state_name) DO UPDATE SET state_name=EXCLUDED.state_name RETURNING id`,
      [state_name]
    );
    const stateId = stateRes.rows[0].id;

    // 2. Insert LGA
    const lgaRes = await client.query(
      `INSERT INTO locations_lga (state_id, lga_name) VALUES ($1, $2) RETURNING id`,
      [stateId, lga_name]
    );
    const lgaId = lgaRes.rows[0].id;

    // 3. Insert Ward
    const wardRes = await client.query(
      `INSERT INTO locations_ward (lga_id, ward_name) VALUES ($1, $2) RETURNING id`,
      [lgaId, ward_name]
    );
    const wardId = wardRes.rows[0].id;

    // 4. Insert Booth
    const boothRes = await client.query(
      `INSERT INTO booths (ward_id, unique_booth_code, booth_name) VALUES ($1, $2, $3) RETURNING id`,
      [wardId, unique_booth_code, booth_name]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: 'Location hierarchy created successfully!', boothId: boothRes.rows[0].id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

// Fetch All Locations
exports.getLocations = async (req, res) => {
  try {
    const query = `
      SELECT 
        s.state_name, l.lga_name, w.ward_name, b.id as booth_id, b.booth_name, b.unique_booth_code
      FROM booths b
      JOIN locations_ward w ON b.ward_id = w.id
      JOIN locations_lga l ON w.lga_id = l.id
      JOIN locations_state s ON l.state_id = s.id
      ORDER BY s.state_name, l.lga_name, w.ward_name;
    `;
    const result = await pool.query(query);
    res.json({ success: true, locations: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};