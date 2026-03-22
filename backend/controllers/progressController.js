const pool = require('../config/db');
const { getRecommendations } = require('../services/recommender');

exports.getProgress = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM user_progress WHERE user_id = $1',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

exports.getRecommendations = async (req, res) => {
  try {
    const recommendations = await getRecommendations(req.user.id);
    res.json(recommendations);
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};
