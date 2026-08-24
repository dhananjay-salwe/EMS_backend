require('dotenv').config();
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

// PostgreSQL Database Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Supabase Client for Storage
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = { pool, supabase };

/*
// FIX: Database index migration commands to optimize query joining and sorting performance
// Run these directly in the PostgreSQL database console to construct indexes:

CREATE INDEX IF NOT EXISTS idx_vote_records_booth_created ON vote_records (booth_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vote_records_created ON vote_records (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vote_details_record_id ON vote_details (vote_record_id);
CREATE INDEX IF NOT EXISTS idx_vote_details_candidate_id ON vote_details (candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidates_ward_id ON candidates (ward_id);
CREATE INDEX IF NOT EXISTS idx_booths_ward_id ON booths (ward_id);
*/