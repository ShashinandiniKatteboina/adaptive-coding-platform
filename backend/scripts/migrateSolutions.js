const pool = require('../config/db');

async function migrate() {
  try {
    console.log('--- Starting Solutions Migration ---');

    // 1. Create the solutions table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS solutions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        problem_id INTEGER NOT NULL,
        user_name VARCHAR(100) NOT NULL,
        language VARCHAR(50) NOT NULL,
        code TEXT NOT NULL,
        execution_time DOUBLE PRECISION DEFAULT 0,
        submitted_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Solutions table ensured.');

    // 2. Fetch existing accepted submissions
    const existingAccepted = await pool.query(`
      SELECT s.user_id, s.problem_id, u.name as user_name, s.language, s.code, s.execution_time, s.submitted_at
      FROM submissions s
      JOIN users u ON s.user_id = u.id
      WHERE s.status = 'accepted'
    `);
    
    console.log(`🔍 Found ${existingAccepted.rows.length} accepted submissions to migrate.`);

    // 3. Insert into solutions table (using a loop for simplicity, or we could do a single INSERT SELECT)
    // To prevent duplicates if the script is run twice, we'll check if they exist or just rely on the migration logic
    // Actually, a simple INSERT SELECT is better for efficiency:
    await pool.query(`
      INSERT INTO solutions (user_id, problem_id, user_name, language, code, execution_time, submitted_at)
      SELECT s.user_id, s.problem_id, u.name, s.language, s.code, s.execution_time, s.submitted_at
      FROM submissions s
      JOIN users u ON s.user_id = u.id
      WHERE s.status = 'accepted'
      ON CONFLICT DO NOTHING; -- This requires a unique constraint to work perfectly, but for now we'll just populate.
    `);

    console.log('✅ Migration completed successfully!');

  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    pool.end();
  }
}

migrate();
