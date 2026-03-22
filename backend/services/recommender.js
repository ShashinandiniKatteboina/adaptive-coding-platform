const pool = require('../config/db');

exports.getRecommendations = async (userId) => {
  try {
    const progress = await pool.query(
      'SELECT * FROM user_progress WHERE user_id = $1',
      [userId]
    );

    const solved = await pool.query(
      `SELECT DISTINCT problem_id FROM submissions
       WHERE user_id = $1 AND status = 'accepted'`,
      [userId]
    );
    const solvedIds = solved.rows.map(r => r.problem_id);

    const allTopics = [
      'arrays', 'strings', 'stacks',
      'linked-lists', 'trees', 'graphs', 'dp', 'sorting'
    ];

    let weakTopics = [];
    let targetDifficulty = 'easy';

    for (const topic of allTopics) {
      const p = progress.rows.find(r => r.topic === topic);
      if (!p) {
        weakTopics.push(topic);
        continue;
      }
      if (p.easy_solved < 3) targetDifficulty = 'easy';
      else if (p.medium_solved < 3) targetDifficulty = 'medium';
      else targetDifficulty = 'hard';

      if (p.easy_solved < 5) weakTopics.push(topic);
    }

    if (weakTopics.length === 0) weakTopics = allTopics;

    let result;
    if (solvedIds.length > 0) {
      result = await pool.query(
        `SELECT id, title, difficulty, topic FROM problems
         WHERE topic = ANY($1) AND difficulty = $2
         AND id != ALL($3) LIMIT 5`,
        [weakTopics, targetDifficulty, solvedIds]
      );
    } else {
      result = await pool.query(
        `SELECT id, title, difficulty, topic FROM problems
         WHERE topic = ANY($1) AND difficulty = $2 LIMIT 5`,
        [weakTopics, targetDifficulty]
      );
    }

    return result.rows;

  } catch (err) {
    console.error('Recommender error:', err.message);
    return [];
  }
};
