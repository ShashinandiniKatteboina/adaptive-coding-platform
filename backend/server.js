const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// IMPORTANT: Required for rate limiting to work on Render
app.set('trust proxy', 1);

// Updated CORS to be more flexible for your deployment
app.use(cors({
  origin: '*', // Allows all origins - safest for initial deployment
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// Rate Limiter
const submitLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 requests per windowMs
  message: 'Too many submissions, please wait a minute'
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/problems', require('./routes/problems'));
app.use('/api/submissions', submitLimiter, require('./routes/submissions'));
app.use('/api/progress', require('./routes/progress'));
app.use('/api/wishlist', require('./routes/wishlist'));
app.use('/api/code', require('./routes/codeRoutes'));

// Home Route for testing
app.get('/', (req, res) => {
  res.json({ message: 'DSA Platform API is running successfully' });
});

// Use the PORT provided by Render or default to 5000
const PORT = process.env.PORT || 5000;

// One-off migration for Solutions table
const pool = require('./config/db');
async function initSolutionsTable() {
  try {
    // 1. Create table
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
    
    // 2. Initial Migration (only if solutions table is empty)
    const checkEmpty = await pool.query('SELECT id FROM solutions LIMIT 1');
    if (checkEmpty.rows.length === 0) {
      console.log('--- Migrating existing accepted submissions to solutions table (fastest only) ---');
      await pool.query(`
        INSERT INTO solutions (user_id, problem_id, user_name, language, code, execution_time, submitted_at)
        SELECT DISTINCT ON (s.user_id, s.problem_id) 
               s.user_id, s.problem_id, u.name, s.language, s.code, s.execution_time, s.submitted_at
        FROM submissions s
        JOIN users u ON s.user_id = u.id
        WHERE s.status = 'accepted'
        ORDER BY s.user_id, s.problem_id, s.execution_time ASC
      `);
      console.log('✅ Migration completed.');
    }
  } catch (err) {
    console.error('Solutions table init failed:', err.message);
  }
}
initSolutionsTable();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});