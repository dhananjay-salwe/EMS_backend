const { pool } = require('../config/db');

exports.getAllLocations = async (req, res) => {
  try {
    const query = `
      SELECT 
        s.id as state_id, s.state_name,
        l.id as lga_id, l.lga_name,
        w.id as ward_id, w.ward_name,
        b.id as booth_id, b.booth_name, b.unique_booth_code
      FROM states s
      LEFT JOIN lgas l ON s.id = l.state_id
      LEFT JOIN wards w ON l.id = w.lga_id
      LEFT JOIN booths b ON w.id = b.ward_id
      ORDER BY s.state_name, l.lga_name, w.ward_name, b.booth_name;
    `;
    const result = await pool.query(query);
    res.json({ success: true, locations: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.addLocationHierarchy = async (req, res) => {
  const client = await pool.connect();
  try {
    const { state_name, lga_name, ward_name, booth_name, unique_booth_code } = req.body;
    
    const sName = state_name?.trim();
    const lName = lga_name?.trim();
    const wName = ward_name?.trim();
    const bName = booth_name?.trim();
    const bCode = unique_booth_code?.trim().toUpperCase();

    if (!sName || !lName || !wName || !bName || !bCode) {
      return res.status(400).json({ success: false, message: 'All location fields are required.' });
    }

    await client.query('BEGIN');

    // 1. State
    let stateRes = await client.query('SELECT id FROM states WHERE LOWER(state_name) = LOWER($1)', [sName]);
    let stateId = stateRes.rows[0]?.id;
    if (!stateId) {
      const inserted = await client.query('INSERT INTO states (state_name) VALUES ($1) RETURNING id', [sName]);
      stateId = inserted.rows[0].id;
    }

    // 2. LGA
    let lgaRes = await client.query('SELECT id FROM lgas WHERE LOWER(lga_name) = LOWER($1) AND state_id = $2', [lName, stateId]);
    let lgaId = lgaRes.rows[0]?.id;
    if (!lgaId) {
      const inserted = await client.query('INSERT INTO lgas (state_id, lga_name) VALUES ($1, $2) RETURNING id', [stateId, lName]);
      lgaId = inserted.rows[0].id;
    }

    // 3. Ward
    let wardRes = await client.query('SELECT id FROM wards WHERE LOWER(ward_name) = LOWER($1) AND lga_id = $2', [wName, lgaId]);
    let wardId = wardRes.rows[0]?.id;
    if (!wardId) {
      const inserted = await client.query('INSERT INTO wards (lga_id, ward_name) VALUES ($1, $2) RETURNING id', [lgaId, wName]);
      wardId = inserted.rows[0].id;
    }

    // 4. Booth
    await client.query(
      'INSERT INTO booths (ward_id, booth_name, unique_booth_code) VALUES ($1, $2, $3)',
      [wardId, bName, bCode]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: 'Booth registered successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Location hierarchy insertion error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

exports.deleteBooth = async (req, res) => {
  try {
    await pool.query('DELETE FROM booths WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Booth deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};