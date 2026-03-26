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

// Home Route for testing
app.get('/', (req, res) => {
  res.json({ message: 'DSA Platform API is running successfully' });
});

// Use the PORT provided by Render or default to 5000
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
