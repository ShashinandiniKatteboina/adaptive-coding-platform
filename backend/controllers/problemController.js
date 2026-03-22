const pool = require('../config/db');

exports.getAllProblems = async (req, res) => {
  try {
    const { topic, difficulty } = req.query;
    let query = 'SELECT id, title, difficulty, topic FROM problems WHERE 1=1';
    const params = [];

    if (topic) {
      params.push(topic);
      query += ` AND topic = $${params.length}`;
    }
    if (difficulty) {
      params.push(difficulty);
      query += ` AND difficulty = $${params.length}`;
    }

    query += ' ORDER BY id ASC';
    const result = await pool.query(query, params);
    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

exports.getProblemById = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.title, p.description, p.difficulty, p.topic,
       json_agg(
         json_build_object('input', tc.input, 'expected_output', tc.expected_output)
       ) FILTER (WHERE tc.is_hidden = false) AS examples
       FROM problems p
       LEFT JOIN test_cases tc ON tc.problem_id = p.id
       WHERE p.id = $1
       GROUP BY p.id`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Problem not found' });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};