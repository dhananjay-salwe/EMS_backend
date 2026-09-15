require('dotenv').config();
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const fs = require('fs');
const path = require('path');

// PostgreSQL Database Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Supabase Client for Storage with Local Disk Mock Fallback
let supabase;

if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
} else {
  console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY not found. Using local disk mock storage fallback.');
  const uploadsBaseDir = path.join(__dirname, '..', 'uploads');

  supabase = {
    storage: {
      from: (bucket) => {
        const bucketDir = path.join(uploadsBaseDir, bucket);
        if (!fs.existsSync(bucketDir)) {
          fs.mkdirSync(bucketDir, { recursive: true });
        }

        return {
          upload: async (fileName, fileBuffer, options = {}) => {
            try {
              const filePath = path.join(bucketDir, fileName);
              fs.writeFileSync(filePath, fileBuffer);
              return { data: { path: `${bucket}/${fileName}` }, error: null };
            } catch (err) {
              return { data: null, error: err };
            }
          },
          getPublicUrl: (fileName) => {
            const port = process.env.PORT || 5000;
            return {
              data: {
                publicUrl: `http://localhost:${port}/uploads/${bucket}/${fileName}`
              }
            };
          },
          remove: async (fileNames) => {
            try {
              const names = Array.isArray(fileNames) ? fileNames : [fileNames];
              const deletedData = [];

              for (const name of names) {
                const cleanName = path.basename(name);
                const targetPath = path.join(bucketDir, cleanName);
                const fallbackPath = path.join(uploadsBaseDir, cleanName);

                try {
                  if (fs.existsSync(targetPath)) {
                    fs.unlinkSync(targetPath);
                    deletedData.push({ name: cleanName });
                  } else if (fs.existsSync(fallbackPath)) {
                    fs.unlinkSync(fallbackPath);
                    deletedData.push({ name: cleanName });
                  } else {
                    // Gracefully handle missing files without throwing
                    deletedData.push({ name: cleanName, missing: true });
                  }
                } catch (fileErr) {
                  console.warn(`Could not delete local file ${cleanName}:`, fileErr.message);
                }
              }

              return { data: deletedData, error: null };
            } catch (err) {
              console.error('Mock storage remove error:', err);
              return { data: null, error: err };
            }
          }
        };
      }
    }
  };
}

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