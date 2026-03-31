const pool = require('../config/db');
const { getRecommendations } = require('../services/recommender');

exports.getProgress = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Get Platform Totals (how many problems total in DB)
    const platformTotalsResult = await pool.query(`
      SELECT 
        LOWER(difficulty) as diff, 
        COUNT(*) as count 
      FROM problems 
      GROUP BY LOWER(difficulty)
    `);
    
    const platformTotals = { easy: 0, medium: 0, hard: 0 };
    platformTotalsResult.rows.forEach(r => {
      platformTotals[r.diff] = parseInt(r.count);
    });

    // 2. Get User's Solved Progress (aggregated by difficulty)
    const userStatsResult = await pool.query(`
      SELECT 
        LOWER(p.difficulty) as diff, 
        COUNT(DISTINCT p.id) as solved 
      FROM submissions s
      JOIN problems p ON s.problem_id = p.id
      WHERE s.user_id = $1 AND LOWER(s.status) = 'accepted'
      GROUP BY LOWER(p.difficulty)
    `, [userId]);

    const userStats = { easy: 0, medium: 0, hard: 0 };
    userStatsResult.rows.forEach(r => {
      userStats[r.diff] = parseInt(r.solved);
    });

    // 3. Get Topic-wise Progress
    const topicProgressResult = await pool.query(`
      SELECT 
        p.topic, 
        COUNT(DISTINCT CASE WHEN LOWER(p.difficulty) = 'easy' THEN p.id END) as easy_solved,
        COUNT(DISTINCT CASE WHEN LOWER(p.difficulty) = 'medium' THEN p.id END) as medium_solved,
        COUNT(DISTINCT CASE WHEN LOWER(p.difficulty) = 'hard' THEN p.id END) as hard_solved
      FROM submissions s
      JOIN problems p ON s.problem_id = p.id
      WHERE s.user_id = $1 AND LOWER(s.status) = 'accepted'
      GROUP BY p.topic
    `, [userId]);

    res.json({
      stats: userStats,
      platformTotals: platformTotals,
      topicProgress: topicProgressResult.rows
    });

  } catch (err) {
    console.error('Progress calculation error:', err);
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