const pool = require('../config/db');
const { runCode } = require('../services/judge0');

exports.submitCode = async (req, res) => {
  const { problem_id, language, code } = req.body;
  const user_id = req.user.id;

  try {
    const testCases = await pool.query(
      'SELECT * FROM test_cases WHERE problem_id = $1',
      [problem_id]
    );

    if (testCases.rows.length === 0) {
      return res.status(404).json({ message: 'No test cases found for this problem' });
    }

    let allPassed = true;
    let finalStatus = 'accepted';
    let totalTime = 0;
    let errorDetail = '';

    for (const tc of testCases.rows) {
      const result = await runCode(code, language, tc.input);

      if (result.stderr || result.compile_output) {
        allPassed = false;
        finalStatus = 'error';
        errorDetail = result.stderr || result.compile_output;
        break;
      }

      if (result.stdout.trim() !== tc.expected_output.trim()) {
        allPassed = false;
        finalStatus = 'wrong_answer';
        break;
      }

      if (result.time) totalTime += parseFloat(result.time);
    }

    const submission = await pool.query(
      `INSERT INTO submissions
       (user_id, problem_id, language, code, status, execution_time)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [user_id, problem_id, language, code, finalStatus, totalTime]
    );

    if (allPassed) {
      const problem = await pool.query(
        'SELECT topic, difficulty FROM problems WHERE id = $1',
        [problem_id]
      );
      const { topic, difficulty } = problem.rows[0];
      const col = `${difficulty}_solved`;

      await pool.query(
        `INSERT INTO user_progress (user_id, topic, ${col}, total_attempts)
         VALUES ($1, $2, 1, 1)
         ON CONFLICT (user_id, topic)
         DO UPDATE SET
           ${col} = user_progress.${col} + 1,
           total_attempts = user_progress.total_attempts + 1,
           last_active = NOW()`,
        [user_id, topic]
      );
    }

    res.json({
      status: finalStatus,
      error: errorDetail || undefined,
      execution_time: totalTime,
      submission: submission.rows[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Submission failed', error: err.message });
  }
};

exports.getUserSubmissions = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.id, p.title, s.language, s.status,
       s.execution_time, s.submitted_at
       FROM submissions s
       JOIN problems p ON s.problem_id = p.id
       WHERE s.user_id = $1
       ORDER BY s.submitted_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};