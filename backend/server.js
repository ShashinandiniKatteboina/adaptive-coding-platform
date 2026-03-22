const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

const submitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many submissions, please wait a minute'
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/problems', require('./routes/problems'));
app.use('/api/submissions', submitLimiter, require('./routes/submissions'));
app.use('/api/progress', require('./routes/progress'));

app.get('/', (req, res) => {
  res.json({ message: 'DSA Platform API is running' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});